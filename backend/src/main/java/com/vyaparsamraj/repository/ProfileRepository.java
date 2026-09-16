package com.vyaparsamraj.repository;

import com.vyaparsamraj.entity.Profile;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface ProfileRepository extends JpaRepository<Profile, UUID> {

    Optional<Profile> findByUsername(String username);
    Optional<Profile> findByUsernameIgnoreCase(String username);
    Optional<Profile> findByEmailIgnoreCase(String email);
    boolean existsByUsernameOrEmail(String username, String email);

    Page<Profile> findAll(Pageable pageable);

    @Query("""
        SELECT p FROM Profile p
        WHERE (:search IS NULL OR LOWER(p.username) LIKE LOWER(CONCAT('%', :search, '%'))
               OR LOWER(p.fullName) LIKE LOWER(CONCAT('%', :search, '%'))
               OR LOWER(p.email) LIKE LOWER(CONCAT('%', :search, '%')))
        ORDER BY p.createdAt DESC
        """)
    Page<Profile> searchProfiles(
            @Param("search") String search,
            Pageable pageable);

    // Sub-users by parent
    Page<Profile> findByRoleAndParentId(Profile.UserRole role, UUID parentId, Pageable pageable);
    Page<Profile> findByRole(Profile.UserRole role, Pageable pageable);
    long countByRole(Profile.UserRole role);
    long countByRoleAndParentId(Profile.UserRole role, UUID parentId);

    // Dashboard stats
    long countByStatus(Profile.UserStatus status);
}
