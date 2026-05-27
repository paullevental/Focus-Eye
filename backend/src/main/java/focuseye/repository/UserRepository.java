package focuseye.repository;

import focuseye.model.User;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.Optional;

/**
 * Interface for database operations on users. 
 * It allows the application to find user records by their unique 
 * username, facilitating user identification and session 
 * management across the entire platform.
 */
public interface UserRepository extends JpaRepository<User, Long> {
    Optional<User> findByUsername(String username);
}
