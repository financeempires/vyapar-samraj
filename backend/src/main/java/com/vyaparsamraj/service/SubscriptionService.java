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
public class SubscriptionService {

    private final SubscriptionRepository subRepo;
    private final PlanRepository planRepo;
    private final AuditLogger auditLogger;

    public Map<String, Object> list(AppUserPrincipal p, int page, String statusStr) {
        Pageable pageable = PageRequest.of(page - 1, 50, Sort.by("createdAt").descending());
        Subscription.SubStatus status = parseStatus(statusStr);
        Page<Subscription> result;

        if (p.isSuperAdmin()) {
            result = status != null ? subRepo.findByStatus(status, pageable) : subRepo.findAll(pageable);
        } else {
            UUID ownerId = p.getOwnerId();
            if (ownerId == null) throw new ForbiddenException();
            result = status != null
                    ? subRepo.findByUserIdAndStatus(ownerId, status, pageable)
                    : subRepo.findByUserId(ownerId, pageable);
        }

        return Map.of("subscriptions", result.getContent(),
                "pagination", Map.of("page", page, "pageSize", 50, "total", result.getTotalElements()));
    }

    @Transactional
    public Subscription create(AppUserPrincipal p, com.vyaparsamraj.dto.CreateSubscriptionRequest req) {
        if (!p.isSuperAdmin()) throw new ForbiddenException();
        if (!planRepo.existsById(req.planId()))
            throw new ResourceNotFoundException("Plan not found");

        Subscription s = Subscription.builder()
                .userId(req.userId()).planId(req.planId())
                .startDate(req.startDate()).endDate(req.endDate())
                .status(req.status() != null ? req.status() : Subscription.SubStatus.active)
                .autoRenewal(req.autoRenewal() != null ? req.autoRenewal() : false)
                .build();

        Subscription saved = subRepo.save(s);
        auditLogger.log("SUBSCRIPTION_CREATED", "Subscription created for user " + req.userId(), p.getId().toString());
        return saved;
    }

    public Subscription get(AppUserPrincipal p, UUID id) {
        Subscription sub = subRepo.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Subscription not found"));
        if (!p.isSuperAdmin() && !sub.getUserId().equals(p.getOwnerId())) throw new ForbiddenException();
        return sub;
    }

    @Transactional
    public Subscription update(AppUserPrincipal p, UUID id, Map<String, Object> req) {
        if (!p.isSuperAdmin()) throw new ForbiddenException();
        Subscription sub = subRepo.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Subscription not found"));
        if (req.containsKey("status")) { var s = parseStatus((String) req.get("status")); if (s != null) sub.setStatus(s); }
        if (req.containsKey("auto_renewal")) sub.setAutoRenewal(Boolean.valueOf(req.get("auto_renewal").toString()));
        auditLogger.log("SUBSCRIPTION_UPDATED", "Subscription " + id + " updated", p.getId().toString());
        return subRepo.save(sub);
    }

    private Subscription.SubStatus parseStatus(String s) {
        if (s == null || s.isBlank()) return null;
        try { return Subscription.SubStatus.valueOf(s); } catch (Exception e) { return null; }
    }
}
