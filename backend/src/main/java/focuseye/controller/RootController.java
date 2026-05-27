package focuseye.controller;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * Provides basic health check endpoints for the application.
 * It allows monitoring tools and developers to verify that the
 * backend service is online and responding to requests.
 */
@RestController
public class RootController {

    @GetMapping("/")
    public String index() {
        return "FocusEye Backend is Online. Visit /api/sessions/status for data.";
    }

    @GetMapping("/health")
    public String health() {
        return "FocusEye Backend is Online";
    }
}
