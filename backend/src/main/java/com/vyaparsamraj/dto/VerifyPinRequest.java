package com.vyaparsamraj.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

public record VerifyPinRequest(
    @NotNull(message = "Challenge ID is required")
    String challengeId,

    @NotBlank(message = "PIN is required")
    String pin
) {}
