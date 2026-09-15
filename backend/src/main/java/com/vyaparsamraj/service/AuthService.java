package com.vyaparsamraj.service;

import com.vyaparsamraj.audit.AuditLogger;
import com.vyaparsamraj.dto.ForgotPinRequest;
import com.vyaparsamraj.dto.ForgotPasswordRequest;
import com.vyaparsamraj.dto.LoginRequest;
import com.vyaparsamraj.dto.LoginResponse;
import com.vyaparsamraj.dto.ResendOtpRequest;
import com.vyaparsamraj.dto.ResetPasswordRequest;
import com.vyaparsamraj.dto.ResetPinWithOtpRequest;
import com.vyaparsamraj.dto.SetPinRequest;
import com.vyaparsamraj.dto.VerifyOtpRequest;
import com.vyaparsamraj.dto.VerifyPinRequest;
import com.vyaparsamraj.dto.VerifyPreviousPinRequest;
import com.vyaparsamraj.entity.OtpChallenge;
import com.vyaparsamraj.entity.SuperAdminAccount;
import com.vyaparsamraj.exception.UnauthorizedException;
import com.vyaparsamraj.repository.OtpChallengeRepository;
import com.vyaparsamraj.repository.SuperAdminRepository;
import com.vyaparsamraj.security.JwtTokenProvider;
import com.vyaparsamraj.security.LoginRateLimiter;
import jakarta.servlet.http.Cookie;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import java.time.OffsetDateTime;
import java.util.UUID;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.security.SecureRandom;
import java.time.OffsetDateTime;

@Slf4j
@Service
@RequiredArgsConstructor
public class AuthService {

    private final SuperAdminRepository superAdminRepo;
    private final OtpChallengeRepository otpChallengeRepo;
    private final PasswordEncoder passwordEncoder;
    private final JwtTokenProvider jwtTokenProvider;
    private final LoginRateLimiter rateLimiter;
    private final AuditLogger auditLogger;
    private final EmailService emailService;

    private static final SecureRandom SECURE_RANDOM = new SecureRandom();

    @Value("${app.jwt.cookie-name:sa_session}")
    private String cookieName;

    @Value("${spring.profiles.active:default}")
    private String activeProfile;

    /**
     * Step 1 of Super Admin 2FA Login:
     * Verifies username + password. If valid, generates secure 6-digit OTP,
     * stores OTP hash in database, emails OTP, and requires OTP verification.
     * DOES NOT issue session cookie yet.
     */
    @Transactional
    public LoginResponse login(LoginRequest req, HttpServletRequest request, HttpServletResponse response) {
        String ip = getClientIp(request);
        rateLimiter.checkLimit(ip);

        String cleanUsername = req.username() != null ? req.username().trim() : "";
        String cleanPassword = req.password() != null ? req.password() : "";

        log.info("[AuthService Debug] Searching for Super Admin account with identifier: {}", cleanUsername);

        SuperAdminAccount account = superAdminRepo.findByUsername(cleanUsername)
                .or(() -> superAdminRepo.findByUsernameIgnoreCase(cleanUsername))
                .or(() -> superAdminRepo.findByEmailIgnoreCase(cleanUsername))
                .orElse(null);

        if (account == null) {
            log.warn("[AuthService Debug] Super Admin account found: false");
            auditLogger.log("LOGIN_FAILED",
                    "Failed login attempt for username: " + cleanUsername, null);
            throw new UnauthorizedException("Invalid username or password");
        }

        log.info("[AuthService Debug] Super Admin account found: true");

        String hashFormat = account.getPasswordHash() != null && account.getPasswordHash().startsWith("$2") ? "BCrypt" : "Other";
        log.info("[AuthService Debug] Password hash format: {}", hashFormat);

        // SOLE authentication source: BCrypt verification against the database password_hash.
        // There is no fallback, no second source, no alternative verification path.
        boolean isPasswordValid = passwordEncoder.matches(cleanPassword, account.getPasswordHash());

        log.info("[AuthService Debug] Password verification result: {}", isPasswordValid);

        if (!isPasswordValid) {
            auditLogger.log("LOGIN_FAILED",
                    "Failed login attempt for username: " + cleanUsername, null);
            throw new UnauthorizedException("Invalid username or password");
        }

        // Generate 6-digit cryptographically secure OTP
        String otpCode = String.format("%06d", SECURE_RANDOM.nextInt(1_000_000));
        String otpHash = passwordEncoder.encode(otpCode);

        // Save OTP challenge with 5-minute expiration
        OtpChallenge challenge = OtpChallenge.builder()
                .superAdminId(account.getId())
                .otpHash(otpHash)
                .attemptCount(0)
                .used(false)
                .expiresAt(OffsetDateTime.now().plusMinutes(5))
                .build();

        otpChallengeRepo.save(challenge);

        // Deliver OTP email
        emailService.sendOtpEmail(account.getEmail(), otpCode);

        return new LoginResponse(
                true,
                true,
                challenge.getId().toString(),
                maskEmail(account.getEmail()),
                "OTP verification required"
        );
    }

