package com.vyaparsamraj.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.util.UUID;

public record ResetPasswordRequest(
    @NotNull(message = "Challenge ID is required")
    UUID challengeId,

    @NotBlank(message = "OTP is required")
    @Size(min = 6, max = 6, message = "OTP must be 6 digits")
    String otp,

    @NotBlank(message = "New password is required")
    @Size(min = 6, max = 128, message = "Password must be at least 6 characters")
    String newPassword
) {}
