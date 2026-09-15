package com.vyaparsamraj.controller;

import com.vyaparsamraj.dto.*;
import com.vyaparsamraj.security.AppUserPrincipal;
import com.vyaparsamraj.service.TransactionService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/transactions")
@RequiredArgsConstructor
public class TransactionController {

    private final TransactionService txService;

    @GetMapping
    public ResponseEntity<ApiResponse<Object>> list(
            @AuthenticationPrincipal AppUserPrincipal p,
            @RequestParam(defaultValue = "1") int page,
            @RequestParam(required = false) String status) {
        return ResponseEntity.ok(ApiResponse.ok(txService.listTransactions(p, page, status)));
    }

    @PostMapping
    public ResponseEntity<ApiResponse<Object>> create(
            @AuthenticationPrincipal AppUserPrincipal p,
            @Valid @RequestBody CreateTransactionRequest req) {
        return ResponseEntity.status(201).body(ApiResponse.ok(txService.createTransaction(p, req)));
    }

    @GetMapping("/{id}")
    public ResponseEntity<ApiResponse<Object>> get(
            @AuthenticationPrincipal AppUserPrincipal p,
            @PathVariable UUID id) {
        return ResponseEntity.ok(ApiResponse.ok(txService.getTransaction(p, id)));
    }

    @PatchMapping("/{id}")
    public ResponseEntity<ApiResponse<Object>> update(
            @AuthenticationPrincipal AppUserPrincipal p,
            @PathVariable UUID id,
            @RequestBody Map<String, Object> req) {
        return ResponseEntity.ok(ApiResponse.ok(txService.updateTransaction(p, id, req)));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<ApiResponse<Object>> delete(
            @AuthenticationPrincipal AppUserPrincipal p,
            @PathVariable UUID id) {
        txService.deleteTransaction(p, id);
        return ResponseEntity.ok(ApiResponse.ok(Map.of("deleted", true, "id", id)));
    }
}
