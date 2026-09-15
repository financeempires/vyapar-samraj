package com.vyaparsamraj.controller;

import com.vyaparsamraj.dto.ApiResponse;
import com.vyaparsamraj.security.AppUserPrincipal;
import com.vyaparsamraj.service.DashboardService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.annotation.Secured;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/super-admin")
@RequiredArgsConstructor
public class DashboardController {

    private final DashboardService dashboardService;

    /** GET /api/super-admin/dashboard — SUPER_ADMIN only */
    @GetMapping("/dashboard")
    @Secured("ROLE_SUPER_ADMIN")
    public ResponseEntity<ApiResponse<Object>> dashboard(
            @AuthenticationPrincipal AppUserPrincipal principal) {
        return ResponseEntity.ok(ApiResponse.ok(dashboardService.getDashboardStats()));
    }
}
