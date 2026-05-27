package focuseye.repository;

import focuseye.model.SessionStatus;
import focuseye.model.StudySession;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Collection;
import java.util.List;
import java.util.Optional;

/**
 * Interface for database operations on study sessions.
 * It provides methods to retrieve sessions by username, 
 * find active sessions, and ensure that users can only
 * access and modify their own focus data.
 */
public interface StudySessionRepository extends JpaRepository<StudySession, Long> {

    List<StudySession> findByUserUsernameOrderByStartTimeDesc(String username);

    Optional<StudySession> findFirstByUserUsernameAndStatusIn(
            String username, Collection<SessionStatus> statuses);

    Optional<StudySession> findByIdAndUserUsername(Long id, String username);
}
