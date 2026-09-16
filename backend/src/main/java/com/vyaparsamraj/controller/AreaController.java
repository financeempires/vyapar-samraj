package com.vyaparsamraj.controller;

import com.vyaparsamraj.dto.ApiResponse;
import com.vyaparsamraj.entity.Area;
import com.vyaparsamraj.exception.UnauthorizedException;
import com.vyaparsamraj.security.AppUserPrincipal;
import com.vyaparsamraj.service.AreaService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/areas")
@RequiredArgsConstructor
public class AreaController {

    private final AreaService areaService;

    private UUID getAuthenticatedUserId() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth == null || !auth.isAuthenticated() || !(auth.getPrincipal() instanceof AppUserPrincipal principal)) {
            throw new UnauthorizedException("Authenticated session required");
        }
        UUID ownerId = principal.getOwnerId();
        if (ownerId == null) {
            return principal.getId();
        }
        return ownerId;
    }

    @GetMapping
    public ResponseEntity<ApiResponse<Map<String, List<Area>>>> getAreas() {
        UUID userId = getAuthenticatedUserId();
        List<Area> areas = areaService.getAreas(userId);
        return ResponseEntity.ok(ApiResponse.ok(Map.of("areas", areas)));
    }

    @PostMapping
    public ResponseEntity<ApiResponse<Map<String, Area>>> createArea(@RequestBody Map<String, Object> body) {
        UUID userId = getAuthenticatedUserId();
        String name = body.get("name") != null ? String.valueOf(body.get("name")) : null;
        String section = body.get("section") != null ? String.valueOf(body.get("section")) : null;

        Area area = areaService.createArea(userId, name, section);
        return ResponseEntity.status(HttpStatus.CREATED).body(ApiResponse.ok(Map.of("area", area)));
    }

    @PatchMapping
    public ResponseEntity<ApiResponse<Map<String, Area>>> updateAreaMarked(@RequestBody Map<String, Object> body) {
        UUID userId = getAuthenticatedUserId();
        Object rawId = body.get("area_id") != null ? body.get("area_id") : body.get("id");
        if (rawId == null || String.valueOf(rawId).trim().isEmpty()) {
            throw new IllegalArgumentException("area_id is required");
        }
        UUID areaId = UUID.fromString(String.valueOf(rawId).trim());
        Boolean explicitMarked = body.get("is_marked") instanceof Boolean ? (Boolean) body.get("is_marked") : null;

        Area area = areaService.updateAreaMarked(userId, areaId, explicitMarked);
        return ResponseEntity.ok(ApiResponse.ok(Map.of("area", area)));
    }
}
