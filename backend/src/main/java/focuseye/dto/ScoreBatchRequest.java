package focuseye.dto;

import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

/**
 * Request body for POST /api/sessions/{id}/scores. Carries one entry per
 * scored ~1s window in the batch, in capture order.
 */
@Data
@NoArgsConstructor
public class ScoreBatchRequest {

    private String username;
    private List<Entry> entries;

    @Data
    @NoArgsConstructor
    public static class Entry {
        private double score;
        private String type; // DEEP_FOCUS | PARTIAL | ABSENT (see FocusCategory.fromString)
    }
}