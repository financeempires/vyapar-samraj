package com.vyaparsamraj.entity;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.JdbcType;
import org.hibernate.annotations.UuidGenerator;
import org.hibernate.dialect.PostgreSQLEnumJdbcType;
import java.time.OffsetDateTime;
import java.util.UUID;

@Entity
@Table(name = "profiles")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class Profile {

    @Id
    @GeneratedValue
    @UuidGenerator
    @Column(columnDefinition = "uuid", updatable = false, nullable = false)
    private UUID id;

    @Column(nullable = false, unique = true)
    private String username;

    @Column(nullable = false, unique = true)
    private String email;

    @Column(name = "full_name", nullable = false)
    private String fullName;

    /** user_role ENUM: SUPER_ADMIN, USER, SUB_USER */
    @Column(columnDefinition = "user_role", nullable = false)
    @Enumerated(EnumType.STRING)
    @JdbcType(PostgreSQLEnumJdbcType.class)
    private UserRole role;

    /** user_status ENUM: active, inactive, pending, expired */
    @Column(columnDefinition = "user_status", nullable = false)
    @Enumerated(EnumType.STRING)
    @JdbcType(PostgreSQLEnumJdbcType.class)
    private UserStatus status;

    @Column
    private String organization;

    @Column(name = "parent_id")
    private UUID parentId;

    @Column(name = "created_at", nullable = false, updatable = false)
    private OffsetDateTime createdAt;

    @Column(name = "updated_at", nullable = false)
    private OffsetDateTime updatedAt;

    @PrePersist
    void onCreate() {
        if (role   == null) role   = UserRole.USER;
        if (status == null) status = UserStatus.pending;
        createdAt = updatedAt = OffsetDateTime.now();
    }

    @PreUpdate
    void onUpdate() { updatedAt = OffsetDateTime.now(); }

    // ── Enums matching PostgreSQL types ─────────────────────────────────────
    public enum UserRole   { SUPER_ADMIN, USER, SUB_USER }
    public enum UserStatus { active, inactive, pending, expired, paused }
}
