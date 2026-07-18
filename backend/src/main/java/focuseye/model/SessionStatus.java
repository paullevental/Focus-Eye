package focuseye.model;

/** Lifecycle state of a session. Allowed transitions are enforced in SessionService. */
public enum SessionStatus {
    ACTIVE,
    PAUSED,
    COMPLETED
}
