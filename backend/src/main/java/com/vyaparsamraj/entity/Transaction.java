package com.vyaparsamraj.entity;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.UuidGenerator;
import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.UUID;

@Entity
@Table(name = "transactions")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class Transaction {

    @Id @GeneratedValue @UuidGenerator
    @Column(columnDefinition = "uuid", updatable = false, nullable = false)
    private UUID id;

    @Column(name = "user_id", nullable = false)
    private UUID userId;

    @Column(name = "organization_id")
    private UUID organizationId;

    @Column(nullable = false, precision = 14, scale = 2)
    private BigDecimal amount;

    @org.hibernate.annotations.JdbcTypeCode(org.hibernate.type.SqlTypes.CHAR)
    @Column(nullable = false, length = 3)
    private String currency;

    /** tx_type ENUM: payment, refund, adjustment */
    @Column(columnDefinition = "tx_type", nullable = false)
    @Enumerated(EnumType.STRING)
    private TxType type;

    /** tx_status ENUM: pending, completed, failed, refunded */
    @Column(columnDefinition = "tx_status", nullable = false)
    @Enumerated(EnumType.STRING)
    private TxStatus status;

    @Column
    private String description;

    @Column(name = "reference_id")
    private String referenceId;

    @Column(name = "created_at", nullable = false, updatable = false)
    private OffsetDateTime createdAt;

    @Column(name = "updated_at", nullable = false)
    private OffsetDateTime updatedAt;

    @PrePersist
    void onCreate() {
        if (currency == null) currency = "INR";
        if (status == null) status = TxStatus.pending;
        createdAt = updatedAt = OffsetDateTime.now();
    }

    @PreUpdate void onUpdate() { updatedAt = OffsetDateTime.now(); }

    public enum TxType   { payment, refund, adjustment }
    public enum TxStatus { pending, completed, failed, refunded }
}
