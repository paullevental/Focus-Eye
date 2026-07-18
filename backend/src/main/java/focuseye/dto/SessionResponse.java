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
 * What the API returns for a session. Maps the entity to a browser-friendly
 * shape and hides internal DB details, so the schema can change without
 * breaking the API.
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
