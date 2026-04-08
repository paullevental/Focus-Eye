package focuseye.repository;

import focuseye.model.StudySession;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;

public interface StudySessionRepository extends JpaRepository<StudySession, Long> {
    // Spring Data JPA magic: This automatically generates the SQL to find sessions by username
    List<StudySession> findByUserUsernameOrderByStartTimeDesc(String username);
}
