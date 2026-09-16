package com.vyaparsamraj.dto;

import com.fasterxml.jackson.annotation.JsonInclude;

@JsonInclude(JsonInclude.Include.NON_NULL)
public record LoginResponse(
    boolean success,
    boolean requireOtp,
    String challengeId,
    String maskedEmail,
    String message,
    boolean requirePin,
    String token,
    String role,
    String redirectTo,
    Object user
) {
    public LoginResponse(boolean success, boolean requireOtp, String challengeId, String maskedEmail, String message) {
        this(success, requireOtp, challengeId, maskedEmail, message, false, null, null, null, null);
    }

    public static LoginResponse superAdminOtp(String challengeId, String maskedEmail) {
        return new LoginResponse(true, true, challengeId, maskedEmail, "OTP sent to " + maskedEmail, false, null, "SUPER_ADMIN", null, null);
    }

    public static LoginResponse superAdminPinRequired(String challengeId) {
        return new LoginResponse(true, false, challengeId, null, "PIN verification required", true, null, "SUPER_ADMIN", null, null);
    }

    public static LoginResponse superAdminSuccess(String token, String message) {
        return new LoginResponse(true, false, null, null, message, false, token, "SUPER_ADMIN", "/super-admin/dashboard", null);
    }

    public static LoginResponse userSuccess(String token, String role, String username, String fullName) {
        String target;
        if ("SUPER_ADMIN".equalsIgnoreCase(role)) {
            target = "/super-admin/dashboard";
        } else if ("SUB_USER".equalsIgnoreCase(role)) {
            target = "/sub-user/dashboard";
        } else {
            target = "/dashboard";
        }
        return new LoginResponse(true, false, null, null, "Login successful", false, token, role, target, 
                java.util.Map.of("username", username, "fullName", fullName, "role", role));
    }
}