    /**
     * Step 2 of Super Admin 2FA Login:
     * Verifies OTP code against stored challenge hash.
     * Creates session & issues HttpOnly cookie ONLY AFTER valid OTP verification.
     */
    @Transactional
    public LoginResponse verifyOtp(VerifyOtpRequest req, HttpServletResponse response) {
        OtpChallenge challenge = otpChallengeRepo.findByIdAndUsedFalse(req.challengeId())
                .orElseThrow(() -> new UnauthorizedException("Invalid or expired OTP challenge"));

        if (challenge.getExpiresAt().isBefore(OffsetDateTime.now())) {
            throw new UnauthorizedException("OTP expired. Please request a new code.");
        }

        if (challenge.getAttemptCount() >= 5) {
            challenge.setUsed(true);
            otpChallengeRepo.save(challenge);
            throw new UnauthorizedException("Maximum verification attempts exceeded. Please log in again.");
        }

        challenge.setAttemptCount(challenge.getAttemptCount() + 1);

        if (!passwordEncoder.matches(req.otp(), challenge.getOtpHash())) {
            otpChallengeRepo.save(challenge);
            throw new UnauthorizedException("Invalid OTP code");
        }

        // Fetch Super Admin Account
        SuperAdminAccount account = superAdminRepo.findById(challenge.getSuperAdminId())
                .orElseThrow(() -> new UnauthorizedException("Super admin account not found"));

        // Check if PIN is configured for this Super Admin account
        if (account.getPinHash() != null && !account.getPinHash().isBlank()) {
            // Keep OTP challenge active for PIN step with reset attempt count
            challenge.setAttemptCount(0);
            otpChallengeRepo.save(challenge);

            auditLogger.log("OTP_VERIFIED_PIN_REQUIRED",
                    "Super admin " + account.getUsername() + " verified OTP, PIN verification required",
                    account.getId().toString());

            return new LoginResponse(true, false, challenge.getId().toString(), null, "PIN verification required", true);
        }

        // Mark OTP challenge as used if no PIN is configured
        challenge.setUsed(true);
        otpChallengeRepo.save(challenge);

        account.setLastLoginAt(OffsetDateTime.now());
        superAdminRepo.save(account);

        // Issue JWT token and HttpOnly session cookie
        String token = jwtTokenProvider.generateToken(
                account.getId(), account.getUsername(),
                account.getFullName(), "SUPER_ADMIN");

        setSessionCookie(response, token);

        auditLogger.log("LOGIN",
                "Super admin " + account.getUsername() + " completed 2FA login",
                account.getId().toString());

        emailService.sendLoginNotification(account.getEmail(), account.getFullName());

        return new LoginResponse(true, false, null, null, "Authentication successful", false);
    }

