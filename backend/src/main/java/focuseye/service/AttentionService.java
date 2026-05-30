package focuseye.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import focuseye.dto.LandmarkSequence;
import jakarta.annotation.PreDestroy;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.io.BufferedReader;
import java.io.BufferedWriter;
import java.io.InputStreamReader;
import java.io.OutputStreamWriter;
import java.nio.charset.StandardCharsets;
import java.util.HashMap;
import java.util.Map;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.TimeoutException;
import java.util.concurrent.locks.ReentrantLock;

/**
 * Persistent Python sidecar bridge. One Python process is kept alive for the
 * lifetime of the JVM and answers prediction requests over newline-delimited
 * JSON on stdin/stdout. This eliminates the per-request Python interpreter +
 * torch import overhead (~2-3s on Railway's shared CPU) that made the previous
 * spawn-per-request design unusable in production.
 */
@Service
public class AttentionService {

    private static final Logger log = LoggerFactory.getLogger(AttentionService.class);

    private static final int FIRST_REQUEST_TIMEOUT_MS = 30_000;
    private static final int REQUEST_TIMEOUT_MS = 10_000;

    @Autowired
    private ObjectMapper objectMapper;

    @Value("${ai.python.executable}")
    private String pythonExecutable;

    @Value("${ai.predict.script}")
    private String predictScript;

    private Process process;
    private BufferedWriter writer;
    private BufferedReader reader;
    private Thread stderrPump;
    private boolean firstRequest = true;

    private final ReentrantLock lock = new ReentrantLock();
    private final ExecutorService readExecutor = Executors.newSingleThreadExecutor(r -> {
        Thread t = new Thread(r, "predict-reader");
        t.setDaemon(true);
        return t;
    });

    public Map<String, Object> processAttentionData(LandmarkSequence sequence) {
        long t0 = System.nanoTime();
        lock.lock();
        try {
            ensureAlive();
            sendRequest(sequence);
            Map<String, Object> result = readResponse();
            long ms = (System.nanoTime() - t0) / 1_000_000;
            log.info("predict took={}ms", ms);
            return result;
        } catch (Exception e) {
            destroyProcess();
            throw new RuntimeException("Prediction failed: " + e.getMessage(), e);
        } finally {
            lock.unlock();
        }
    }

    private void ensureAlive() throws Exception {
        if (process != null && process.isAlive()) {
            return;
        }
        log.info("Starting Python predict sidecar: {} -u {}", pythonExecutable, predictScript);
        ProcessBuilder pb = new ProcessBuilder(pythonExecutable, "-u", predictScript);
        pb.environment().put("PYTHONUNBUFFERED", "1");
        pb.redirectErrorStream(false);
        process = pb.start();
        writer = new BufferedWriter(new OutputStreamWriter(
                process.getOutputStream(), StandardCharsets.UTF_8));
        reader = new BufferedReader(new InputStreamReader(
                process.getInputStream(), StandardCharsets.UTF_8));
        startStderrPump();
        firstRequest = true;
    }

    private void startStderrPump() {
        BufferedReader err = new BufferedReader(new InputStreamReader(
                process.getErrorStream(), StandardCharsets.UTF_8));
        stderrPump = new Thread(() -> {
            try {
                String line;
                while ((line = err.readLine()) != null) {
                    log.warn("[predict.py stderr] {}", line);
                }
            } catch (Exception ignored) {
                // Process died; the main thread will detect and restart.
            }
        }, "predict-stderr-pump");
        stderrPump.setDaemon(true);
        stderrPump.start();
    }

    private void sendRequest(LandmarkSequence sequence) throws Exception {
        writer.write(objectMapper.writeValueAsString(sequence));
        writer.newLine();
        writer.flush();
    }

    private Map<String, Object> readResponse() throws Exception {
        int timeoutMs = firstRequest ? FIRST_REQUEST_TIMEOUT_MS : REQUEST_TIMEOUT_MS;
        Future<String> future = readExecutor.submit(() -> reader.readLine());
        String line;
        try {
            line = future.get(timeoutMs, TimeUnit.MILLISECONDS);
        } catch (TimeoutException te) {
            throw new RuntimeException(
                    "Python sidecar timed out after " + timeoutMs + "ms");
        }
        firstRequest = false;

        if (line == null) {
            throw new RuntimeException("Python sidecar closed stdout (process died?)");
        }

        JsonNode node = objectMapper.readTree(line);
        if (node.has("error")) {
            throw new RuntimeException("AI error: " + node.get("error").asText());
        }

        Map<String, Object> result = new HashMap<>();
        result.put("prediction", node.get("prediction").asText());
        result.put("confidence", node.get("confidence").asDouble());
        return result;
    }

    private void destroyProcess() {
        if (process == null) {
            return;
        }
        try {
            process.destroyForcibly();
            process.waitFor(2, TimeUnit.SECONDS);
        } catch (InterruptedException ie) {
            Thread.currentThread().interrupt();
        } finally {
            process = null;
            writer = null;
            reader = null;
        }
    }

    @PreDestroy
    public void shutdown() {
        log.info("Shutting down Python sidecar");
        destroyProcess();
        readExecutor.shutdownNow();
    }
}
