package focuseye.repository;

import focuseye.model.User;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.Optional;

/** Database access for users. Spring writes the query from the method name. */
public interface UserRepository extends JpaRepository<User, Long> {
    Optional<User> findByUsername(String username);
}