    /**
     * Resends a new OTP for an active challenge (rate limited to 1 per 30 seconds).
     */
    @Transactional
    public LoginResponse resendOtp(ResendOtpRequest req) {
        OtpChallenge oldChallenge = otpChallengeRepo.findById(req.challengeId())
                .orElseThrow(() -> new UnauthorizedException("Invalid OTP challenge"));

        if (OffsetDateTime.now().isBefore(oldChallenge.getCreatedAt().plusSeconds(30))) {
            throw new UnauthorizedException("Please wait 30 seconds before requesting another OTP.");
        }

        // Invalidate old challenge
        oldChallenge.setUsed(true);
        otpChallengeRepo.save(oldChallenge);

        SuperAdminAccount account = superAdminRepo.findById(oldChallenge.getSuperAdminId())
                .orElseThrow(() -> new UnauthorizedException("Super admin account not found"));

        // Generate new OTP
        String newOtpCode = String.format("%06d", SECURE_RANDOM.nextInt(1_000_000));
        String newOtpHash = passwordEncoder.encode(newOtpCode);

        OtpChallenge newChallenge = OtpChallenge.builder()
                .superAdminId(account.getId())
                .otpHash(newOtpHash)
                .attemptCount(0)
                .used(false)
                .expiresAt(OffsetDateTime.now().plusMinutes(5))
                .build();

        otpChallengeRepo.save(newChallenge);

        emailService.sendOtpEmail(account.getEmail(), newOtpCode);

        return new LoginResponse(
                true,
                true,
                newChallenge.getId().toString(),
                maskEmail(account.getEmail()),
                "New OTP sent to your email"
        );
    }

    public void logout(HttpServletResponse response) {
        response.addHeader("Set-Cookie",
                cookieName + "=; Path=/; HttpOnly; Max-Age=0; SameSite=Lax"
                + ("prod".equals(activeProfile) ? "; Secure" : ""));
    }

    private void setSessionCookie(HttpServletResponse response, String token) {
        Cookie cookie = new Cookie(cookieName, token);
        cookie.setHttpOnly(true);
        cookie.setPath("/");
        cookie.setMaxAge((int)(jwtTokenProvider.getExpirationMs() / 1000));
        cookie.setSecure("prod".equals(activeProfile));

        response.addHeader("Set-Cookie",
                cookieName + "=" + token
                + "; Path=/; HttpOnly"
                + "; Max-Age=" + (jwtTokenProvider.getExpirationMs() / 1000)
                + "; SameSite=Lax"
                + ("prod".equals(activeProfile) ? "; Secure" : ""));
    }

    private String maskEmail(String email) {
        if (email == null || !email.contains("@")) return "******@domain.com";
        String[] parts = email.split("@");
        String name = parts[0];
        String domain = parts[1];
        if (name.length() <= 2) {
            return name.charAt(0) + "***@" + domain;
        }
        return name.charAt(0) + "*****" + name.charAt(name.length() - 1) + "@" + domain;
    }

    private String getClientIp(HttpServletRequest request) {
        String forwarded = request.getHeader("X-Forwarded-For");
        return (forwarded != null && !forwarded.isBlank())
                ? forwarded.split(",")[0].trim()
                : request.getRemoteAddr();
    }

