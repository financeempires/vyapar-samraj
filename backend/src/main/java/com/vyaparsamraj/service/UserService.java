package com.vyaparsamraj.service;

import com.vyaparsamraj.audit.AuditLogger;
import com.vyaparsamraj.dto.CreateUserRequest;
import com.vyaparsamraj.dto.UpdateUserRequest;
import com.vyaparsamraj.entity.Profile;
import com.vyaparsamraj.exception.*;
import com.vyaparsamraj.repository.ProfileRepository;
import com.vyaparsamraj.security.AppUserPrincipal;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.*;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.util.*;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class UserService {

    private final ProfileRepository profileRepo;
    private final AuditLogger auditLogger;
    private final JdbcTemplate jdbcTemplate;
    private final PasswordEncoder passwordEncoder;

    public Map<String, Object> listUsers(AppUserPrincipal principal,
                                         int page, String search, String status) {
        Pageable pageable = PageRequest.of(page - 1, 50, Sort.by("createdAt").descending());

        if (!principal.isSuperAdmin()) {
            // USER/SUB_USER sees only their own profile
            Profile self = profileRepo.findById(principal.getId())
                    .orElseThrow(() -> new ResourceNotFoundException("Profile not found"));
            return Map.of("users", List.of(self),
                    "pagination", Map.of("page", 1, "pageSize", 1, "total", 1));
        }

        Page<Profile> result = (search == null || search.isBlank())
                ? profileRepo.findAll(pageable)
                : profileRepo.searchProfiles(search, pageable);

        List<Map<String, Object>> userMaps = result.getContent().stream().map(p -> {
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("id", p.getId());
            m.put("username", p.getUsername());
            m.put("email", p.getEmail());
            m.put("fullName", p.getFullName());
            m.put("full_name", p.getFullName());
            m.put("role", p.getRole());
            m.put("status", p.getStatus());
            m.put("organization", p.getOrganization());
            m.put("createdAt", p.getCreatedAt());
            m.put("created_at", p.getCreatedAt());

            try {
                List<String> phones = jdbcTemplate.query(
                        "SELECT phone FROM users WHERE id = ?",
                        (rs, rowNum) -> rs.getString("phone"),
                        p.getId()
                );
                m.put("phone", phones.isEmpty() || phones.get(0) == null ? "" : phones.get(0));
            } catch (Exception ignored) {
                m.put("phone", "");
            }

            try {
                List<String> plans = jdbcTemplate.query(
                        "SELECT plan_id FROM subscriptions WHERE user_id = ? ORDER BY created_at DESC LIMIT 1",
                        (rs, rowNum) -> rs.getString("plan_id"),
                        p.getId()
                );
                m.put("plan_id", plans.isEmpty() || plans.get(0) == null ? "" : plans.get(0));
            } catch (Exception ignored) {
                m.put("plan_id", "");
            }

            return m;
        }).collect(Collectors.toList());

        return Map.of("users", userMaps,
                "pagination", Map.of(
                        "page", page, "pageSize", 50, "total", result.getTotalElements()));
    }

    @Transactional
    public Profile createUser(AppUserPrincipal principal, CreateUserRequest req) {
        if (!principal.isSuperAdmin()) throw new ForbiddenException();

        if (profileRepo.existsByUsernameOrEmail(req.username(), req.email()))
            throw new ConflictException("Username or email already exists");

        if (req.password() == null || req.password().trim().isEmpty()) {
            throw new IllegalArgumentException("Password is required for new users");
        }

        Profile p = Profile.builder()
                .username(req.username())
                .email(req.email())
                .fullName(req.fullName())
                .role(req.role() != null ? req.role() : Profile.UserRole.USER)
                .status(req.status() != null ? req.status() : Profile.UserStatus.active)
                .organization(req.organization())
                .build();

        Profile saved = profileRepo.save(p);

        // Secure BCrypt password hashing using backend PasswordEncoder
        String passwordHash = passwordEncoder.encode(req.password().trim());

        UUID orgId = null;
        try {
            List<UUID> orgs = jdbcTemplate.query(
                "SELECT id FROM organizations LIMIT 1",
                (rs, rowNum) -> UUID.fromString(rs.getString("id"))
            );
            if (!orgs.isEmpty()) orgId = orgs.get(0);
        } catch (Exception ignored) {}

        if (orgId == null) {
            orgId = UUID.randomUUID();
            jdbcTemplate.update(
                "INSERT INTO organizations (id, name, email, phone, status, created_at, updated_at) VALUES (?, ?, ?, ?, 'ACTIVE', NOW(), NOW())",
                orgId, req.fullName() + "'s Org", req.email(), req.phone() != null ? req.phone() : ""
            );
        }

        jdbcTemplate.update(
            "INSERT INTO users (id, organization_id, username, password_hash, password, full_name, email, phone, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'ACTIVE', NOW(), NOW()) ON CONFLICT (id) DO UPDATE SET password_hash = EXCLUDED.password_hash, password = EXCLUDED.password, updated_at = NOW()",
            saved.getId(), orgId, req.username(), passwordHash, req.password(), req.fullName(), req.email(), req.phone() != null ? req.phone() : ""
        );

        if (req.planId() != null && !req.planId().isBlank() && !"null".equalsIgnoreCase(req.planId())) {
            try {
                UUID planUuid = UUID.fromString(req.planId());
                String sDate = req.startDate() != null && !req.startDate().isBlank() ? req.startDate() : new java.text.SimpleDateFormat("yyyy-MM-dd").format(new java.util.Date());
                String eDate = req.endDate() != null && !req.endDate().isBlank() ? req.endDate() : sDate;

                jdbcTemplate.update(
                    "INSERT INTO subscriptions (id, user_id, organization_id, plan_id, status, start_date, end_date, auto_renew, auto_renewal, created_at, updated_at) VALUES (gen_random_uuid(), ?, ?, ?, 'ACTIVE', ?::date, ?::date, false, false, NOW(), NOW())",
                    saved.getId(), orgId, planUuid, sDate, eDate
                );
            } catch (Exception ignored) {}
        }

        auditLogger.log("USER_CREATED", "User " + req.username() + " created",
                principal.getId().toString());
        return saved;
    }

    public Map<String, Object> getUser(AppUserPrincipal principal, UUID id) {
        Profile user = profileRepo.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("User not found"));
        if (!principal.isSuperAdmin() && !principal.getId().equals(id))
            throw new ForbiddenException();

        String phone = "";
        String password = "";
        try {
            List<Map<String, Object>> uRows = jdbcTemplate.queryForList(
                "SELECT phone, password FROM users WHERE id = ? LIMIT 1", id
            );
            if (!uRows.isEmpty()) {
                Map<String, Object> r = uRows.get(0);
                if (r.get("phone") != null) phone = r.get("phone").toString();
                if (r.get("password") != null) password = r.get("password").toString();
            }
        } catch (Exception ignored) {}

        Map<String, Object> map = new LinkedHashMap<>();
        map.put("id", user.getId());
        map.put("username", user.getUsername());
        map.put("email", user.getEmail());
        map.put("fullName", user.getFullName());
        map.put("full_name", user.getFullName());
        map.put("role", user.getRole());
        map.put("status", user.getStatus());
        map.put("organization", user.getOrganization());
        map.put("parentId", user.getParentId());
        map.put("parent_id", user.getParentId());
        map.put("phone", phone);
        map.put("password", password);
        map.put("createdAt", user.getCreatedAt());
        map.put("created_at", user.getCreatedAt());
        map.put("updatedAt", user.getUpdatedAt());
        map.put("updated_at", user.getUpdatedAt());

        try {
            List<Map<String, Object>> subs = jdbcTemplate.queryForList(
                    "SELECT plan_id, max_sub_users, start_date, end_date FROM subscriptions WHERE user_id = ? ORDER BY created_at DESC LIMIT 1", id);
            if (!subs.isEmpty()) {
                Map<String, Object> sub = subs.get(0);
                if (sub.get("plan_id") != null) map.put("plan_id", sub.get("plan_id").toString());
                if (sub.get("start_date") != null) map.put("start_date", sub.get("start_date").toString());
                if (sub.get("end_date") != null) map.put("end_date", sub.get("end_date").toString());

                Object customSub = sub.get("max_sub_users");
                if (customSub != null) {
                    map.put("sub_admins", customSub);
                    map.put("is_custom_sub_admins", true);
                } else if (sub.get("plan_id") != null) {
                    try {
                        List<Integer> planSubs = jdbcTemplate.query(
                            "SELECT max_sub_users FROM plans WHERE id = ?::uuid LIMIT 1",
                            (rs, rowNum) -> rs.getInt("max_sub_users"),
                            sub.get("plan_id").toString()
                        );
                        if (!planSubs.isEmpty()) {
                            map.put("sub_admins", planSubs.get(0));
                            map.put("is_custom_sub_admins", false);
                        }
                    } catch (Exception ignored) {}
                }
            }
        } catch (Exception ignored) {}

        return map;
    }

    @Transactional
    public Profile updateUser(AppUserPrincipal principal, UUID id, UpdateUserRequest req) {
        Profile user = profileRepo.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("User not found"));

        if (!principal.isSuperAdmin() && !principal.getId().equals(id))
            throw new ForbiddenException();

        if (req.fullName() != null) {
            if (req.fullName().trim().isEmpty()) throw new IllegalArgumentException("Name is required");
            user.setFullName(req.fullName().trim());
        }
        if (req.email() != null) {
            if (req.email().trim().isEmpty()) throw new IllegalArgumentException("Email is required");
            user.setEmail(req.email().trim());
        }
        if (req.phone() != null) {
            if (req.phone().trim().isEmpty()) throw new IllegalArgumentException("Phone is required");
        }
        if (req.password() != null && req.password().trim().isEmpty()) {
            throw new IllegalArgumentException("Password is required");
        }

        // Only SUPER_ADMIN can change role/status/org
        if (principal.isSuperAdmin()) {
            if (req.status()       != null) user.setStatus(req.status());
            if (req.role()         != null) user.setRole(req.role());
            if (req.organization() != null) user.setOrganization(req.organization());
        }

        Profile saved = profileRepo.save(user);

        // Update password in users table if a new password was entered
        if (req.password() != null && !req.password().trim().isEmpty()) {
            String newPasswordHash = passwordEncoder.encode(req.password().trim());
            jdbcTemplate.update(
                "UPDATE users SET password_hash = ?, password = ?, updated_at = NOW() WHERE id = ?",
                newPasswordHash, req.password().trim(), id
            );
        }

        // Update phone in users table if provided
        if (req.phone() != null) {
            jdbcTemplate.update(
                "UPDATE users SET phone = ?, updated_at = NOW() WHERE id = ?",
                req.phone().trim(), id
            );
        }

        // Sync full_name & email to users table if updated
        if (req.fullName() != null || req.email() != null) {
            jdbcTemplate.update(
                "UPDATE users SET full_name = COALESCE(?, full_name), email = COALESCE(?, email), updated_at = NOW() WHERE id = ?",
                req.fullName(), req.email(), id
            );
        }

        // Update or insert subscription if planId is provided
        if (req.planId() != null && !req.planId().isBlank() && !"null".equalsIgnoreCase(req.planId())) {
            try {
                UUID planUuid = UUID.fromString(req.planId());
                String sDate = req.startDate() != null && !req.startDate().isBlank() ? req.startDate() : new java.text.SimpleDateFormat("yyyy-MM-dd").format(new java.util.Date());
                String eDate = req.endDate() != null && !req.endDate().isBlank() ? req.endDate() : sDate;

                List<UUID> existingSubs = jdbcTemplate.query(
                    "SELECT id FROM subscriptions WHERE user_id = ? LIMIT 1",
                    (rs, rowNum) -> UUID.fromString(rs.getString("id")),
                    id
                );

                if (!existingSubs.isEmpty()) {
                    if (req.subAdmins() != null) {
                        jdbcTemplate.update(
                            "UPDATE subscriptions SET plan_id = ?, max_sub_users = ?, start_date = ?::date, end_date = ?::date, updated_at = NOW() WHERE user_id = ?",
                            planUuid, Math.max(0, req.subAdmins()), sDate, eDate, id
                        );
                    } else {
                        jdbcTemplate.update(
                            "UPDATE subscriptions SET plan_id = ?, start_date = ?::date, end_date = ?::date, updated_at = NOW() WHERE user_id = ?",
                            planUuid, sDate, eDate, id
                        );
                    }
                } else {
                    UUID userOrgId = null;
                    try {
                        List<UUID> orgs = jdbcTemplate.query(
                            "SELECT organization_id FROM users WHERE id = ? LIMIT 1",
                            (rs, rowNum) -> UUID.fromString(rs.getString("organization_id")),
                            id
                        );
                        if (!orgs.isEmpty()) userOrgId = orgs.get(0);
                    } catch (Exception ignored) {}

                    jdbcTemplate.update(
                        "INSERT INTO subscriptions (id, user_id, organization_id, plan_id, max_sub_users, status, start_date, end_date, auto_renew, auto_renewal, created_at, updated_at) VALUES (gen_random_uuid(), ?, ?, ?, ?, 'ACTIVE', ?::date, ?::date, false, false, NOW(), NOW())",
                        id, userOrgId, planUuid, req.subAdmins(), sDate, eDate
                    );
                }
            } catch (Exception ignored) {}
        }

        auditLogger.log("USER_UPDATED", "User " + id + " updated",
                principal.getId().toString());
        return saved;
    }

    @Transactional
    public void deleteUser(AppUserPrincipal principal, UUID id) {
        if (!principal.isSuperAdmin()) throw new ForbiddenException();
        if (principal.getId().equals(id)) throw new ForbiddenException("Cannot delete own account");

        Profile user = profileRepo.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("User not found"));

        jdbcTemplate.update("DELETE FROM subscriptions WHERE user_id = ?", id);
        jdbcTemplate.update("DELETE FROM users WHERE id = ?", id);
        profileRepo.delete(user);

        auditLogger.log("USER_DELETED", "User " + user.getUsername() + " deleted",
                principal.getId().toString());
    }
}
