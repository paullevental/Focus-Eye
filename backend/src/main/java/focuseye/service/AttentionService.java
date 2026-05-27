package focuseye.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import focuseye.dto.LandmarkSequence;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.io.BufferedWriter;
import java.io.OutputStreamWriter;
import java.util.HashMap;
import java.util.Map;
import java.util.concurrent.TimeUnit;

/**
 * Acts as a bridge between the Java backend and the Python AI model. 
 * It sends landmark data to a Python subprocess and retrieves 
 * predictions, enabling real-time focus classification without 
 * requiring the model to run natively in Java.
 */
@Service
public class AttentionService {

    private static final int PYTHON_TIMEOUT_SECONDS = 10;

    @Autowired
    private ObjectMapper objectMapper;

    @Value("${ai.python.executable}")
    private String pythonExecutable;

    @Value("${ai.predict.script}")
    private String predictScript;

    public Map<String, Object> processAttentionData(LandmarkSequence sequence) {
        Process process = null;
        try {
            ProcessBuilder pb = new ProcessBuilder(pythonExecutable, predictScript);
            pb.redirectErrorStream(true);
            process = pb.start();

            try (BufferedWriter writer = new BufferedWriter(
                    new OutputStreamWriter(process.getOutputStream()))) {
                writer.write(objectMapper.writeValueAsString(sequence));
                writer.flush();
            }

            if (!process.waitFor(PYTHON_TIMEOUT_SECONDS, TimeUnit.SECONDS)) {
                process.destroyForcibly();
                throw new RuntimeException(
                        "Python prediction timed out after " + PYTHON_TIMEOUT_SECONDS + "s");
            }

            String output = new String(process.getInputStream().readAllBytes()).trim();

            if (process.exitValue() != 0) {
                throw new RuntimeException(
                        "Python exited " + process.exitValue() + ": " + output);
            }
            if (output.isEmpty()) {
                throw new RuntimeException("Python returned empty output");
            }

            JsonNode node = objectMapper.readTree(output);
            if (node.has("error")) {
                throw new RuntimeException("AI error: " + node.get("error").asText());
            }

            Map<String, Object> result = new HashMap<>();
            result.put("prediction", node.get("prediction").asText());
            result.put("confidence", node.get("confidence").asDouble());
            return result;

        } catch (InterruptedException ie) {
            Thread.currentThread().interrupt();
            if (process != null) process.destroyForcibly();
            throw new RuntimeException("Interrupted while waiting for Python", ie);
        } catch (RuntimeException re) {
            if (process != null && process.isAlive()) process.destroyForcibly();
            throw re;
        } catch (Exception e) {
            if (process != null && process.isAlive()) process.destroyForcibly();
            throw new RuntimeException("Failed to process attention data: " + e.getMessage(), e);
        }
    }
}
