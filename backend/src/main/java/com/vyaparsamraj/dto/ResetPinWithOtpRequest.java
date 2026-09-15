package com.vyaparsamraj.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import java.util.UUID;

public record ResetPinWithOtpRequest(
    @NotNull(message = "Challenge ID is required")
    UUID challengeId,

    @NotBlank(message = "PIN is required")
    @Pattern(regexp = "^\\d{4,6}$", message = "PIN must be 4 to 6 numeric digits")
    String pin,

    @NotBlank(message = "Confirm PIN is required")
    String confirmPin
) {}
