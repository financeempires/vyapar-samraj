package com.vyaparsamraj.controller;

import com.vyaparsamraj.dto.*;
import com.vyaparsamraj.entity.Profile;
import com.vyaparsamraj.security.AppUserPrincipal;
import com.vyaparsamraj.service.UserService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import java.util.UUID;

@RestController
@RequestMapping("/api/users")
@RequiredArgsConstructor
public class UserController {

    private final UserService userService;

    @GetMapping
    public ResponseEntity<ApiResponse<Object>> list(
            @AuthenticationPrincipal AppUserPrincipal p,
            @RequestParam(defaultValue = "1") int page,
            @RequestParam(required = false) String search,
            @RequestParam(required = false) String status) {
        return ResponseEntity.ok(ApiResponse.ok(userService.listUsers(p, page, search, status)));
    }

    @PostMapping
    public ResponseEntity<ApiResponse<Profile>> create(
            @AuthenticationPrincipal AppUserPrincipal p,
            @Valid @RequestBody CreateUserRequest req) {
        return ResponseEntity.status(201).body(ApiResponse.ok(userService.createUser(p, req)));
    }

    @GetMapping("/{id}")
    public ResponseEntity<ApiResponse<Object>> get(
            @AuthenticationPrincipal AppUserPrincipal p,
            @PathVariable UUID id) {
        return ResponseEntity.ok(ApiResponse.ok(userService.getUser(p, id)));
    }

    @PatchMapping("/{id}")
    public ResponseEntity<ApiResponse<Profile>> update(
            @AuthenticationPrincipal AppUserPrincipal p,
            @PathVariable UUID id,
            @RequestBody UpdateUserRequest req) {
        return ResponseEntity.ok(ApiResponse.ok(userService.updateUser(p, id, req)));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<ApiResponse<Object>> delete(
            @AuthenticationPrincipal AppUserPrincipal p,
            @PathVariable UUID id) {
        userService.deleteUser(p, id);
        return ResponseEntity.ok(ApiResponse.ok(java.util.Map.of("deleted", true, "id", id)));
    }
}
