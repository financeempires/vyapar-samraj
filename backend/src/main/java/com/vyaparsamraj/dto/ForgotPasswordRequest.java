package com.vyaparsamraj.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record ForgotPasswordRequest(
    @NotBlank(message = "Username is required")
    @Size(max = 50)
    String username
) {}