    /**
     * Step 1 of Super Admin Forgot Password:
     * Queries Neon PostgreSQL super_admin_accounts table for the entered username.
     * If found, generates 6-digit OTP, stores challenge, and sends email to DB-stored email.
     */
    @Transactional
    public LoginResponse forgotPassword(ForgotPasswordRequest req) {
        String cleanUsername = req.username() != null ? req.username().trim() : "";

        SuperAdminAccount account = superAdminRepo.findByUsername(cleanUsername)
                .or(() -> superAdminRepo.findByUsernameIgnoreCase(cleanUsername))
                .or(() -> superAdminRepo.findByEmailIgnoreCase(cleanUsername))
                .orElse(null);

        if (account == null) {
            auditLogger.log("FORGOT_PASSWORD_FAILED",
                    "Forgot password attempt for non-existent username: " + cleanUsername, null);
            throw new UnauthorizedException("Username not found");
        }

        // Generate 6-digit cryptographically secure OTP
        String otpCode = String.format("%06d", SECURE_RANDOM.nextInt(1_000_000));
        String otpHash = passwordEncoder.encode(otpCode);

        OtpChallenge challenge = OtpChallenge.builder()
                .superAdminId(account.getId())
                .otpHash(otpHash)
                .attemptCount(0)
                .used(false)
                .expiresAt(OffsetDateTime.now().plusMinutes(5))
                .build();

        otpChallengeRepo.save(challenge);

        // Deliver OTP to email stored ONLY in Neon super_admin_accounts
        emailService.sendForgotPasswordOtpEmail(account.getEmail(), otpCode);

        auditLogger.log("FORGOT_PASSWORD_OTP_SENT",
                "Forgot password OTP sent to: " + maskEmail(account.getEmail()),
                account.getId().toString());

        return new LoginResponse(
                true,
                true,
                challenge.getId().toString(),
                maskEmail(account.getEmail()),
                "OTP sent to your registered email"
        );
    }

    /**
     * Step 2 of Super Admin Forgot Password:
     * Verifies OTP code against stored challenge hash.
     * Validates OTP and returns success without setting session or resetting password yet.
     */
    @Transactional
    public LoginResponse verifyResetOtp(VerifyOtpRequest req) {
        OtpChallenge challenge = otpChallengeRepo.findByIdAndUsedFalse(req.challengeId())
                .orElseThrow(() -> new UnauthorizedException("Invalid or expired OTP code"));

        if (challenge.getExpiresAt().isBefore(OffsetDateTime.now())) {
            throw new UnauthorizedException("OTP expired. Please request a new code.");
        }

        if (challenge.getAttemptCount() >= 5) {
            challenge.setUsed(true);
            otpChallengeRepo.save(challenge);
            throw new UnauthorizedException("Maximum verification attempts exceeded. Please try again.");
        }

        challenge.setAttemptCount(challenge.getAttemptCount() + 1);

        if (!passwordEncoder.matches(req.otp(), challenge.getOtpHash())) {
            otpChallengeRepo.save(challenge);
            throw new UnauthorizedException("Invalid OTP code");
        }

        otpChallengeRepo.save(challenge);

        return new LoginResponse(
                true,
                false,
                challenge.getId().toString(),
                null,
                "OTP verified successfully"
        );
    }

    /**
     * Step 3 of Super Admin Forgot Password:
     * Validates OTP one last time, updates password_hash in Neon DB with BCrypt hash,
     * invalidates OTP challenge, and forces manual login.
     */
    @Transactional
    public LoginResponse resetPassword(ResetPasswordRequest req) {
        OtpChallenge challenge = otpChallengeRepo.findByIdAndUsedFalse(req.challengeId())
                .orElseThrow(() -> new UnauthorizedException("Invalid or expired OTP challenge"));

        if (challenge.getExpiresAt().isBefore(OffsetDateTime.now())) {
            throw new UnauthorizedException("OTP expired. Please restart the password reset process.");
        }

        if (!passwordEncoder.matches(req.otp(), challenge.getOtpHash())) {
            throw new UnauthorizedException("Invalid OTP code");
        }

        SuperAdminAccount account = superAdminRepo.findById(challenge.getSuperAdminId())
                .orElseThrow(() -> new UnauthorizedException("Super admin account not found"));

        if (req.newPassword() == null || req.newPassword().length() < 6) {
            throw new UnauthorizedException("New password must be at least 6 characters");
        }

        // Generate BCrypt password hash using existing backend PasswordEncoder
        String newPasswordHash = passwordEncoder.encode(req.newPassword());

        // Update ONLY password_hash field of the Super Admin account in Neon
        account.setPasswordHash(newPasswordHash);
        superAdminRepo.save(account);

        // Invalidate/delete the forgot-password OTP challenge so it CANNOT be reused
        challenge.setUsed(true);
        otpChallengeRepo.save(challenge);

        auditLogger.log("PASSWORD_RESET_SUCCESS",
                "Super admin password reset successfully for username: " + account.getUsername(),
                account.getId().toString());

        return new LoginResponse(
                true,
                false,
                null,
                null,
                "Password updated successfully. Please log in with your new password."
        );
    }

