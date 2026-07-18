package focuseye.repository;

import focuseye.model.SessionStatus;
import focuseye.model.StudySession;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Collection;
import java.util.List;
import java.util.Optional;

/**
 * Database access for study sessions. Spring writes each query from the method
 * name. findByIdAndUserUsername is the ownership check used on every mutation.
 */
public interface StudySessionRepository extends JpaRepository<StudySession, Long> {

    List<StudySession> findByUserUsernameOrderByStartTimeDesc(String username);

    Optional<StudySession> findFirstByUserUsernameAndStatusIn(
            String username, Collection<SessionStatus> statuses);

    Optional<StudySession> findByIdAndUserUsername(Long id, String username);
}
