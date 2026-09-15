package com.vyaparsamraj.entity;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.UuidGenerator;
import java.time.OffsetDateTime;
import java.util.UUID;

@Entity
@Table(name = "subscriptions")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class Subscription {

    @Id @GeneratedValue @UuidGenerator
    @Column(columnDefinition = "uuid", updatable = false, nullable = false)
    private UUID id;

    @Column(name = "user_id", nullable = false)
    private UUID userId;

    @Column(name = "plan_id", nullable = false)
    private UUID planId;

    @org.hibernate.annotations.JdbcTypeCode(org.hibernate.type.SqlTypes.DATE)
    @Column(name = "start_date", nullable = false)
    private OffsetDateTime startDate;

    @org.hibernate.annotations.JdbcTypeCode(org.hibernate.type.SqlTypes.DATE)
    @Column(name = "end_date", nullable = false)
    private OffsetDateTime endDate;

    /** sub_status ENUM: active, expired, cancelled, pending */
    @Column(columnDefinition = "sub_status", nullable = false)
    @Enumerated(EnumType.STRING)
    private SubStatus status;

    @Column(name = "auto_renewal", nullable = false)
    private Boolean autoRenewal;

    @Column(name = "created_at", nullable = false, updatable = false)
    private OffsetDateTime createdAt;

    @Column(name = "updated_at", nullable = false)
    private OffsetDateTime updatedAt;

    @PrePersist
    void onCreate() {
        if (status == null) status = SubStatus.pending;
        if (autoRenewal == null) autoRenewal = false;
        createdAt = updatedAt = OffsetDateTime.now();
    }

    @PreUpdate void onUpdate() { updatedAt = OffsetDateTime.now(); }

    public enum SubStatus { active, expired, cancelled, pending }
}
