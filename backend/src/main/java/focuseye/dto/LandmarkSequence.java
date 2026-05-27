package focuseye.dto;

import com.fasterxml.jackson.annotation.JsonIgnore;
import jakarta.validation.constraints.AssertTrue;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.Size;
import lombok.Data;
import lombok.NoArgsConstructor;
import java.util.List;
import java.util.Objects;

/**
 * Represents a collection of facial landmarks for AI processing.
 * It ensures that the sequence contains exactly 30 frames,
 * which is the specific requirement for the LSTM model
 * to perform an accurate focus prediction.
 */
@Data
@NoArgsConstructor
public class LandmarkSequence {

    public static final int FEATURES_PER_FRAME = 468 * 3; // 1404

    /**
     * The LSTM model expects exactly 30 frames for a single prediction.
     * Each frame contains 468 landmarks (x, y, z) — 1404 floats total.
     */
    @NotEmpty(message = "The landmark sequence cannot be empty.")
    @Size(min = 30, max = 30, message = "The sequence must contain exactly 30 frames for LSTM prediction.")
    private List<List<Float>> frames;

    @JsonIgnore
    @AssertTrue(message = "Each frame must contain exactly 1404 floats (468 landmarks × 3 coords).")
    public boolean isFrameSizeValid() {
        if (frames == null) return false;
        return frames.stream()
                .filter(Objects::nonNull)
                .allMatch(f -> f.size() == FEATURES_PER_FRAME);
    }
}
