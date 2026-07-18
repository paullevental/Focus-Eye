package focuseye.model;

import com.fasterxml.jackson.annotation.JsonIgnore;
import jakarta.persistence.*;
import lombok.Data;
import java.time.LocalDateTime;

/**
 * Database entity for one study session: timing, status, per-state durations,
 * and streak records. One row = one session.
 */
@Entity
@Data
@Table(name = "study_sessions")
public class StudySession {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne
    @JoinColumn(name = "user_id")
    @JsonIgnore
    private User user;

    private LocalDateTime startTime;
    private LocalDateTime endTime;

    @Column(length = 120)
    private String title;

    @Column(length = 2000)
    private String notes;

    @Enumerated(EnumType.STRING)
    private SessionStatus status;

    @Enumerated(EnumType.STRING)
    private FocusCategory classification;

    private Double averageConfidence;

    @ElementCollection
    @CollectionTable(name = "session_focus_scores", joinColumns = @JoinColumn(name = "session_id"))
    @OrderColumn(name = "score_index")
    @Column(name = "score")
    private java.util.List<Double> focusScores = new java.util.ArrayList<>();

    // Per-category cumulative seconds (incremented once per /score call from frontend at ~1 Hz)
    private Integer deepFocusDuration;
    private Integer partialDistractionDuration;
    private Integer absentDuration;

    // Current streak state — persisted so a server restart doesn't lose it
    @Enumerated(EnumType.STRING)
    private FocusCategory currentStreakType;
    private LocalDateTime currentStreakStart;
    private Integer currentStreakSeconds;

    // Longest streak per category, in seconds, with human-readable time-of-day periods
    private Integer maxFocusSeconds;
    private Integer maxDistractionSeconds;
    private Integer maxAbsentSeconds;

    private String longestFocusPeriod;
    private String longestDistractionPeriod;
    private String longestAbsentPeriod;

    public StudySession() {
        this.startTime = LocalDateTime.now();
    }

    public void setClassification(String classification) {
        this.classification = FocusCategory.fromString(classification);
    }
}
