package com.vyaparsamraj.controller;

import com.vyaparsamraj.dto.ApiResponse;
import com.vyaparsamraj.dto.LoginRequest;
import com.vyaparsamraj.dto.LoginResponse;
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

import java.util.LinkedHashMap;
import java.util.Map;

@RestController
@RequestMapping("/api/auth")
@RequiredArgsConstructor
public class UserAuthController {

    private final AuthService authService;

    @PostMapping("/login")
    public ResponseEntity<ApiResponse<LoginResponse>> login(
            @Valid @RequestBody LoginRequest req,
            HttpServletRequest request,
            HttpServletResponse response) {
        LoginResponse res = authService.login(req, request, response);
        return ResponseEntity.ok(ApiResponse.ok(res));
    }

    @GetMapping("/session")
    public ResponseEntity<ApiResponse<Map<String, Object>>> getSession() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth == null || !auth.isAuthenticated() || !(auth.getPrincipal() instanceof AppUserPrincipal principal)) {
            throw new UnauthorizedException("Authenticated session required");
        }

        Map<String, Object> user = new LinkedHashMap<>();
        user.put("id", principal.getId());
        user.put("username", principal.getUsername());
        user.put("fullName", principal.getFullName());
        user.put("role", principal.getRole());
        user.put("parentId", principal.getParentId());
        user.put("ownerId", principal.getOwnerId());

        return ResponseEntity.ok(ApiResponse.ok(Map.of("user", user)));
    }

    @GetMapping("/me")
    public ResponseEntity<ApiResponse<Map<String, Object>>> getMe() {
        return getSession();
    }

    @PostMapping("/signout")
    public ResponseEntity<ApiResponse<Map<String, Boolean>>> signout(HttpServletResponse response) {
        authService.logout(response);
        return ResponseEntity.ok(ApiResponse.ok(Map.of("success", true)));
    }

    @GetMapping("/signout")
    public ResponseEntity<ApiResponse<Map<String, Boolean>>> signoutGet(HttpServletResponse response) {
        authService.logout(response);
        return ResponseEntity.ok(ApiResponse.ok(Map.of("success", true)));
    }

    @PostMapping("/logout")
    public ResponseEntity<ApiResponse<Map<String, Boolean>>> logout(HttpServletResponse response) {
        authService.logout(response);
        return ResponseEntity.ok(ApiResponse.ok(Map.of("success", true)));
    }
}
