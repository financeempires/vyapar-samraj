package com.vyaparsamraj.controller;

import com.vyaparsamraj.dto.ApiResponse;
import com.vyaparsamraj.security.AppUserPrincipal;
import com.vyaparsamraj.service.NotificationService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/notifications")
@RequiredArgsConstructor
public class NotificationController {

    private final NotificationService notificationService;

    @GetMapping
    public ResponseEntity<ApiResponse<Object>> list(
            @AuthenticationPrincipal AppUserPrincipal p) {
        return ResponseEntity.ok(ApiResponse.ok(
                Map.of("notifications", notificationService.list(p))));
    }

    @PatchMapping("/{id}/read")
    public ResponseEntity<ApiResponse<Object>> markRead(
            @AuthenticationPrincipal AppUserPrincipal p,
            @PathVariable UUID id) {
        return ResponseEntity.ok(ApiResponse.ok(notificationService.markRead(p, id)));
    }
}
