package com.vyaparsamraj.dto;

public record LoginResponse(
    boolean success,
    boolean requireOtp,
    String challengeId,
    String maskedEmail,
    String message,
    boolean requirePin
) {
    public LoginResponse(boolean success, boolean requireOtp, String challengeId, String maskedEmail, String message) {
        this(success, requireOtp, challengeId, maskedEmail, message, false);
    }
}
