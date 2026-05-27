package focuseye.controller;

import focuseye.dto.SessionResponse;
import focuseye.dto.UpdateSessionRequest;
import focuseye.model.FocusCategory;
import focuseye.service.SessionService;
import jakarta.validation.Valid;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

/**
 * This class handles all network requests related to study sessions.
 * It provides endpoints to start, pause, resume, and stop sessions.
 * It acts as the entry point for the frontend to communicate with
 * the backend logic for managing a user's focus history.
 */
@RestController
@RequestMapping("/api/sessions")
public class SessionController {

    @Autowired
    private SessionService sessions;

    // TODO(auth): replace `username` query/body params with Principal#getName() when auth is added.

    @GetMapping
    public List<SessionResponse> list(@RequestParam String username) {
        return sessions.listForUser(username);
    }

    @GetMapping("/user/{username}")
    public List<SessionResponse> listByPath(@PathVariable String username) {
        return sessions.listForUser(username);
    }

    @GetMapping("/{id}")
    public SessionResponse get(@PathVariable Long id, @RequestParam String username) {
        return sessions.getById(id, username);
    }

    @GetMapping("/active")
    public ResponseEntity<SessionResponse> active(@RequestParam String username) {
        return sessions.getActive(username)
                .map(ResponseEntity::ok)
                .orElseGet(() -> ResponseEntity.noContent().build());
    }

    @PostMapping("/start")
    public SessionResponse start(@RequestBody Map<String, String> body) {
        return sessions.start(body.get("username"));
    }

    @PostMapping("/{id}/pause")
    public SessionResponse pause(@PathVariable Long id, @RequestBody Map<String, String> body) {
        return sessions.pause(id, body.get("username"));
    }

    @PostMapping("/{id}/resume")
    public SessionResponse resume(@PathVariable Long id, @RequestBody Map<String, String> body) {
        return sessions.resume(id, body.get("username"));
    }

    @PostMapping("/{id}/stop")
    public SessionResponse stop(@PathVariable Long id, @RequestBody Map<String, String> body) {
        return sessions.stop(id, body.get("username"));
    }

    @PostMapping("/{id}/score")
    public SessionResponse score(@PathVariable Long id, @RequestBody Map<String, Object> body) {
        String username = String.valueOf(body.get("username"));
        double score = Double.parseDouble(body.get("score").toString());
        FocusCategory type = FocusCategory.fromString(String.valueOf(body.get("type")));
        return sessions.recordScore(id, username, score, type);
    }

    @PutMapping("/{id}")
    public SessionResponse update(@PathVariable Long id,
                                  @RequestParam String username,
                                  @Valid @RequestBody UpdateSessionRequest body) {
        return sessions.updateMetadata(id, username, body.getTitle(), body.getNotes());
    }

    @DeleteMapping("/{id}")
    public void delete(@PathVariable Long id, @RequestParam String username) {
        sessions.delete(id, username);
    }
}
