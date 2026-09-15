package com.vyaparsamraj.controller;

import com.vyaparsamraj.dto.ApiResponse;
import com.vyaparsamraj.entity.*;
import com.vyaparsamraj.exception.ForbiddenException;
import com.vyaparsamraj.exception.ResourceNotFoundException;
import com.vyaparsamraj.repository.*;
import com.vyaparsamraj.security.AppUserPrincipal;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.*;

@RestController
@RequestMapping("/api/super-admin")
@RequiredArgsConstructor
public class SuperAdminController {

    private final TransactionRepository txRepo;
    private final ActivityLogRepository activityRepo;
    private final NotificationRepository notificationRepo;
    private final ProfileRepository profileRepo;
    private final SuperAdminRepository superAdminRepo;

    /**
     * 1. Transactions & Revenue API
     */
    @GetMapping("/transactions")
    public ResponseEntity<ApiResponse<Object>> getTransactions(
            @AuthenticationPrincipal AppUserPrincipal principal,
            @RequestParam(defaultValue = "1") int page,
            @RequestParam(defaultValue = "50") int pageSize) {
        enforceSuperAdmin(principal);

        Pageable pageable = PageRequest.of(Math.max(0, page - 1), Math.min(100, pageSize), Sort.by("createdAt").descending());
        Page<Transaction> txPage = txRepo.findAll(pageable);
        List<Transaction> allTx = txRepo.findAll();

        BigDecimal totalRevenue = BigDecimal.ZERO;
        BigDecimal monthRevenue = BigDecimal.ZERO;
        BigDecimal yearRevenue = BigDecimal.ZERO;
        long successCount = 0;
        long pendingCount = 0;
        long failedCount = 0;
        long refundCount = 0;

        OffsetDateTime now = OffsetDateTime.now();
        int currentMonth = now.getMonthValue();
        int currentYear = now.getYear();

        for (Transaction tx : allTx) {
            BigDecimal amt = tx.getAmount() != null ? tx.getAmount() : BigDecimal.ZERO;
            OffsetDateTime createdAt = tx.getCreatedAt();

            if (tx.getStatus() == Transaction.TxStatus.completed && tx.getType() == Transaction.TxType.payment) {
                totalRevenue = totalRevenue.add(amt);
                if (createdAt != null && createdAt.getMonthValue() == currentMonth && createdAt.getYear() == currentYear) {
                    monthRevenue = monthRevenue.add(amt);
                }
                if (createdAt != null && createdAt.getYear() == currentYear) {
                    yearRevenue = yearRevenue.add(amt);
                }
                successCount++;
            } else if (tx.getStatus() == Transaction.TxStatus.pending) {
                pendingCount++;
            } else if (tx.getStatus() == Transaction.TxStatus.failed) {
                failedCount++;
            } else if (tx.getStatus() == Transaction.TxStatus.refunded || tx.getType() == Transaction.TxType.refund) {
                refundCount++;
            }
        }

        Map<String, Object> responseData = new LinkedHashMap<>();
        responseData.put("summary", Map.of(
                "totalRevenue", totalRevenue,
                "monthRevenue", monthRevenue,
                "yearRevenue", yearRevenue,
                "successCount", successCount,
                "pendingCount", pendingCount,
                "failedCount", failedCount,
                "refundCount", refundCount
        ));
        responseData.put("transactions", txPage.getContent());
        responseData.put("pagination", Map.of(
                "page", page,
                "pageSize", pageSize,
                "totalElements", txPage.getTotalElements(),
                "totalPages", txPage.getTotalPages()
        ));

        return ResponseEntity.ok(ApiResponse.ok(responseData));
    }

    /**
     * 2. Activity Logs API
     */
    @GetMapping("/activity-logs")
    public ResponseEntity<ApiResponse<Object>> getActivityLogs(
            @AuthenticationPrincipal AppUserPrincipal principal,
            @RequestParam(defaultValue = "1") int page,
            @RequestParam(defaultValue = "50") int pageSize) {
        enforceSuperAdmin(principal);

        Pageable pageable = PageRequest.of(Math.max(0, page - 1), Math.min(100, pageSize), Sort.by("createdAt").descending());
        Page<ActivityLog> logPage = activityRepo.findAll(pageable);

        return ResponseEntity.ok(ApiResponse.ok(Map.of(
                "logs", logPage.getContent(),
                "pagination", Map.of(
                        "page", page,
                        "pageSize", pageSize,
                        "totalElements", logPage.getTotalElements(),
                        "totalPages", logPage.getTotalPages()
                )
        )));
    }

