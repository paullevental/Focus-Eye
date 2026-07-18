package focuseye.model;

import com.fasterxml.jackson.annotation.JsonValue;

/**
 * The three focus states. Sends the friendly label ("Deep Focus") over the wire;
 * when reading a value back it accepts the label or the enum name and falls back
 * to ABSENT if nothing matches.
 */
public enum FocusCategory {
    DEEP_FOCUS("Deep Focus"),
    PARTIAL_DISTRACTION("Partial Distraction"),
    ABSENT("Absent");

    private final String label;

    FocusCategory(String label) {
        this.label = label;
    }

    @JsonValue
    public String getLabel() {
        return label;
    }

    public static FocusCategory fromString(String text) {
        for (FocusCategory b : FocusCategory.values()) {
            if (b.label.equalsIgnoreCase(text) || b.name().equalsIgnoreCase(text)) {
                return b;
            }
        }
        return ABSENT; // Default fallback
    }
}
