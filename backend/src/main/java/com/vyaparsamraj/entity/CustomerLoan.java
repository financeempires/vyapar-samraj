package com.vyaparsamraj.entity;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.UuidGenerator;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.UUID;

@Entity
@Table(name = "customer_loans")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class CustomerLoan {

    @Id
    @GeneratedValue
    @UuidGenerator
    @Column(columnDefinition = "uuid", updatable = false, nullable = false)
    private UUID id;

    @Column(name = "customer_id", nullable = false)
    private UUID customerId;

    @Column(name = "user_id", nullable = false)
    private UUID userId;

    @Column(name = "given_amount", nullable = false)
    @Builder.Default
    private BigDecimal givenAmount = BigDecimal.ZERO;

    @Column(name = "interest_amount", nullable = false)
    @Builder.Default
    private BigDecimal interestAmount = BigDecimal.ZERO;

    @Column(name = "total_amount", nullable = false)
    @Builder.Default
    private BigDecimal totalAmount = BigDecimal.ZERO;

    @Column(name = "installment_amount", nullable = false)
    @Builder.Default
    private BigDecimal installmentAmount = BigDecimal.ZERO;

    @Column(name = "given_date", nullable = false)
    private LocalDate givenDate;

    @Column(name = "last_date", nullable = false)
    private LocalDate lastDate;

    @Column(name = "referral_name")
    private String referralName;

    @Column(name = "referral_number")
    private String referralNumber;

    @Column(name = "notes_taken")
    @Builder.Default
    private Boolean notesTaken = false;

    @Column(name = "cheque_taken")
    @Builder.Default
    private Boolean chequeTaken = false;

    @Column(name = "additional_details")
    private String additionalDetails;

    @Column
    @Builder.Default
    private String status = "ACTIVE";

    @Column(name = "refinanced_from_loan_id")
    private UUID refinancedFromLoanId;

    @Column(name = "created_at", nullable = false, updatable = false)
    private OffsetDateTime createdAt;

    @Column(name = "updated_at", nullable = false)
    private OffsetDateTime updatedAt;

    @PrePersist
    void onCreate() {
        if (givenAmount == null) givenAmount = BigDecimal.ZERO;
        if (interestAmount == null) interestAmount = BigDecimal.ZERO;
        if (totalAmount == null) totalAmount = BigDecimal.ZERO;
        if (installmentAmount == null) installmentAmount = BigDecimal.ZERO;
        if (notesTaken == null) notesTaken = false;
        if (chequeTaken == null) chequeTaken = false;
        if (status == null) status = "ACTIVE";
        createdAt = updatedAt = OffsetDateTime.now();
    }

    @PreUpdate
    void onUpdate() {
        updatedAt = OffsetDateTime.now();
    }
}
