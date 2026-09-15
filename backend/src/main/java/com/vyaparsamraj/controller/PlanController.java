package com.vyaparsamraj.controller;

import com.vyaparsamraj.dto.ApiResponse;
import com.vyaparsamraj.security.AppUserPrincipal;
import com.vyaparsamraj.service.PlanService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/plans")
@RequiredArgsConstructor
public class PlanController {

    private final PlanService planService;

    @GetMapping
    public ResponseEntity<ApiResponse<Object>> list(
            @AuthenticationPrincipal AppUserPrincipal p,
            @RequestParam(defaultValue = "1") int page) {
        return ResponseEntity.ok(ApiResponse.ok(planService.list(p, page)));
    }

    @PostMapping
    public ResponseEntity<ApiResponse<Object>> create(
            @AuthenticationPrincipal AppUserPrincipal p,
            @RequestBody Map<String, Object> req) {
        return ResponseEntity.status(201).body(ApiResponse.ok(planService.create(p, req)));
    }

    @GetMapping("/{id}")
    public ResponseEntity<ApiResponse<Object>> get(
            @AuthenticationPrincipal AppUserPrincipal p,
            @PathVariable UUID id) {
        return ResponseEntity.ok(ApiResponse.ok(planService.get(p, id)));
    }

    @PatchMapping("/{id}")
    public ResponseEntity<ApiResponse<Object>> update(
            @AuthenticationPrincipal AppUserPrincipal p,
            @PathVariable UUID id,
            @RequestBody Map<String, Object> req) {
        return ResponseEntity.ok(ApiResponse.ok(planService.update(p, id, req)));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<ApiResponse<Object>> delete(
            @AuthenticationPrincipal AppUserPrincipal p,
            @PathVariable UUID id) {
        planService.delete(p, id);
        return ResponseEntity.ok(ApiResponse.ok(Map.of("deleted", true, "id", id)));
    }
}