    /**
     * Verifies Super Admin PIN code after valid OTP verification.
     * Sets HttpOnly session cookie ONLY AFTER valid PIN verification against Neon database pin_hash.
     */
    @Transactional
    public LoginResponse verifyPin(VerifyPinRequest req, HttpServletResponse response) {
        UUID challengeId;
        try {
            challengeId = UUID.fromString(req.challengeId());
        } catch (IllegalArgumentException e) {
            throw new UnauthorizedException("Invalid challenge identifier");
        }

        OtpChallenge challenge = otpChallengeRepo.findByIdAndUsedFalse(challengeId)
                .orElseThrow(() -> new UnauthorizedException("Invalid or expired PIN verification challenge"));

        if (challenge.getExpiresAt().isBefore(OffsetDateTime.now())) {
            throw new UnauthorizedException("Session expired. Please log in again.");
        }

        if (challenge.getAttemptCount() >= 5) {
            challenge.setUsed(true);
            otpChallengeRepo.save(challenge);
            throw new UnauthorizedException("Maximum PIN verification attempts exceeded. Please log in again.");
        }

        challenge.setAttemptCount(challenge.getAttemptCount() + 1);

        SuperAdminAccount account = superAdminRepo.findById(challenge.getSuperAdminId())
                .orElseThrow(() -> new UnauthorizedException("Super admin account not found"));

        if (account.getPinHash() == null || account.getPinHash().isBlank()) {
            throw new UnauthorizedException("No PIN configured for this account");
        }

        // Verify PIN hash using BCrypt encoder
        if (!passwordEncoder.matches(req.pin(), account.getPinHash())) {
            otpChallengeRepo.save(challenge);
            throw new UnauthorizedException("Incorrect PIN. Access denied.");
        }

        // Mark OTP/PIN challenge as used
        challenge.setUsed(true);
        otpChallengeRepo.save(challenge);

        account.setLastLoginAt(OffsetDateTime.now());
        superAdminRepo.save(account);

        // Issue JWT token and HttpOnly session cookie
        String token = jwtTokenProvider.generateToken(
                account.getId(), account.getUsername(),
                account.getFullName(), "SUPER_ADMIN");

        setSessionCookie(response, token);

        auditLogger.log("PIN_LOGIN_SUCCESS",
                "Super admin " + account.getUsername() + " verified PIN and completed authentication",
                account.getId().toString());

        emailService.sendLoginNotification(account.getEmail(), account.getFullName());

        return new LoginResponse(true, false, null, null, "PIN verified successfully. Welcome!", false);
    }

