package focuseye.controller;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

/** Health-check endpoints so uptime monitors can confirm the app is up. */
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
