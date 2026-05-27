package focuseye.controller;

import focuseye.dto.LandmarkSequence;
import focuseye.dto.SessionResponse;
import focuseye.service.AttentionService;
import focuseye.service.SessionService;
import jakarta.validation.Valid;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

/**
 * Handles requests related to AI focus predictions. 
 * It receives facial landmark sequences from the frontend and 
 * returns predictions by communicating with the AI service.
 */
@RestController
@RequestMapping("/api/v1/attention")
public class AttentionController {

    @Autowired
    private AttentionService attentionService;

    @Autowired
    private SessionService sessionService;

    /**
     * Run the LSTM on a 30-frame landmark sequence and return the prediction.
     */
    @PostMapping("/predict")
    public Map<String, Object> predict(@Valid @RequestBody LandmarkSequence sequence) {
        return attentionService.processAttentionData(sequence);
    }

    /**
     * Admin / debug view of a single user's sessions. The frontend uses
     * /api/sessions/user/{username}; this exists for parity with the original
     * v1 namespace. Returns SessionResponse DTOs (not entities) so lazy
     * collections are safe outside the persistence context.
     */
    @GetMapping("/history")
    public java.util.List<SessionResponse> getHistory(@RequestParam String username) {
        return sessionService.listForUser(username);
    }
}
