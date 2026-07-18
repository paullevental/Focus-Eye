package focuseye.service;

import focuseye.dto.ScoredWindow;
import focuseye.dto.SessionResponse;
import focuseye.model.FocusCategory;
import focuseye.model.SessionStatus;
import focuseye.model.StudySession;
import focuseye.model.User;
import focuseye.repository.StudySessionRepository;
import focuseye.repository.UserRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.List;
import java.util.Optional;

/**
 * Business logic for study sessions: start/pause/resume/stop, recording scores,
 * streak tracking, and persistence. Every write runs in a transaction.
 */
@Service
@Transactional
public class SessionService {

    private static final Logger log = LoggerFactory.getLogger(SessionService.class);

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
        long t0 = System.nanoTime();
        StudySession studySession = requireActive(id, username);

        applyScore(studySession, score, type);
        int scoresCount = studySession.getFocusScores().size();

        SessionResponse response = SessionResponse.from(sessionRepo.save(studySession));
        long ms = (System.nanoTime() - t0) / 1_000_000;
        log.info("score id={} took={}ms scores={}", id, ms, scoresCount);
        return response;
    }

    /**
     * Record a batch of ~1s windows in one transaction and a single save (keeps
     * the fast append path). Each entry is a real second of capture, so each
     * adds +1s. Lets the frontend stop discarding windows buffered during
     * backend latency.
     */
    public SessionResponse recordScores(Long id, String username, List<ScoredWindow> entries) {
        long t0 = System.nanoTime();
        StudySession studySession = requireActive(id, username);
        if (entries == null || entries.isEmpty()) {
            return SessionResponse.from(studySession);
        }

        for (ScoredWindow entry : entries) {
            applyScore(studySession, entry.score(), entry.type());
        }
        int scoresCount = studySession.getFocusScores().size();

        SessionResponse response = SessionResponse.from(sessionRepo.save(studySession));
        long ms = (System.nanoTime() - t0) / 1_000_000;
        log.info("scores id={} took={}ms entries={} scores={}", id, ms, entries.size(), scoresCount);
        return response;
    }

    /**
     * Apply one scored window in memory (no save): append the score, add 1s to
     * the matching total, and extend or restart the current streak. Shared by
     * recordScore and recordScores so the two paths can't drift.
     */
    private void applyScore(StudySession s, double score, FocusCategory type) {
        s.getFocusScores().add(score);

        switch (type) {
            case DEEP_FOCUS -> s.setDeepFocusDuration(nz(s.getDeepFocusDuration()) + 1);
            case PARTIAL_DISTRACTION -> s.setPartialDistractionDuration(nz(s.getPartialDistractionDuration()) + 1);
            case ABSENT -> s.setAbsentDuration(nz(s.getAbsentDuration()) + 1);
            default -> throw new IllegalArgumentException("Unknown score type: " + type);
        }

        if (type.equals(s.getCurrentStreakType())) {
            s.setCurrentStreakSeconds(nz(s.getCurrentStreakSeconds()) + 1);
        } else {
            finalizeCurrentStreak(s);
            s.setCurrentStreakType(type);
            s.setCurrentStreakStart(LocalDateTime.now());
            s.setCurrentStreakSeconds(1);
        }
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

    // requireOwned plus an ACTIVE-status guard. Shared by the score-recording paths.
    private StudySession requireActive(Long id, String username) {
        StudySession s = requireOwned(id, username);
        if (s.getStatus() != SessionStatus.ACTIVE) {
            throw new IllegalStateException(
                    "Can only record score on an ACTIVE session (was " + s.getStatus() + ")");
        }
        return s;
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
