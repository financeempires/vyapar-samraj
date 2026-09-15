package com.vyaparsamraj.controller;

import com.vyaparsamraj.dto.ApiResponse;
import com.vyaparsamraj.security.AppUserPrincipal;
import com.vyaparsamraj.service.SubUserService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/sub-users")
@RequiredArgsConstructor
public class SubUserController {

    private final SubUserService subUserService;

    @GetMapping
    public ResponseEntity<ApiResponse<Object>> list(
            @AuthenticationPrincipal AppUserPrincipal p,
            @RequestParam(defaultValue = "1") int page,
            @RequestParam(name = "parent_id", required = false) String parentId) {
        return ResponseEntity.ok(ApiResponse.ok(subUserService.listSubUsers(p, page, parentId)));
    }

    @PostMapping
    public ResponseEntity<ApiResponse<Object>> create(
            @AuthenticationPrincipal AppUserPrincipal p,
            @RequestBody Map<String, Object> req) {
        return ResponseEntity.status(201).body(ApiResponse.ok(subUserService.createSubUser(p, req)));
    }

    @GetMapping("/{id}")
    public ResponseEntity<ApiResponse<Object>> get(
            @AuthenticationPrincipal AppUserPrincipal p,
            @PathVariable UUID id) {
        return ResponseEntity.ok(ApiResponse.ok(subUserService.getSubUser(p, id)));
    }

    @PatchMapping("/{id}")
    public ResponseEntity<ApiResponse<Object>> update(
            @AuthenticationPrincipal AppUserPrincipal p,
            @PathVariable UUID id,
            @RequestBody Map<String, Object> req) {
        return ResponseEntity.ok(ApiResponse.ok(subUserService.updateSubUser(p, id, req)));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<ApiResponse<Object>> delete(
            @AuthenticationPrincipal AppUserPrincipal p,
            @PathVariable UUID id) {
        subUserService.deleteSubUser(p, id);
        return ResponseEntity.ok(ApiResponse.ok(Map.of("deleted", true, "id", id)));
    }
}
