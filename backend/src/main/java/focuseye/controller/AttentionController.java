package focuseye.controller;

import focuseye.dto.LandmarkSequence;
import focuseye.service.AttentionService;
import focuseye.repository.StudySessionRepository;
import jakarta.validation.Valid;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;
import focuseye.model.StudySession;

/**
 * REST Controller for the Attention Analysis API.
 * This class handles the web-facing part of the application.
 */
@RestController
@RequestMapping("/api/v1/attention")
@CrossOrigin(originPatterns = "*", allowCredentials = "true")
public class AttentionController {

    @Autowired
    private AttentionService attentionService;

    @Autowired
    private StudySessionRepository sessionRepository;

    /**
     * Receives a sequence of landmarks and returns the attention prediction.
     */
    @PostMapping("/predict")
    public Map<String, Object> predict(@Valid @RequestBody LandmarkSequence sequence) {
        return attentionService.processAttentionData(sequence);
    }

    /**
     * Returns all previous study sessions stored in the database.
     */
    @GetMapping("/history")
    public List<StudySession> getHistory() {
        return sessionRepository.findAll();
    }
}
