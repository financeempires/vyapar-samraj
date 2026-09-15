package com.vyaparsamraj.dto;

import jakarta.validation.constraints.NotBlank;

public record VerifyPreviousPinRequest(
    @NotBlank(message = "Previous PIN is required")
    String previousPin
) {}
