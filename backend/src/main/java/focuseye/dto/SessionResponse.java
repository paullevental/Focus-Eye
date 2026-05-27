package focuseye.dto;

import focuseye.model.FocusCategory;
import focuseye.model.SessionStatus;
import focuseye.model.StudySession;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

/**
 * A data transfer object that sends session details to the frontend.
 * It simplifies the complex database model into a format that
 * the user's browser can easily display while keeping internal
 * database implementation details hidden from the public API.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class SessionResponse {

    private Long id;
    private LocalDateTime startTime;
    private LocalDateTime endTime;
    private String title;
    private String notes;
    private SessionStatus status;
    private FocusCategory classification;
    private Double averageConfidence;
    private List<Double> focusScores;
    private Integer deepFocusDuration;
    private Integer partialDistractionDuration;
    private Integer absentDuration;
    private Integer maxFocusSeconds;
    private Integer maxDistractionSeconds;
    private Integer maxAbsentSeconds;
    private String longestFocusPeriod;
    private String longestDistractionPeriod;
    private String longestAbsentPeriod;

    public static SessionResponse from(StudySession s) {
        List<Double> scores = s.getFocusScores() == null
                ? List.of()
                : new ArrayList<>(s.getFocusScores());

        return SessionResponse.builder()
                .id(s.getId())
                .startTime(s.getStartTime())
                .endTime(s.getEndTime())
                .title(s.getTitle())
                .notes(s.getNotes())
                .status(s.getStatus())
                .classification(s.getClassification())
                .averageConfidence(s.getAverageConfidence())
                .focusScores(scores)
                .deepFocusDuration(nz(s.getDeepFocusDuration()))
                .partialDistractionDuration(nz(s.getPartialDistractionDuration()))
                .absentDuration(nz(s.getAbsentDuration()))
                .maxFocusSeconds(nz(s.getMaxFocusSeconds()))
                .maxDistractionSeconds(nz(s.getMaxDistractionSeconds()))
                .maxAbsentSeconds(nz(s.getMaxAbsentSeconds()))
                .longestFocusPeriod(s.getLongestFocusPeriod())
                .longestDistractionPeriod(s.getLongestDistractionPeriod())
                .longestAbsentPeriod(s.getLongestAbsentPeriod())
                .build();
    }

    private static Integer nz(Integer v) {
        return v == null ? 0 : v;
    }
}
