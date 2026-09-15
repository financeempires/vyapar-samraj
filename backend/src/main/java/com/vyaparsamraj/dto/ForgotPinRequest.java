package com.vyaparsamraj.dto;

import jakarta.validation.constraints.NotNull;
import java.util.UUID;

public record ForgotPinRequest(
    @NotNull(message = "Challenge ID is required")
    UUID challengeId
) {}
