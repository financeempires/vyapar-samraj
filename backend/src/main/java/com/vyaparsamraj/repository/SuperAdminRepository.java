package com.vyaparsamraj.repository;

import com.vyaparsamraj.entity.SuperAdminAccount;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface SuperAdminRepository extends JpaRepository<SuperAdminAccount, UUID> {
    Optional<SuperAdminAccount> findByUsername(String username);
    Optional<SuperAdminAccount> findByUsernameIgnoreCase(String username);
    Optional<SuperAdminAccount> findByEmail(String email);
    Optional<SuperAdminAccount> findByEmailIgnoreCase(String email);
    boolean existsByUsername(String username);

    @Query(value = "SELECT CASE WHEN (password_hash = crypt(:password, password_hash)) THEN true ELSE false END FROM super_admin_accounts WHERE id = :id", nativeQuery = true)
    Boolean checkPgcryptoPassword(@Param("id") UUID id, @Param("password") String password);
}
