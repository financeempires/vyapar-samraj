package com.vyaparsamraj.controller;

import com.vyaparsamraj.dto.ApiResponse;
import com.vyaparsamraj.dto.ForgotPinRequest;
import com.vyaparsamraj.dto.ForgotPasswordRequest;
import com.vyaparsamraj.dto.LoginRequest;
import com.vyaparsamraj.dto.LoginResponse;
import com.vyaparsamraj.dto.ResendOtpRequest;
import com.vyaparsamraj.dto.ResetPasswordRequest;
import com.vyaparsamraj.dto.ResetPinWithOtpRequest;
import com.vyaparsamraj.dto.VerifyOtpRequest;
import com.vyaparsamraj.dto.SetPinRequest;
import com.vyaparsamraj.dto.VerifyPinRequest;
import com.vyaparsamraj.dto.VerifyPreviousPinRequest;
import com.vyaparsamraj.exception.ForbiddenException;
import com.vyaparsamraj.exception.UnauthorizedException;
import com.vyaparsamraj.security.AppUserPrincipal;
import com.vyaparsamraj.service.AuthService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/auth/super-admin")
@RequiredArgsConstructor
public class AuthController {

    private final AuthService authService;

    /** POST /api/auth/super-admin/login */
    @PostMapping("/login")
    public ResponseEntity<ApiResponse<LoginResponse>> login(
            @Valid @RequestBody LoginRequest req,
            HttpServletRequest request,
            HttpServletResponse response) {
        LoginResponse res = authService.login(req, request, response);
        return ResponseEntity.ok(ApiResponse.ok(res));
    }

    /** POST /api/auth/super-admin/verify-otp */
    @PostMapping("/verify-otp")
    public ResponseEntity<ApiResponse<LoginResponse>> verifyOtp(
            @Valid @RequestBody VerifyOtpRequest req,
            HttpServletResponse response) {
        LoginResponse res = authService.verifyOtp(req, response);
        return ResponseEntity.ok(ApiResponse.ok(res));
    }

    /** POST /api/auth/super-admin/resend-otp */
    @PostMapping("/resend-otp")
    public ResponseEntity<ApiResponse<LoginResponse>> resendOtp(
            @Valid @RequestBody ResendOtpRequest req) {
        LoginResponse res = authService.resendOtp(req);
        return ResponseEntity.ok(ApiResponse.ok(res));
    }

    /** POST /api/auth/super-admin/forgot-password */
    @PostMapping("/forgot-password")
    public ResponseEntity<ApiResponse<LoginResponse>> forgotPassword(
            @Valid @RequestBody ForgotPasswordRequest req) {
        LoginResponse res = authService.forgotPassword(req);
        return ResponseEntity.ok(ApiResponse.ok(res));
    }

    /** POST /api/auth/super-admin/verify-reset-otp */
    @PostMapping("/verify-reset-otp")
    public ResponseEntity<ApiResponse<LoginResponse>> verifyResetOtp(
            @Valid @RequestBody VerifyOtpRequest req) {
        LoginResponse res = authService.verifyResetOtp(req);
        return ResponseEntity.ok(ApiResponse.ok(res));
    }

    /** POST /api/auth/super-admin/reset-password */
    @PostMapping("/reset-password")
    public ResponseEntity<ApiResponse<LoginResponse>> resetPassword(
            @Valid @RequestBody ResetPasswordRequest req) {
        LoginResponse res = authService.resetPassword(req);
        return ResponseEntity.ok(ApiResponse.ok(res));
    }

    /** POST /api/auth/super-admin/verify-pin */
    @PostMapping("/verify-pin")
    public ResponseEntity<ApiResponse<LoginResponse>> verifyPin(
            @Valid @RequestBody VerifyPinRequest req,
            HttpServletResponse response) {
        LoginResponse res = authService.verifyPin(req, response);
        return ResponseEntity.ok(ApiResponse.ok(res));
    }

    /** POST /api/auth/super-admin/forgot-pin */
    @PostMapping("/forgot-pin")
    public ResponseEntity<ApiResponse<LoginResponse>> forgotPin(
            @Valid @RequestBody ForgotPinRequest req) {
        LoginResponse res = authService.forgotPin(req);
        return ResponseEntity.ok(ApiResponse.ok(res));
    }

    /** POST /api/auth/super-admin/verify-pin-reset-otp */
    @PostMapping("/verify-pin-reset-otp")
    public ResponseEntity<ApiResponse<LoginResponse>> verifyPinResetOtp(
            @Valid @RequestBody VerifyOtpRequest req) {
        LoginResponse res = authService.verifyPinResetOtp(req);
        return ResponseEntity.ok(ApiResponse.ok(res));
    }

    /** POST /api/auth/super-admin/reset-pin */
    @PostMapping("/reset-pin")
    public ResponseEntity<ApiResponse<String>> resetPinWithOtp(
            @Valid @RequestBody ResetPinWithOtpRequest req) {
        authService.resetPinWithOtp(req);
        return ResponseEntity.ok(ApiResponse.ok("Security PIN reset successfully"));
    }

    /** POST /api/auth/super-admin/verify-previous-pin */
    @PostMapping("/verify-previous-pin")
    public ResponseEntity<ApiResponse<String>> verifyPreviousPin(
            @Valid @RequestBody VerifyPreviousPinRequest req) {

        Authentication auth = SecurityContextHolder.getContext().getAuthentication();

        if (auth == null || !auth.isAuthenticated() || !(auth.getPrincipal() instanceof AppUserPrincipal principal)) {
            throw new UnauthorizedException("Authenticated Super Admin session required");
        }

        if (!principal.isSuperAdmin()) {
            throw new ForbiddenException("Super Admin privilege required");
        }

        authService.verifyPreviousPin(req, principal.getId());
        return ResponseEntity.ok(ApiResponse.ok("Previous PIN verified successfully"));
    }

    /** POST /api/auth/super-admin/set-pin */
    @PostMapping("/set-pin")
    public ResponseEntity<ApiResponse<String>> setPin(
            @Valid @RequestBody SetPinRequest req) {

        Authentication auth = SecurityContextHolder.getContext().getAuthentication();

        if (auth == null || !auth.isAuthenticated() || !(auth.getPrincipal() instanceof AppUserPrincipal principal)) {
            throw new UnauthorizedException("Authenticated Super Admin session required");
        }

        if (!principal.isSuperAdmin()) {
            throw new ForbiddenException("Super Admin privilege required");
        }

        authService.setPin(req, principal.getId());
        return ResponseEntity.ok(ApiResponse.ok("PIN updated successfully"));
    }

    /** POST /api/auth/super-admin/logout */
    @PostMapping("/logout")
    public ResponseEntity<ApiResponse<Void>> logout(HttpServletResponse response) {
        authService.logout(response);
        return ResponseEntity.ok(ApiResponse.ok(null));
    }
}
