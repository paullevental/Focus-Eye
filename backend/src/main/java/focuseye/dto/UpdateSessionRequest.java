package focuseye.dto;

import jakarta.validation.constraints.Size;
import lombok.Data;

/**
 * A data object used for updating existing study session details. 
 * It contains validated fields for the session title and notes,
 * allowing the frontend to send user modifications for 
 * persistent storage in the database.
 */
@Data
public class UpdateSessionRequest {
    @Size(max = 120, message = "Title must be at most 120 characters.")
    private String title;

    @Size(max = 2000, message = "Notes must be at most 2000 characters.")
    private String notes;
}