    /**
     * 3. System Notifications API
     */
    @GetMapping("/notifications")
    public ResponseEntity<ApiResponse<Object>> getNotifications(
            @AuthenticationPrincipal AppUserPrincipal principal) {
        enforceSuperAdmin(principal);

        List<Notification> list = notificationRepo.findTop50ByRecipientIdOrderByCreatedAtDesc(principal.getId().toString());
        long unreadCount = list.stream().filter(n -> Boolean.FALSE.equals(n.getIsRead())).count();

        return ResponseEntity.ok(ApiResponse.ok(Map.of(
                "notifications", list,
                "unreadCount", unreadCount
        )));
    }

    @PatchMapping("/notifications/{id}/read")
    public ResponseEntity<ApiResponse<Object>> markNotificationRead(
            @AuthenticationPrincipal AppUserPrincipal principal,
            @PathVariable UUID id) {
        enforceSuperAdmin(principal);

        Notification n = notificationRepo.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Notification not found"));
        n.setIsRead(true);
        notificationRepo.save(n);

        return ResponseEntity.ok(ApiResponse.ok("Notification marked as read"));
    }

    /**
     * 4. Security & Access Control API
     */
    @GetMapping("/security-access")
    public ResponseEntity<ApiResponse<Object>> getSecurityAccessInfo(
            @AuthenticationPrincipal AppUserPrincipal principal) {
        enforceSuperAdmin(principal);

        List<SuperAdminAccount> superAdmins = superAdminRepo.findAll();
        long totalUsers = 0;
        long userCount = 0;
        long subUserCount = 0;
        long activeCount = 0;

        try {
            totalUsers = profileRepo.count();
            userCount = profileRepo.countByRole(Profile.UserRole.USER);
            subUserCount = profileRepo.countByRole(Profile.UserRole.SUB_USER);
            activeCount = profileRepo.countByStatus(Profile.UserStatus.active);
        } catch (Exception e) {
            // Ignore if profiles repository has no records yet
        }

        List<ActivityLog> recentSecurityLogs = activityRepo.findAll(
                PageRequest.of(0, 10, Sort.by("createdAt").descending())
        ).getContent();

        // Sanitize sensitive fields before returning super admin accounts
        List<Map<String, Object>> safeSuperAdmins = superAdmins.stream().map(sa -> {
            Map<String, Object> map = new LinkedHashMap<>();
            map.put("id", sa.getId());
            map.put("username", sa.getUsername());
            map.put("email", sa.getEmail());
            map.put("fullName", sa.getFullName());
            map.put("lastLoginAt", sa.getLastLoginAt());
            map.put("createdAt", sa.getCreatedAt());
            return map;
        }).toList();

        Map<String, Object> securityInfo = new LinkedHashMap<>();
        securityInfo.put("superAdmins", safeSuperAdmins);
        securityInfo.put("stats", Map.of(
                "superAdminCount", superAdmins.size(),
                "totalUsers", totalUsers,
                "userCount", userCount,
                "subUserCount", subUserCount,
                "activeUsersCount", activeCount
        ));
        securityInfo.put("enforcements", Map.of(
                "passwordHashing", "BCrypt (Cost Factor 10)",
                "pinHashing", "BCrypt (Neon DB super_admin_accounts.pin_hash)",
                "twoFactorAuth", "Mandatory 6-digit Email OTP",
                "sessionSecurity", "HttpOnly SameSite Lax Cookie"
        ));
        securityInfo.put("recentSecurityLogs", recentSecurityLogs);

        return ResponseEntity.ok(ApiResponse.ok(securityInfo));
    }

    private void enforceSuperAdmin(AppUserPrincipal principal) {
        if (principal == null || !principal.isSuperAdmin()) {
            throw new ForbiddenException("Super Admin privilege required");
        }
    }
}
