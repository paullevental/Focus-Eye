package focuseye.dto;

import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.Size;
import java.util.List;

public class LandmarkSequence {

    /**
     * The LSTM model expects exactly 30 frames for a single prediction.
     * Each frame contains 468 landmarks (x, y, z).
     */
    @NotEmpty(message = "The landmark sequence cannot be empty.")
    @Size(min = 30, max = 30, message = "The sequence must contain exactly 30 frames for LSTM prediction.")
    private List<List<Float>> frames;

    public List<List<Float>> getFrames() {
        return frames;
    }

    public void setFrames(List<List<Float>> frames) {
        this.frames = frames;
    }
}
