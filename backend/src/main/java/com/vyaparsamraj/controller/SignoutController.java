package com.vyaparsamraj.controller;

import com.vyaparsamraj.dto.ApiResponse;
import com.vyaparsamraj.security.AppUserPrincipal;
import com.vyaparsamraj.service.AuthService;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

/** GET /api/auth/signout — legacy compatibility with the Next.js signout route */
@RestController
@RequestMapping("/api/auth")
@RequiredArgsConstructor
public class SignoutController {

    private final AuthService authService;

    @GetMapping("/signout")
    public ResponseEntity<ApiResponse<Void>> signout(
            HttpServletResponse response) {
        authService.logout(response);
        return ResponseEntity.ok(ApiResponse.ok(null));
    }

    @PostMapping("/signout")
    public ResponseEntity<ApiResponse<Void>> signoutPost(HttpServletResponse response) {
        authService.logout(response);
        return ResponseEntity.ok(ApiResponse.ok(null));
    }
}
