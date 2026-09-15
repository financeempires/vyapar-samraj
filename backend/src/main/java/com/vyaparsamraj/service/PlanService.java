package com.vyaparsamraj.service;

import com.vyaparsamraj.audit.AuditLogger;
import com.vyaparsamraj.entity.Plan;
import com.vyaparsamraj.exception.*;
import com.vyaparsamraj.repository.PlanRepository;
import com.vyaparsamraj.security.AppUserPrincipal;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.*;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.math.BigDecimal;
import java.util.*;

@Service
@RequiredArgsConstructor
public class PlanService {

    private final PlanRepository planRepo;
    private final AuditLogger auditLogger;

    public Map<String, Object> list(AppUserPrincipal p, int page) {
        Pageable pageable = PageRequest.of(page - 1, 50, Sort.by("createdAt").descending());
        Page<Plan> result = p.isSuperAdmin()
                ? planRepo.findAll(pageable)
                : planRepo.findByIsActive(true, pageable);
        return Map.of("plans", result.getContent(),
                "pagination", Map.of("page", page, "pageSize", 50, "total", result.getTotalElements()));
    }

    public Plan get(AppUserPrincipal p, UUID id) {
        Plan plan = planRepo.findById(id).orElseThrow(() -> new ResourceNotFoundException("Plan not found"));
        if (!p.isSuperAdmin() && !plan.getIsActive()) throw new ResourceNotFoundException("Plan not found");
        return plan;
    }

    @Transactional
    public Plan create(AppUserPrincipal p, Map<String, Object> req) {
        if (!p.isSuperAdmin()) throw new ForbiddenException();

        String planName = null;
        if (req.containsKey("planName") && req.get("planName") != null) {
            planName = req.get("planName").toString().trim();
        } else if (req.containsKey("name") && req.get("name") != null) {
            planName = req.get("name").toString().trim();
        }
        if (planName == null || planName.isBlank()) {
            throw new IllegalArgumentException("Plan name is required");
        }

        if (!req.containsKey("price") || req.get("price") == null) {
            throw new IllegalArgumentException("Price is required");
        }
        BigDecimal price;
        try {
            price = new BigDecimal(req.get("price").toString().trim());
            if (price.compareTo(BigDecimal.ZERO) <= 0) {
                throw new IllegalArgumentException("Price must be greater than 0");
            }
        } catch (Exception e) {
            throw new IllegalArgumentException("Valid numeric price is required");
        }

        Integer durationDays = null;
        if (req.containsKey("years") && req.get("years") != null && !req.get("years").toString().isBlank()) {
            try {
                int years = Integer.parseInt(req.get("years").toString().trim());
                if (years <= 0) throw new IllegalArgumentException("Years must be greater than 0");
                durationDays = years * 365;
            } catch (NumberFormatException e) {
                throw new IllegalArgumentException("Years must be a valid positive integer");
            }
        } else if (req.containsKey("duration_days") && req.get("duration_days") != null) {
            try {
                durationDays = Integer.parseInt(req.get("duration_days").toString().trim());
            } catch (Exception ignored) {}
        }
        if (durationDays == null || durationDays <= 0) {
            throw new IllegalArgumentException("Valid years / duration is required");
        }

        Integer maxSubUsers = null;
        if (req.containsKey("subadmins") && req.get("subadmins") != null && !req.get("subadmins").toString().isBlank()) {
            try {
                maxSubUsers = Integer.parseInt(req.get("subadmins").toString().trim());
                if (maxSubUsers < 0) throw new IllegalArgumentException("Sub Admins cannot be negative");
            } catch (NumberFormatException e) {
                throw new IllegalArgumentException("Sub Admins must be a valid integer");
            }
        } else if (req.containsKey("max_sub_users") && req.get("max_sub_users") != null) {
            try {
                maxSubUsers = Integer.parseInt(req.get("max_sub_users").toString().trim());
            } catch (Exception ignored) {}
        }

        Plan plan = Plan.builder()
                .name(planName)
                .description(req.containsKey("description") ? (String) req.get("description") : null)
                .price(price)
                .currency(req.containsKey("currency") && req.get("currency") != null ? req.get("currency").toString() : "INR")
                .durationDays(durationDays)
                .maxSubUsers(maxSubUsers)
                .areas(req.containsKey("areas") && req.get("areas") != null ? req.get("areas").toString().trim() : null)
                .maxUsers(req.containsKey("max_users") && req.get("max_users") != null ? Integer.valueOf(req.get("max_users").toString()) : null)
                .billingCycle(req.containsKey("billing_cycle") && req.get("billing_cycle") != null ? req.get("billing_cycle").toString().toUpperCase() : "YEARLY")
                .status(req.containsKey("status") && req.get("status") != null ? req.get("status").toString().toUpperCase() : "ACTIVE")
                .features(req.containsKey("features") && req.get("features") instanceof Map ? (Map<String,Object>) req.get("features") : Map.of())
                .isActive(req.containsKey("is_active") && req.get("is_active") != null ? Boolean.valueOf(req.get("is_active").toString()) : true)
                .build();
        Plan saved = planRepo.save(plan);
        auditLogger.log("PLAN_CREATED", "Plan \"" + plan.getName() + "\" created", p.getId().toString());
        return saved;
    }

