package com.vyaparsamraj.entity;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.UuidGenerator;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.UUID;

@Entity
@Table(name = "customers")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Customer {

    @Id
    @GeneratedValue
    @UuidGenerator
    @Column(columnDefinition = "uuid", updatable = false, nullable = false)
    private UUID id;

    @Column(name = "user_id", nullable = false)
    private UUID userId;

    @Column(name = "area_id", nullable = false)
    private UUID areaId;

    @Column(nullable = false)
    private String section;

    @Column(nullable = false)
    private String name;

    @Column(nullable = false)
    private String phone;

    @Column(name = "phone_number")
    private String phoneNumber;

    @Column(name = "photo_url")
    private String photoUrl;

    @Column(name = "serial_number")
    private Integer serialNumber;

    @Column
    private String address;

    @Column
    private BigDecimal latitude;

    @Column
    private BigDecimal longitude;

    @Column(name = "alternative_number")
    private String alternativeNumber;

    @Column(name = "referral_name")
    private String referralName;

    @Column(name = "referral_number")
    private String referralNumber;

    @Column(name = "given_amount")
    private BigDecimal givenAmount;

    @Column(name = "interest_amount")
    private BigDecimal interestAmount;

    @Column(name = "total_amount")
    private BigDecimal totalAmount;

    @Column(name = "installment_amount", nullable = false)
    private BigDecimal installmentAmount;

    @Column(name = "given_date")
    private LocalDate givenDate;

    @Column(name = "last_date")
    private LocalDate lastDate;

    @Column(name = "notes_taken", nullable = false)
    @Builder.Default
    private Boolean notesTaken = false;

    @Column(name = "cheque_taken", nullable = false)
    @Builder.Default
    private Boolean chequeTaken = false;

    @Column
    private String notes;

    @Column(name = "cheque_details")
    private String chequeDetails;

    @Column(name = "verified_by_user_id")
    private UUID verifiedByUserId;

    @Column(name = "verified_by_name")
    private String verifiedByName;

    @Column(name = "verified_by_email")
    private String verifiedByEmail;

    @Column(name = "verified_at")
    private OffsetDateTime verifiedAt;

    @Column(name = "additional_details")
    private String additionalDetails;

    @Column(name = "is_marked", nullable = false)
    @Builder.Default
    private Boolean isMarked = false;

    @Column(name = "is_flagged", nullable = false)
    @Builder.Default
    private Boolean isFlagged = false;

    @Column(name = "given_payment_method")
    @Builder.Default
    private String givenPaymentMethod = "Cash";

    @Column(name = "duration_type")
    @Builder.Default
    private String durationType = "weeks";

    @Column
    @Builder.Default
    private String status = "ACTIVE";

    @Column(name = "created_at", nullable = false, updatable = false)
    private OffsetDateTime createdAt;

    @Column(name = "updated_at", nullable = false)
    private OffsetDateTime updatedAt;

    @PrePersist
    void onCreate() {
        if (notesTaken == null) notesTaken = false;
        if (chequeTaken == null) chequeTaken = false;
        if (isMarked == null) isMarked = false;
        if (isFlagged == null) isFlagged = false;
        if (givenPaymentMethod == null) givenPaymentMethod = "Cash";
        if (durationType == null) durationType = "weeks";
        if (status == null) status = "ACTIVE";
        createdAt = updatedAt = OffsetDateTime.now();
    }

    @PreUpdate
    void onUpdate() {
        updatedAt = OffsetDateTime.now();
    }
}