    /**
     * Verifies the previous PIN for the currently authenticated Super Admin.
     * Returns true if previous PIN matches stored pin_hash (or if no PIN set yet).
     */
    @Transactional(readOnly = true)
    public boolean verifyPreviousPin(VerifyPreviousPinRequest req, UUID superAdminId) {
        log.info("[PIN DIAGNOSTIC] verifyPreviousPin requested for superAdminId: {}", superAdminId);

        SuperAdminAccount account = superAdminRepo.findById(superAdminId)
                .orElseThrow(() -> new UnauthorizedException("Super admin account not found"));

        String storedPinHash = account.getPinHash();
        boolean hasPin = storedPinHash != null && !storedPinHash.isBlank();
        log.info("[PIN DIAGNOSTIC] SuperAdmin account found. pinHashPresent: {}", hasPin);

        if (!hasPin) {
            log.info("[PIN DIAGNOSTIC] No PIN configured yet for this account.");
            return true;
        }

        if (req == null || req.previousPin() == null || req.previousPin().isBlank()) {
            throw new UnauthorizedException("Previous PIN is required");
        }

        boolean matches = passwordEncoder.matches(req.previousPin(), storedPinHash);
        log.info("[PIN DIAGNOSTIC] BCrypt matches result: {}", matches);

        if (!matches) {
            throw new UnauthorizedException("Incorrect Previous PIN. Please try again.");
        }

        return true;
    }

    /**
     * Sets or updates PIN for the currently authenticated Super Admin account.
     * Validates previous PIN if a PIN is already configured.
     * Stores hashed PIN ONLY in super_admin_accounts.pin_hash.
     */
    @Transactional
    public void setPin(SetPinRequest req, UUID superAdminId) {
        log.info("[PIN DIAGNOSTIC] setPin requested for superAdminId: {}", superAdminId);

        if (req == null || req.pin() == null || req.confirmPin() == null || !req.pin().equals(req.confirmPin())) {
            throw new UnauthorizedException("New PIN and confirmation PIN do not match");
        }

        if (!req.pin().matches("^\\d{4,6}$")) {
            throw new UnauthorizedException("PIN must be 4 to 6 numeric digits");
        }

        SuperAdminAccount account = superAdminRepo.findById(superAdminId)
                .orElseThrow(() -> new UnauthorizedException("Super admin account not found"));

        String storedPinHash = account.getPinHash();
        boolean hasPin = storedPinHash != null && !storedPinHash.isBlank();

        if (hasPin) {
            if (req.previousPin() == null || req.previousPin().isBlank()) {
                throw new UnauthorizedException("Previous PIN verification is required before setting a new PIN");
            }
            boolean prevMatches = passwordEncoder.matches(req.previousPin(), storedPinHash);
            log.info("[PIN DIAGNOSTIC] setPin previous PIN match result: {}", prevMatches);
            if (!prevMatches) {
                throw new UnauthorizedException("Incorrect Previous PIN. Security PIN was not updated.");
            }
        }

        String hashedPin = passwordEncoder.encode(req.pin());
        account.setPinHash(hashedPin);
        superAdminRepo.save(account);

        log.info("[PIN DIAGNOSTIC] super_admin_accounts.pin_hash successfully updated in Neon DB!");

        auditLogger.log("SET_PIN_SUCCESS",
                "Super admin " + account.getUsername() + " updated PIN successfully",
                account.getId().toString());
    }

    /**
     * Step 1 of Super Admin Forgot PIN:
     * Resolves account from verified login challenge, generates 6-digit OTP,
     * and sends OTP email to DB-stored email.
     */
    @Transactional
    public LoginResponse forgotPin(ForgotPinRequest req) {
        OtpChallenge oldChallenge = otpChallengeRepo.findById(req.challengeId())
                .orElseThrow(() -> new UnauthorizedException("Invalid authentication challenge session"));

        SuperAdminAccount account = superAdminRepo.findById(oldChallenge.getSuperAdminId())
                .orElseThrow(() -> new UnauthorizedException("Super admin account not found"));

        String otpCode = String.format("%06d", SECURE_RANDOM.nextInt(1_000_000));
        String otpHash = passwordEncoder.encode(otpCode);

        OtpChallenge newChallenge = OtpChallenge.builder()
                .superAdminId(account.getId())
                .otpHash(otpHash)
                .attemptCount(0)
                .used(false)
                .expiresAt(OffsetDateTime.now().plusMinutes(5))
                .build();

        otpChallengeRepo.save(newChallenge);

        emailService.sendPinResetOtpEmail(account.getEmail(), otpCode);

        auditLogger.log("FORGOT_PIN_OTP_SENT",
                "PIN Reset OTP sent to: " + maskEmail(account.getEmail()),
                account.getId().toString());

        return new LoginResponse(
                true,
                true,
                newChallenge.getId().toString(),
                maskEmail(account.getEmail()),
                "PIN reset OTP sent to your registered email"
        );
    }

