package com.vyaparsamraj.service;

import com.vyaparsamraj.entity.Profile;
import com.vyaparsamraj.entity.Transaction;
import com.vyaparsamraj.repository.ActivityLogRepository;
import com.vyaparsamraj.repository.ProfileRepository;
import com.vyaparsamraj.repository.TransactionRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import java.math.BigDecimal;
import java.util.*;

@Service
@RequiredArgsConstructor
public class DashboardService {

    private final ProfileRepository profileRepo;
    private final TransactionRepository txRepo;
    private final ActivityLogRepository activityLogRepo;
    private final JdbcTemplate jdbcTemplate;

    /**
     * All aggregation done in the database — never loads full result-sets
     * into Java memory.
     */
    public Map<String, Object> getDashboardStats() {
        // User counts via DB COUNT
        long totalUsers   = profileRepo.count();
        long activeUsers  = profileRepo.countByStatus(Profile.UserStatus.active);
        long pendingUsers = profileRepo.countByStatus(Profile.UserStatus.pending);
        long expiredUsers = profileRepo.countByStatus(Profile.UserStatus.expired);

        // Revenue via DB SUM of assigned user plans
        BigDecimal totalRevenue = BigDecimal.ZERO;
        try {
            BigDecimal sum = jdbcTemplate.queryForObject(
                "SELECT COALESCE(SUM(p.price), 0) FROM (SELECT DISTINCT ON (s.user_id) s.user_id, s.plan_id FROM subscriptions s JOIN profiles pr ON pr.id = s.user_id ORDER BY s.user_id, s.created_at DESC) latest_subs JOIN plans p ON p.id = latest_subs.plan_id",
                BigDecimal.class
            );
            if (sum != null) {
                totalRevenue = sum;
            }
        } catch (Exception e) {
            e.printStackTrace();
        }

        // Recent activity (top 10)
        var recentActivity = activityLogRepo.findTop10ByOrderByCreatedAtDesc()
                .stream()
                .map(log -> Map.of(
                        "id",          log.getId().toString(),
                        "type",        log.getType(),
                        "description", log.getDescription(),
                        "actorId",     log.getActorId() != null ? log.getActorId() : "",
                        "createdAt",   log.getCreatedAt().toString()
                ))
                .toList();

        return Map.of(
                "totalRevenue",  totalRevenue,
                "totalUsers",    totalUsers,
                "activeUsers",   activeUsers,
                "pendingUsers",  pendingUsers,
                "expiredUsers",  expiredUsers,
                "recentActivity", recentActivity
        );
    }
}
