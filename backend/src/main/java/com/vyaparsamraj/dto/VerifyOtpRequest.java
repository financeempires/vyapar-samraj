package com.vyaparsamraj.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import java.util.UUID;

public record VerifyOtpRequest(
    @NotNull(message = "Challenge ID is required")
    UUID challengeId,

    @NotBlank(message = "OTP code is required")
    String otp
) {}