    /**
     * Step 2 of Super Admin Forgot PIN:
     * Verifies PIN reset OTP against stored challenge hash.
     */
    @Transactional
    public LoginResponse verifyPinResetOtp(VerifyOtpRequest req) {
        OtpChallenge challenge = otpChallengeRepo.findByIdAndUsedFalse(req.challengeId())
                .orElseThrow(() -> new UnauthorizedException("Invalid or expired OTP code"));

        if (challenge.getExpiresAt().isBefore(OffsetDateTime.now())) {
            throw new UnauthorizedException("OTP expired. Please request a new PIN reset code.");
        }

        if (challenge.getAttemptCount() >= 5) {
            challenge.setUsed(true);
            otpChallengeRepo.save(challenge);
            throw new UnauthorizedException("Maximum verification attempts exceeded. Please try again.");
        }

        challenge.setAttemptCount(challenge.getAttemptCount() + 1);

        if (!passwordEncoder.matches(req.otp(), challenge.getOtpHash())) {
            otpChallengeRepo.save(challenge);
            throw new UnauthorizedException("Invalid OTP code");
        }

        challenge.setUsed(true);
        otpChallengeRepo.save(challenge);

        OtpChallenge resetChallenge = OtpChallenge.builder()
                .superAdminId(challenge.getSuperAdminId())
                .otpHash(challenge.getOtpHash())
                .attemptCount(0)
                .used(false)
                .expiresAt(OffsetDateTime.now().plusMinutes(5))
                .build();

        otpChallengeRepo.save(resetChallenge);

        return new LoginResponse(
                true,
                false,
                resetChallenge.getId().toString(),
                null,
                "OTP verified successfully. You may now enter a new Security PIN."
        );
    }

    /**
     * Step 3 of Super Admin Forgot PIN:
     * Updates super_admin_accounts.pin_hash with new BCrypt hash.
     */
    @Transactional
    public void resetPinWithOtp(ResetPinWithOtpRequest req) {
        if (req == null || req.pin() == null || req.confirmPin() == null || !req.pin().equals(req.confirmPin())) {
            throw new UnauthorizedException("New PIN and confirmation PIN do not match");
        }

        if (!req.pin().matches("^\\d{4,6}$")) {
            throw new UnauthorizedException("PIN must be 4 to 6 numeric digits");
        }

        OtpChallenge challenge = otpChallengeRepo.findByIdAndUsedFalse(req.challengeId())
                .orElseThrow(() -> new UnauthorizedException("Invalid or expired PIN reset session"));

        if (challenge.getExpiresAt().isBefore(OffsetDateTime.now())) {
            throw new UnauthorizedException("PIN reset session expired. Please request a new OTP.");
        }

        challenge.setUsed(true);
        otpChallengeRepo.save(challenge);

        SuperAdminAccount account = superAdminRepo.findById(challenge.getSuperAdminId())
                .orElseThrow(() -> new UnauthorizedException("Super admin account not found"));

        String hashedPin = passwordEncoder.encode(req.pin());
        account.setPinHash(hashedPin);
        superAdminRepo.save(account);

        log.info("[PIN DIAGNOSTIC] Security PIN reset via OTP successfully updated in Neon DB!");

        auditLogger.log("RESET_PIN_SUCCESS",
                "Super admin " + account.getUsername() + " reset Security PIN via OTP successfully",
                account.getId().toString());
    }
}
