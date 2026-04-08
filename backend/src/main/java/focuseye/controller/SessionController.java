package focuseye.controller;

import focuseye.model.StudySession;
import focuseye.repository.StudySessionRepository;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.List;

@RestController
@RequestMapping("/api/sessions")
@CrossOrigin(origins = "http://localhost:5173") // Default Vite port
public class SessionController {

    @Autowired
    private StudySessionRepository repository;

    @Autowired
    private focuseye.repository.UserRepository userRepository;

    private String currentStatus = "IDLE"; 
    private Long activeSessionId = null;

    // Tracking state for streaks
    private String currentStreakType = null;
    private LocalDateTime currentStreakStart = null;
    private int currentStreakSeconds = 0;
    
    private int maxFocusSeconds = 0;
    private int maxDistractionSeconds = 0;
    private int maxAbsentSeconds = 0;

    private String maxFocusPeriod = null;
    private String maxDistractionPeriod = null;
    private String maxAbsentPeriod = null;

    private static final DateTimeFormatter FORMATTER = DateTimeFormatter.ofPattern("h:mm a");

    @GetMapping("/status")
    public String getStatus() {
        return currentStatus;
    }

    @PostMapping("/status")
    public void updateStatus(@RequestBody java.util.Map<String, String> payload) {
        String status = payload.get("status");
        String username = payload.getOrDefault("username", "testuser");
        this.currentStatus = status;

        if ("START".equals(status)) {
            focuseye.model.User user = userRepository.findByUsername(username).orElseGet(() -> {
                focuseye.model.User newUser = new focuseye.model.User();
                newUser.setUsername(username);
                newUser.setEmail(username + "@FocusEye.com");
                return userRepository.save(newUser);
            });

            focuseye.model.StudySession newSession = new focuseye.model.StudySession();
            newSession.setUser(user);
            newSession.setDeepFocusDuration(0);
            newSession.setPartialDistractionDuration(0);
            newSession.setAbsentDuration(0);
            newSession = repository.save(newSession);
            this.activeSessionId = newSession.getId();

            // Reset streak tracking
            currentStreakType = null;
            currentStreakStart = LocalDateTime.now();
            currentStreakSeconds = 0;
            maxFocusSeconds = 0;
            maxDistractionSeconds = 0;
            maxAbsentSeconds = 0;
            maxFocusPeriod = null;
            maxDistractionPeriod = null;
            maxAbsentPeriod = null;

            System.out.println("Started session: " + activeSessionId + " for user: " + username);
        } else if ("STOP".equals(status)) {
            if (activeSessionId != null) {
                // Check if the final streak is the longest
                updateMaxStreaks();

                StudySession session = repository.findById(activeSessionId).orElse(null);
                if (session != null) {
                    session.setEndTime(LocalDateTime.now());
                    
                    // Convert seconds to minutes for the entity durations if needed, 
                    // but since the entity uses Integer for duration, it's better to keep it consistent.
                    // The entity has fields for longest periods.
                    session.setLongestFocusPeriod(maxFocusPeriod);
                    session.setLongestDistractionPeriod(maxDistractionPeriod);
                    session.setLongestAbsentPeriod(maxAbsentPeriod);

                    repository.save(session);
                    System.out.println("Closed session: " + activeSessionId);
                }
                this.activeSessionId = null;
            }
        }
    }

    @PostMapping("/score")
    public void recordScore(@RequestBody java.util.Map<String, Object> payload) {
        if (activeSessionId == null) return;
        
        StudySession session = repository.findById(activeSessionId).orElse(null);
        if (session != null) {
            Double score = Double.valueOf(payload.get("score").toString());
            String type = payload.get("type").toString(); // "DEEP_FOCUS", "PARTIAL", "ABSENT"
            
            session.getFocusScores().add(score);
            
            // Streak logic
            if (type.equals(currentStreakType)) {
                currentStreakSeconds++;
            } else {
                updateMaxStreaks();
                currentStreakType = type;
                currentStreakSeconds = 1;
                currentStreakStart = LocalDateTime.now();
            }

            // Increment durations (approximate by 1 second for each call)
            if ("DEEP_FOCUS".equals(type)) session.setDeepFocusDuration((session.getDeepFocusDuration() == null ? 0 : session.getDeepFocusDuration()) + 1);
            else if ("PARTIAL".equals(type)) session.setPartialDistractionDuration((session.getPartialDistractionDuration() == null ? 0 : session.getPartialDistractionDuration()) + 1);
            else if ("ABSENT".equals(type)) session.setAbsentDuration((session.getAbsentDuration() == null ? 0 : session.getAbsentDuration()) + 1);
            
            repository.save(session);
        }
    }

    private void updateMaxStreaks() {
        if (currentStreakType == null || currentStreakStart == null) return;
        
        String periodString = currentStreakStart.format(FORMATTER) + " - " + LocalDateTime.now().format(FORMATTER);

        if ("DEEP_FOCUS".equals(currentStreakType) && currentStreakSeconds > maxFocusSeconds) {
            maxFocusSeconds = currentStreakSeconds;
            maxFocusPeriod = periodString;
        } else if ("PARTIAL".equals(currentStreakType) && currentStreakSeconds > maxDistractionSeconds) {
            maxDistractionSeconds = currentStreakSeconds;
            maxDistractionPeriod = periodString;
        } else if ("ABSENT".equals(currentStreakType) && currentStreakSeconds > maxAbsentSeconds) {
            maxAbsentSeconds = currentStreakSeconds;
            maxAbsentPeriod = periodString;
        }
    }

    @GetMapping("/user/{username}")
    public List<StudySession> getSessionsByUsername(@PathVariable String username) {
        return repository.findByUserUsernameOrderByStartTimeDesc(username);
    }

    @PostMapping
    public StudySession saveSession(@RequestBody StudySession session) {
        if (session == null) {
            throw new IllegalArgumentException("StudySession cannot be null");
        }
        return repository.save(session);
    }

    @DeleteMapping("/{id}")
    public void deleteSession(@PathVariable Long id) {
        if (id != null && repository.existsById(id)) {
            repository.deleteById(id);
        } else {
            System.out.println("Session with ID " + id + " not found for deletion.");
        }
    }

}
