package focuseye.model;

import com.fasterxml.jackson.annotation.JsonValue;

/**
 * Defines the possible focus states for a user.
 * Each category represents a different level of attention,
 * allowing the system to classify and track how much time
 * a user spends in deep focus versus distracted states.
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
