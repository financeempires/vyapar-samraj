package com.vyaparsamraj.controller;

import com.vyaparsamraj.dto.ApiResponse;
import com.vyaparsamraj.entity.CustomerLoan;
import com.vyaparsamraj.exception.UnauthorizedException;
import com.vyaparsamraj.security.AppUserPrincipal;
import com.vyaparsamraj.service.CustomerLoanService;
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
@RequestMapping("/api/customers/loans")
@RequiredArgsConstructor
public class CustomerLoanController {

    private final CustomerLoanService loanService;

    private UUID getAuthenticatedUserId() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth == null || !auth.isAuthenticated() || !(auth.getPrincipal() instanceof AppUserPrincipal principal)) {
            throw new UnauthorizedException("Authenticated session required");
        }
        UUID ownerId = principal.getOwnerId();
        return ownerId != null ? ownerId : principal.getId();
    }

    @GetMapping
    public ResponseEntity<ApiResponse<Map<String, List<CustomerLoan>>>> getLoans(
            @RequestParam(value = "customer_id", required = false) String customerIdParam,
            @RequestParam(value = "id", required = false) String idParam) {

        UUID userId = getAuthenticatedUserId();
        String targetId = customerIdParam != null ? customerIdParam : idParam;
        if (targetId == null || targetId.trim().isEmpty()) {
            throw new IllegalArgumentException("customer_id query parameter is required");
        }

        UUID customerId = UUID.fromString(targetId.trim());
        List<CustomerLoan> loans = loanService.getLoansByCustomerId(userId, customerId);
        return ResponseEntity.ok(ApiResponse.ok(Map.of("loans", loans)));
    }

    @PostMapping
    public ResponseEntity<ApiResponse<Map<String, CustomerLoan>>> createLoan(@RequestBody Map<String, Object> body) {
        UUID userId = getAuthenticatedUserId();
        CustomerLoan loan = loanService.createLoan(userId, body);
        return ResponseEntity.status(HttpStatus.CREATED).body(ApiResponse.ok(Map.of("loan", loan)));
    }

    @PutMapping
    public ResponseEntity<ApiResponse<Map<String, CustomerLoan>>> updateLoan(@RequestBody Map<String, Object> body) {
        UUID userId = getAuthenticatedUserId();
        CustomerLoan loan = loanService.updateLoan(userId, body);
        return ResponseEntity.ok(ApiResponse.ok(Map.of("loan", loan)));
    }
}