    @Transactional
    public Plan update(AppUserPrincipal p, UUID id, Map<String, Object> req) {
        if (!p.isSuperAdmin()) throw new ForbiddenException();
        Plan plan = planRepo.findById(id).orElseThrow(() -> new ResourceNotFoundException("Plan not found"));
        
        if (req.containsKey("planName") && req.get("planName") != null && !req.get("planName").toString().isBlank()) {
            plan.setName(req.get("planName").toString().trim());
        } else if (req.containsKey("name") && req.get("name") != null && !req.get("name").toString().isBlank()) {
            plan.setName(req.get("name").toString().trim());
        }

        if (req.containsKey("description")) {
            plan.setDescription(req.get("description") != null ? req.get("description").toString() : null);
        }

        if (req.containsKey("price") && req.get("price") != null && !req.get("price").toString().isBlank()) {
            BigDecimal price = new BigDecimal(req.get("price").toString().trim());
            if (price.compareTo(BigDecimal.ZERO) <= 0) throw new IllegalArgumentException("Price must be greater than 0");
            plan.setPrice(price);
        }

        if (req.containsKey("currency") && req.get("currency") != null) {
            plan.setCurrency(req.get("currency").toString());
        }

        if (req.containsKey("years") && req.get("years") != null && !req.get("years").toString().isBlank()) {
            int years = Integer.parseInt(req.get("years").toString().trim());
            if (years <= 0) throw new IllegalArgumentException("Years must be greater than 0");
            plan.setDurationDays(years * 365);
        } else if (req.containsKey("duration_days") && req.get("duration_days") != null && !req.get("duration_days").toString().isBlank()) {
            plan.setDurationDays(Integer.valueOf(req.get("duration_days").toString().trim()));
        }

        if (req.containsKey("subadmins") && req.get("subadmins") != null && !req.get("subadmins").toString().isBlank()) {
            int subadmins = Integer.parseInt(req.get("subadmins").toString().trim());
            if (subadmins < 0) throw new IllegalArgumentException("Sub Admins cannot be negative");
            plan.setMaxSubUsers(subadmins);
        } else if (req.containsKey("max_sub_users") && req.get("max_sub_users") != null && !req.get("max_sub_users").toString().isBlank()) {
            plan.setMaxSubUsers(Integer.valueOf(req.get("max_sub_users").toString().trim()));
        }

        if (req.containsKey("areas")) {
            plan.setAreas(req.get("areas") != null ? req.get("areas").toString().trim() : null);
        }

        if (req.containsKey("features") && req.get("features") instanceof Map) {
            plan.setFeatures((Map<String,Object>) req.get("features"));
        }
        Boolean newActive = null;
        if (req.containsKey("is_active") && req.get("is_active") != null) {
            newActive = Boolean.valueOf(req.get("is_active").toString());
        } else if (req.containsKey("isActive") && req.get("isActive") != null) {
            newActive = Boolean.valueOf(req.get("isActive").toString());
        } else if (req.containsKey("status") && req.get("status") != null) {
            newActive = "ACTIVE".equalsIgnoreCase(req.get("status").toString().trim());
        }

        if (newActive != null) {
            plan.setIsActive(newActive);
            plan.setStatus(newActive ? "ACTIVE" : "INACTIVE");
        }

        Plan saved = planRepo.save(plan);
        auditLogger.log("PLAN_UPDATED", "Plan " + id + " updated", p.getId().toString());
        return saved;
    }

    @Transactional
    public void delete(AppUserPrincipal p, UUID id) {
        if (!p.isSuperAdmin()) throw new ForbiddenException();
        Plan plan = planRepo.findById(id).orElseThrow(() -> new ResourceNotFoundException("Plan not found"));
        planRepo.delete(plan);
        auditLogger.log("PLAN_DELETED", "Plan \"" + plan.getName() + "\" deleted", p.getId().toString());
    }
}
