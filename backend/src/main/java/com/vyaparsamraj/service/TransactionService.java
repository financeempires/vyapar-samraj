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
import java.math.BigDecimal;
import java.util.*;

@Service
@RequiredArgsConstructor
public class TransactionService {

    private final TransactionRepository txRepo;
    private final AuditLogger auditLogger;

    public Map<String, Object> listTransactions(AppUserPrincipal principal,
                                                 int page, String statusStr) {
        Pageable pageable = PageRequest.of(page - 1, 50, Sort.by("createdAt").descending());
        Page<Transaction> result;
        Transaction.TxStatus status = parseTxStatus(statusStr);

        if (principal.isSuperAdmin()) {
            result = status != null ? txRepo.findByStatus(status, pageable) : txRepo.findAll(pageable);
        } else {
            UUID ownerId = principal.getOwnerId();
            if (ownerId == null) throw new ForbiddenException();
            result = status != null
                    ? txRepo.findByUserIdAndStatus(ownerId, status, pageable)
                    : txRepo.findByUserId(ownerId, pageable);
        }

        return Map.of("transactions", result.getContent(),
                "pagination", Map.of("page", page, "pageSize", 50, "total", result.getTotalElements()));
    }

    @Transactional
    public Transaction createTransaction(AppUserPrincipal principal,
                                          com.vyaparsamraj.dto.CreateTransactionRequest req) {
        if (principal.isSubUser()) throw new ForbiddenException();

        // USER can only create for themselves
        if (!principal.isSuperAdmin() && !principal.getId().equals(req.userId()))
            throw new ForbiddenException("Cannot create transactions for another user");

        Transaction tx = Transaction.builder()
                .userId(req.userId())
                .organizationId(req.organizationId())
                .amount(req.amount())
                .currency(req.currency() != null ? req.currency() : "INR")
                .type(req.type())
                .status(req.status() != null ? req.status() : Transaction.TxStatus.pending)
                .description(req.description())
                .referenceId(req.referenceId())
                .build();

        Transaction saved = txRepo.save(tx);
        auditLogger.log("TRANSACTION_CREATED",
                "Transaction of " + req.amount() + " " + req.currency() + " created",
                principal.getId().toString());
        return saved;
    }

    public Transaction getTransaction(AppUserPrincipal principal, UUID id) {
        Transaction tx = txRepo.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Transaction not found"));

        if (!principal.isSuperAdmin()) {
            UUID ownerId = principal.getOwnerId();
            if (!tx.getUserId().equals(ownerId)) throw new ForbiddenException();
        }
        return tx;
    }

    @Transactional
    public Transaction updateTransaction(AppUserPrincipal principal, UUID id, Map<String, Object> req) {
        if (principal.isSubUser()) throw new ForbiddenException();
        Transaction tx = getTransaction(principal, id);

        if (req.containsKey("status")) {
            Transaction.TxStatus s = parseTxStatus((String) req.get("status"));
            if (s != null) tx.setStatus(s);
        }
        if (req.containsKey("description")) tx.setDescription((String) req.get("description"));

        Transaction saved = txRepo.save(tx);
        auditLogger.log("TRANSACTION_UPDATED", "Transaction " + id + " updated",
                principal.getId().toString());
        return saved;
    }

    @Transactional
    public void deleteTransaction(AppUserPrincipal principal, UUID id) {
        if (!principal.isSuperAdmin()) throw new ForbiddenException();
        Transaction tx = txRepo.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Transaction not found"));
        txRepo.delete(tx);
        auditLogger.log("TRANSACTION_DELETED", "Transaction " + id + " deleted",
                principal.getId().toString());
    }

    private Transaction.TxStatus parseTxStatus(String s) {
        if (s == null || s.isBlank()) return null;
        try { return Transaction.TxStatus.valueOf(s); } catch (Exception e) { return null; }
    }
}
