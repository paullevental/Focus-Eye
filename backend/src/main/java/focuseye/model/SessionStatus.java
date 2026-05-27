package focuseye.model;

/**
 * Represents the current lifecycle state of a study session. 
 * A session can be active, paused for a break, or completed,
 * providing a way to manage focus tracking and ensure 
 * data is only recorded when appropriate.
 */
public enum SessionStatus {
    ACTIVE,
    PAUSED,
    COMPLETED
}
