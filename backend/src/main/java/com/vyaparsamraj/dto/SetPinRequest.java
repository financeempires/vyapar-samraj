package com.vyaparsamraj.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;

public record SetPinRequest(
    String previousPin,

    @NotBlank(message = "PIN is required")
    @Pattern(regexp = "^\\d{4,6}$", message = "PIN must be 4 to 6 digits")
    String pin,

    @NotBlank(message = "Confirm PIN is required")
    String confirmPin
) {}
