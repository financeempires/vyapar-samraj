package com.vyaparsamraj.service;

import com.vyaparsamraj.audit.AuditLogger;
import com.vyaparsamraj.entity.*;
import com.vyaparsamraj.exception.*;
import com.vyaparsamraj.repository.*;
import com.vyaparsamraj.security.AppUserPrincipal;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.*;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.util.*;

@Service
@RequiredArgsConstructor
public class SubUserService {

    private final ProfileRepository profileRepo;
    private final AuditLogger auditLogger;

    public Map<String, Object> listSubUsers(AppUserPrincipal principal, int page, String parentIdParam) {
        if (principal.isSubUser()) throw new ForbiddenException();

        Pageable pageable = PageRequest.of(page - 1, 50, Sort.by("createdAt").descending());
        Page<Profile> result;

        if (principal.isSuperAdmin()) {
            UUID pid = (parentIdParam != null && !parentIdParam.isBlank())
                    ? UUID.fromString(parentIdParam) : null;
            result = (pid != null)
                    ? profileRepo.findByRoleAndParentId(Profile.UserRole.SUB_USER, pid, pageable)
                    : profileRepo.findByRole(Profile.UserRole.SUB_USER, pageable);
        } else {
            // USER: only their own sub-users
            result = profileRepo.findByRoleAndParentId(
                    Profile.UserRole.SUB_USER, principal.getId(), pageable);
        }

        return Map.of("subUsers", result.getContent(),
                "pagination", Map.of("page", page, "pageSize", 50, "total", result.getTotalElements()));
    }

    @Transactional
    public Profile createSubUser(AppUserPrincipal principal, Map<String, Object> req) {
        if (principal.isSubUser()) throw new ForbiddenException();

        String username = (String) req.get("username");
        String email    = (String) req.get("email");
        String fullName = (String) req.get("fullName");
        String parentIdStr = (String) req.get("parent_id");

        if (username == null || email == null || parentIdStr == null)
            throw new IllegalArgumentException("username, email, and parent_id are required");

        UUID parentId = UUID.fromString(parentIdStr);

        // USER can only create sub-users under themselves
        if (!principal.isSuperAdmin() && !principal.getId().equals(parentId))
            throw new ForbiddenException("Cannot create sub-users under another user");

        // Verify parent is a USER
        Profile parent = profileRepo.findById(parentId)
                .filter(p -> p.getRole() == Profile.UserRole.USER)
                .orElseThrow(() -> new ResourceNotFoundException("Parent user not found or not a USER role"));

        if (profileRepo.existsByUsernameOrEmail(username, email))
            throw new ConflictException("Username or email already exists");

        String statusStr = (String) req.getOrDefault("status", "active");
        Profile.UserStatus status;
        try { status = Profile.UserStatus.valueOf(statusStr); }
        catch (Exception e) { status = Profile.UserStatus.active; }

        Profile sub = Profile.builder()
                .username(username).email(email).fullName(fullName != null ? fullName : "")
                .role(Profile.UserRole.SUB_USER).status(status).parentId(parentId)
                .build();

        Profile saved = profileRepo.save(sub);
        auditLogger.log("SUB_USER_CREATED",
                "Sub-user " + username + " created under " + parentId,
                principal.getId().toString());
        return saved;
    }

    public Profile getSubUser(AppUserPrincipal principal, UUID id) {
        if (principal.isSubUser()) throw new ForbiddenException();
        Profile sub = profileRepo.findById(id)
                .filter(p -> p.getRole() == Profile.UserRole.SUB_USER)
                .orElseThrow(() -> new ResourceNotFoundException("Sub-user not found"));
        if (!principal.isSuperAdmin() && !principal.getId().equals(sub.getParentId()))
            throw new ForbiddenException();
        return sub;
    }

    @Transactional
    public Profile updateSubUser(AppUserPrincipal principal, UUID id, Map<String, Object> req) {
        Profile sub = getSubUser(principal, id);
        if (req.containsKey("fullName")) sub.setFullName((String) req.get("fullName"));
        if (req.containsKey("email"))    sub.setEmail((String) req.get("email"));
        if (req.containsKey("status")) {
            try { sub.setStatus(Profile.UserStatus.valueOf((String) req.get("status"))); }
            catch (Exception ignored) {}
        }
        Profile saved = profileRepo.save(sub);
        auditLogger.log("SUB_USER_UPDATED", "Sub-user " + id + " updated",
                principal.getId().toString());
        return saved;
    }

    @Transactional
    public void deleteSubUser(AppUserPrincipal principal, UUID id) {
        Profile sub = getSubUser(principal, id);
        profileRepo.delete(sub);
        auditLogger.log("SUB_USER_DELETED",
                "Sub-user " + sub.getUsername() + " deleted",
                principal.getId().toString());
    }
}
