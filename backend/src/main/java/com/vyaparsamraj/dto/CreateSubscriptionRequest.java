package com.vyaparsamraj.dto;

import com.vyaparsamraj.entity.Subscription;
import jakarta.validation.constraints.*;
import java.time.OffsetDateTime;
import java.util.UUID;

public record CreateSubscriptionRequest(
    @NotNull UUID userId,
    @NotNull UUID planId,
    @NotNull OffsetDateTime startDate,
    @NotNull OffsetDateTime endDate,
    Subscription.SubStatus status,
    Boolean autoRenewal
) {}
