package com.vyaparsamraj.controller;

import com.vyaparsamraj.dto.ApiResponse;
import com.vyaparsamraj.entity.Customer;
import com.vyaparsamraj.exception.UnauthorizedException;
import com.vyaparsamraj.security.AppUserPrincipal;
import com.vyaparsamraj.service.CustomerService;
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
@RequestMapping("/api/customers")
@RequiredArgsConstructor
public class CustomerController {

    private final CustomerService customerService;

    private AppUserPrincipal getPrincipal() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth == null || !auth.isAuthenticated() || !(auth.getPrincipal() instanceof AppUserPrincipal principal)) {
            throw new UnauthorizedException("Authenticated session required");
        }
        return principal;
    }

    private UUID getAuthenticatedUserId() {
        AppUserPrincipal principal = getPrincipal();
        UUID ownerId = principal.getOwnerId();
        return ownerId != null ? ownerId : principal.getId();
    }

    @GetMapping
    public ResponseEntity<ApiResponse<Object>> getCustomers(
            @RequestParam(value = "check_serial", required = false) Integer checkSerial,
            @RequestParam(value = "id", required = false) String idParam,
            @RequestParam(value = "customer_id", required = false) String customerIdParam,
            @RequestParam(value = "area_id", required = false) String areaIdParam,
            @RequestParam(value = "section", required = false) String section) {

        UUID userId = getAuthenticatedUserId();

        // 1. Check serial uniqueness
        if (checkSerial != null) {
            boolean exists = customerService.checkSerialNumberExists(userId, checkSerial);
            return ResponseEntity.ok(ApiResponse.ok(Map.of("exists", exists)));
        }

        // 2. Fetch single customer by ID
        String targetId = idParam != null ? idParam : customerIdParam;
        if (targetId != null && !targetId.trim().isEmpty()) {
            UUID customerId = UUID.fromString(targetId.trim());
            Map<String, Object> customer = customerService.getCustomerById(userId, customerId);
            return ResponseEntity.ok(ApiResponse.ok(Map.of("customer", customer)));
        }

        // 3. Fetch customers by area
        if (areaIdParam != null && !areaIdParam.trim().isEmpty()) {
            UUID areaId = UUID.fromString(areaIdParam.trim());
            List<Map<String, Object>> customers = customerService.getCustomersByArea(userId, areaId, section);
            return ResponseEntity.ok(ApiResponse.ok(Map.of("customers", customers)));
        }

        throw new IllegalArgumentException("area_id is required");
    }

    @PostMapping
    public ResponseEntity<ApiResponse<Map<String, Object>>> createCustomer(@RequestBody Map<String, Object> body) {
        AppUserPrincipal principal = getPrincipal();
        UUID userId = getAuthenticatedUserId();
        String verifiedByName = principal.getFullName() != null ? principal.getFullName() : principal.getUsername();

        Customer customer = customerService.createCustomer(userId, body, verifiedByName, null);
        return ResponseEntity.status(HttpStatus.CREATED).body(ApiResponse.ok(Map.of("customer", customer)));
    }

    @PatchMapping
    public ResponseEntity<ApiResponse<Map<String, Object>>> updateCustomerMarked(@RequestBody Map<String, Object> body) {
        UUID userId = getAuthenticatedUserId();
        Object rawId = body.get("customer_id") != null ? body.get("customer_id") : body.get("id");
        if (rawId == null || String.valueOf(rawId).trim().isEmpty()) {
            throw new IllegalArgumentException("customer_id is required");
        }
        UUID customerId = UUID.fromString(String.valueOf(rawId).trim());
        Boolean explicitMarked = body.get("is_marked") instanceof Boolean ? (Boolean) body.get("is_marked") : null;

        Customer customer = customerService.updateCustomerMarked(userId, customerId, explicitMarked);
        return ResponseEntity.ok(ApiResponse.ok(Map.of("customer", customer)));
    }

    @PutMapping
    public ResponseEntity<ApiResponse<Map<String, Object>>> updateCustomer(@RequestBody Map<String, Object> body) {
        UUID userId = getAuthenticatedUserId();
        Object rawId = body.get("customer_id") != null ? body.get("customer_id") : body.get("id");
        if (rawId == null || String.valueOf(rawId).trim().isEmpty()) {
            throw new IllegalArgumentException("customer_id is required");
        }
        UUID customerId = UUID.fromString(String.valueOf(rawId).trim());

        Map<String, Object> updated = customerService.updateCustomer(userId, customerId, body);
        return ResponseEntity.ok(ApiResponse.ok(Map.of("customer", updated)));
    }

    @DeleteMapping
    public ResponseEntity<ApiResponse<Map<String, Object>>> deleteCustomer(
            @RequestParam(value = "id", required = false) String idParam,
            @RequestParam(value = "customer_id", required = false) String customerIdParam,
            @RequestBody(required = false) Map<String, Object> body) {

        UUID userId = getAuthenticatedUserId();
        String targetId = idParam != null ? idParam : customerIdParam;
        if (targetId == null && body != null) {
            Object bId = body.get("id") != null ? body.get("id") : body.get("customer_id");
            if (bId != null) targetId = String.valueOf(bId);
        }

        if (targetId == null || targetId.trim().isEmpty()) {
            throw new IllegalArgumentException("customer_id is required");
        }

        UUID customerId = UUID.fromString(targetId.trim());
        Map<String, Object> deleted = customerService.deleteCustomer(userId, customerId);
        return ResponseEntity.ok(ApiResponse.ok(Map.of("deleted", true, "customer", deleted)));
    }
}
