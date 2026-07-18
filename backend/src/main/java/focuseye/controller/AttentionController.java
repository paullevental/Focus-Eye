package focuseye.controller;

import focuseye.dto.SessionResponse;
import focuseye.service.SessionService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.*;

import java.util.List;

/** Legacy/admin read of a user's sessions. Inference now runs in the browser. */
@RestController
@RequestMapping("/api/v1/attention")
public class AttentionController {

    @Autowired
    private SessionService sessionService;

    /** Legacy/admin view of one user's sessions. UI uses /api/sessions/user/{username}. */
    @GetMapping("/history")
    public List<SessionResponse> getHistory(@RequestParam String username) {
        return sessionService.listForUser(username);
    }
}
