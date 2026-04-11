package focuseye.repository;

import focuseye.model.StudySession;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import java.time.LocalDateTime;
import java.util.List;

public interface StudySessionRepository extends JpaRepository<StudySession, Long> {
    
    // Find sessions by username ordered by start time
    List<StudySession> findByUserUsernameOrderByStartTimeDesc(String username);

    // Filter by minimum deep focus duration
    @Query("SELECT s FROM StudySession s WHERE s.user.username = :username AND s.deepFocusDuration >= :minDuration ORDER BY s.deepFocusDuration DESC")
    List<StudySession> findHighFocusSessions(@Param("username") String username, @Param("minDuration") Integer minDuration);

    // Filter by date range
    @Query("SELECT s FROM StudySession s WHERE s.user.username = :username AND s.startTime BETWEEN :start AND :end ORDER BY s.startTime DESC")
    List<StudySession> findSessionsByDateRange(
        @Param("username") String username, 
        @Param("start") LocalDateTime start, 
        @Param("end") LocalDateTime end
    );

    // Get summary statistics for a user
    @Query("SELECT AVG(s.deepFocusDuration), AVG(s.partialDistractionDuration), AVG(s.absentDuration) " +
           "FROM StudySession s WHERE s.user.username = :username")
    List<Object[]> getUserAverages(@Param("username") String username);
}
