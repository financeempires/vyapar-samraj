package com.vyaparsamraj.dto;

import com.vyaparsamraj.entity.Transaction;
import jakarta.validation.constraints.*;
import java.math.BigDecimal;
import java.util.UUID;

public record CreateTransactionRequest(
    @NotNull UUID userId,
    UUID organizationId,
    @NotNull @DecimalMin("0.01") BigDecimal amount,
    @Size(min=3,max=3) String currency,
    @NotNull Transaction.TxType type,
    Transaction.TxStatus status,
    @Size(max=500) String description,
    @Size(max=100) String referenceId
) {}
