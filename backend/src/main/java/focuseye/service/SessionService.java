package focuseye.service;

import focuseye.dto.SessionResponse;
import focuseye.model.FocusCategory;
import focuseye.model.SessionStatus;
import focuseye.model.StudySession;
import focuseye.model.User;
import focuseye.repository.StudySessionRepository;
import focuseye.repository.UserRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.List;
import java.util.Optional;

/**
 * Manages the full lifecycle and business logic of study sessions. 
 * It handles starting, stopping, and recording scores for sessions,
 * while also calculating complex focus streaks and ensuring that
 * all session data is correctly persisted in the database.
 */
@Service
@Transactional
public class SessionService {

    private static final DateTimeFormatter PERIOD_FORMATTER = DateTimeFormatter.ofPattern("h:mm a");
    private static final DateTimeFormatter TITLE_FORMATTER =
            DateTimeFormatter.ofPattern("MMM d, h:mm a");
    private static final List<SessionStatus> OPEN_STATUSES =
            List.of(SessionStatus.ACTIVE, SessionStatus.PAUSED);

    @Autowired private StudySessionRepository sessionRepo;
    @Autowired private UserRepository userRepo;

    public SessionResponse start(String username) {
        sessionRepo.findFirstByUserUsernameAndStatusIn(username, OPEN_STATUSES)
                .ifPresent(s -> {
                    throw new IllegalStateException(
                            "User already has an open session (id=" + s.getId() + ")");
                });

        User user = userRepo.findByUsername(username).orElseGet(() -> {
            User u = new User();
            u.setUsername(username);
            u.setEmail(username + "@FocusEye.local");
            return userRepo.save(u);
        });

        StudySession s = new StudySession();
        s.setUser(user);
        s.setStatus(SessionStatus.ACTIVE);
        s.setTitle("Session — " + s.getStartTime().format(TITLE_FORMATTER));
        s.setDeepFocusDuration(0);
        s.setPartialDistractionDuration(0);
        s.setAbsentDuration(0);
        s.setMaxFocusSeconds(0);
        s.setMaxDistractionSeconds(0);
        s.setMaxAbsentSeconds(0);
        return SessionResponse.from(sessionRepo.save(s));
    }

    public SessionResponse pause(Long id, String username) {
        StudySession s = requireOwned(id, username);
        if (s.getStatus() != SessionStatus.ACTIVE) {
            throw new IllegalStateException("Can only pause an ACTIVE session (was " + s.getStatus() + ")");
        }
        finalizeCurrentStreak(s);
        s.setCurrentStreakType(null);
        s.setCurrentStreakSeconds(0);
        s.setStatus(SessionStatus.PAUSED);
        return SessionResponse.from(sessionRepo.save(s));
    }

    public SessionResponse resume(Long id, String username) {
        StudySession s = requireOwned(id, username);
        if (s.getStatus() != SessionStatus.PAUSED) {
            throw new IllegalStateException("Can only resume a PAUSED session (was " + s.getStatus() + ")");
        }
        s.setStatus(SessionStatus.ACTIVE);
        return SessionResponse.from(sessionRepo.save(s));
    }

    public SessionResponse stop(Long id, String username) {
        StudySession s = requireOwned(id, username);
        if (s.getStatus() == SessionStatus.COMPLETED) {
            return SessionResponse.from(s);
        }
        finalizeCurrentStreak(s);
        s.setCurrentStreakType(null);
        s.setCurrentStreakSeconds(0);
        s.setEndTime(LocalDateTime.now());
        s.setStatus(SessionStatus.COMPLETED);
        return SessionResponse.from(sessionRepo.save(s));
    }

    public SessionResponse recordScore(Long id, String username, double score, FocusCategory type) {
        StudySession studySession = requireOwned(id, username);
        if (studySession.getStatus() != SessionStatus.ACTIVE) {
            throw new IllegalStateException("Can only record score on an ACTIVE session (was " + studySession.getStatus() + ")");
        }

        studySession.getFocusScores().add(score);

        switch (type) {
            case DEEP_FOCUS -> studySession.setDeepFocusDuration(nz(studySession.getDeepFocusDuration()) + 1);
            case PARTIAL_DISTRACTION   -> studySession.setPartialDistractionDuration(nz(studySession.getPartialDistractionDuration()) + 1);
            case ABSENT     -> studySession.setAbsentDuration(nz(studySession.getAbsentDuration()) + 1);
            default -> throw new IllegalArgumentException("Unknown score type: " + type);
        }

        if (type.equals(studySession.getCurrentStreakType())) {
            studySession.setCurrentStreakSeconds(nz(studySession.getCurrentStreakSeconds()) + 1);
        } else {
            finalizeCurrentStreak(studySession);
            studySession.setCurrentStreakType(type);
            studySession.setCurrentStreakStart(LocalDateTime.now());
            studySession.setCurrentStreakSeconds(1);
        }

        return SessionResponse.from(sessionRepo.save(studySession));
    }

    public SessionResponse updateMetadata(Long id, String username, String title, String notes) {
        StudySession s = requireOwned(id, username);
        if (title != null) {
            String trimmed = title.trim();
            if (!trimmed.isEmpty()) s.setTitle(trimmed);
        }
        if (notes != null) {
            s.setNotes(notes.isBlank() ? null : notes);
        }
        return SessionResponse.from(sessionRepo.save(s));
    }

    @Transactional(readOnly = true)
    public Optional<SessionResponse> getActive(String username) {
        return sessionRepo.findFirstByUserUsernameAndStatusIn(username, OPEN_STATUSES)
                .map(SessionResponse::from);
    }

    @Transactional(readOnly = true)
    public SessionResponse getById(Long id, String username) {
        return SessionResponse.from(requireOwned(id, username));
    }

    @Transactional(readOnly = true)
    public List<SessionResponse> listForUser(String username) {
        return sessionRepo.findByUserUsernameOrderByStartTimeDesc(username).stream()
                .map(SessionResponse::from)
                .toList();
    }

    public void delete(Long id, String username) {
        StudySession s = requireOwned(id, username);
        sessionRepo.delete(s);
    }

    private StudySession requireOwned(Long id, String username) {
        return sessionRepo.findByIdAndUserUsername(id, username)
                .orElseThrow(() -> new IllegalArgumentException(
                        "Session " + id + " not found for user " + username));
    }

    private void finalizeCurrentStreak(StudySession s) {
        FocusCategory type = s.getCurrentStreakType();
        LocalDateTime start = s.getCurrentStreakStart();
        int seconds = nz(s.getCurrentStreakSeconds());
        if (type == null || start == null || seconds == 0) return;

        String period = start.format(PERIOD_FORMATTER) + " - " + LocalDateTime.now().format(PERIOD_FORMATTER);

        switch (type) {
            case DEEP_FOCUS -> {
                if (seconds > nz(s.getMaxFocusSeconds())) {
                    s.setMaxFocusSeconds(seconds);
                    s.setLongestFocusPeriod(period);
                }
            }
            case PARTIAL_DISTRACTION -> {
                if (seconds > nz(s.getMaxDistractionSeconds())) {
                    s.setMaxDistractionSeconds(seconds);
                    s.setLongestDistractionPeriod(period);
                }
            }
            case ABSENT -> {
                if (seconds > nz(s.getMaxAbsentSeconds())) {
                    s.setMaxAbsentSeconds(seconds);
                    s.setLongestAbsentPeriod(period);
                }
            }
        }
    }

    private static int nz(Integer v) {
        return v == null ? 0 : v;
    }
}
