package com.vyaparsamraj.controller;

import com.vyaparsamraj.dto.ApiResponse;
import com.vyaparsamraj.entity.CustomerPayment;
import com.vyaparsamraj.exception.UnauthorizedException;
import com.vyaparsamraj.security.AppUserPrincipal;
import com.vyaparsamraj.service.CustomerPaymentService;
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
@RequestMapping("/api/customers/payments")
@RequiredArgsConstructor
public class CustomerPaymentController {

    private final CustomerPaymentService paymentService;

    private UUID getAuthenticatedUserId() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth == null || !auth.isAuthenticated() || !(auth.getPrincipal() instanceof AppUserPrincipal principal)) {
            throw new UnauthorizedException("Authenticated session required");
        }
        UUID ownerId = principal.getOwnerId();
        return ownerId != null ? ownerId : principal.getId();
    }

    @GetMapping
    public ResponseEntity<ApiResponse<Map<String, List<CustomerPayment>>>> getPayments(
            @RequestParam(value = "customer_id", required = false) String customerIdParam,
            @RequestParam(value = "id", required = false) String idParam,
            @RequestParam(value = "loan_id", required = false) String loanIdParam) {

        UUID userId = getAuthenticatedUserId();
        String targetCustomerId = customerIdParam != null ? customerIdParam : idParam;
        if (targetCustomerId == null || targetCustomerId.trim().isEmpty()) {
            throw new IllegalArgumentException("customer_id is required");
        }

        UUID customerId = UUID.fromString(targetCustomerId.trim());
        UUID loanId = loanIdParam != null && !loanIdParam.trim().isEmpty() ? UUID.fromString(loanIdParam.trim()) : null;

        List<CustomerPayment> payments = paymentService.getPayments(userId, customerId, loanId);
        return ResponseEntity.ok(ApiResponse.ok(Map.of("payments", payments)));
    }

    @PostMapping
    public ResponseEntity<ApiResponse<Map<String, Object>>> recordPayment(@RequestBody Map<String, Object> body) {
        UUID userId = getAuthenticatedUserId();
        Map<String, Object> result = paymentService.recordPayment(userId, body);
        return ResponseEntity.status(HttpStatus.CREATED).body(ApiResponse.ok(result));
    }

    @PutMapping
    public ResponseEntity<ApiResponse<Map<String, Object>>> updatePayment(@RequestBody Map<String, Object> body) {
        UUID userId = getAuthenticatedUserId();
        Map<String, Object> result = paymentService.updatePayment(userId, body);
        return ResponseEntity.ok(ApiResponse.ok(result));
    }

    @PatchMapping
    public ResponseEntity<ApiResponse<Map<String, Object>>> patchPayment(@RequestBody Map<String, Object> body) {
        return updatePayment(body);
    }
}
