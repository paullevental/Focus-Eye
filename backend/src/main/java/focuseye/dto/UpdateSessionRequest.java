package focuseye.dto;

import jakarta.validation.constraints.Size;
import lombok.Data;

/** Body of a session edit (PUT): optional title and notes, both length-limited. */
@Data
public class UpdateSessionRequest {
    @Size(max = 120, message = "Title must be at most 120 characters.")
    private String title;

    @Size(max = 2000, message = "Notes must be at most 2000 characters.")
    private String notes;
}
