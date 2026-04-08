package focuseye.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper; 
import focuseye.dto.LandmarkSequence;
import focuseye.model.StudySession;
import focuseye.repository.StudySessionRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.io.BufferedReader;
import java.io.BufferedWriter;
import java.io.InputStreamReader;
import java.io.OutputStreamWriter;
import java.time.LocalDateTime;

@Service
public class AttentionService {

    @Autowired
    private StudySessionRepository sessionRepository;

    @Autowired
    private ObjectMapper objectMapper;

    @Value("${ai.python.executable}")
    private String pythonExecutable;

    @Value("${ai.predict.script}")
    private String predictScript;

    public StudySession processAttentionData(LandmarkSequence sequence) {
        try {
            // 1. Prepare the prediction
            String prediction = "Absent"; // Default
            Double confidence = 0.0;

            // 2. Call the Python Inference Script
            ProcessBuilder pb = new ProcessBuilder(pythonExecutable, predictScript);
            Process process = pb.start();

            // 3. Send data to Python (stdin)
            try (BufferedWriter writer = new BufferedWriter(new OutputStreamWriter(process.getOutputStream()))) {
                String jsonData = objectMapper.writeValueAsString(sequence);
                writer.write(jsonData);
                writer.flush();
            }

            // 4. Read result from Python (stdout)
            StringBuilder output = new StringBuilder();
            try (BufferedReader reader = new BufferedReader(new InputStreamReader(process.getInputStream()))) {
                String line;
                while ((line = reader.readLine()) != null) {
                    output.append(line);
                }
            }

            // 5. Wait for process to complete
            int exitCode = process.waitFor();
            if (exitCode == 0) {
                String resultJson = output.toString();
                if (!resultJson.isEmpty()) {
                    JsonNode node = objectMapper.readTree(resultJson);
                    if (node.has("error")) {
                        throw new RuntimeException("AI Error: " + node.get("error").asText());
                    }
                    prediction = node.get("prediction").asText();
                    confidence = node.get("confidence").asDouble();
                }
            } else {
                throw new RuntimeException("Python process failed with exit code: " + exitCode);
            }

            // 6. Save and return the session result
            StudySession session = new StudySession();
            session.setClassification(prediction);
            session.setConfidenceScore(confidence);
            session.setEndTime(LocalDateTime.now());

            return sessionRepository.save(session);

        } catch (Exception e) {
            throw new RuntimeException("Failed to process attention data: " + e.getMessage(), e);
        }
    }
}
