package focuseye.model;

import jakarta.persistence.*;
import lombok.Data;
import java.time.LocalDateTime;

@Entity
@Data
@Table(name = "study_sessions")
public class StudySession {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne
    @JoinColumn(name = "user_id")
    private User user;
    private LocalDateTime startTime;
    private LocalDateTime endTime;
    
    @Enumerated(EnumType.STRING)
    private FocusCategory classification;

    private Double averageConfidence;

    @ElementCollection
    @CollectionTable(name = "session_focus_scores", joinColumns = @JoinColumn(name = "session_id"))
    @Column(name = "score")
    private java.util.List<Double> focusScores = new java.util.ArrayList<>();

    // Durations in minutes (used for long-term summaries)
    private Integer deepFocusDuration;
    private Integer partialDistractionDuration;
    private Integer absentDuration;

    // Statistics requested
    private String longestFocusPeriod; // e.g., "10:00 - 10:45 AM"
    private String longestDistractionPeriod;
    private String longestAbsentPeriod;

    public StudySession() {
        this.startTime = LocalDateTime.now();
    }

    /**
     * Helper to set classification from string (e.g. from Python AI)
     */
    public void setClassification(String classification) {
        this.classification = FocusCategory.fromString(classification);
    }

    /**
     * Legacy support for service call
     */
    public void setConfidenceScore(Double confidenceScore) {
        this.averageConfidence = confidenceScore;
    }
}
