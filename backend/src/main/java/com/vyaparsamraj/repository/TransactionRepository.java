package com.vyaparsamraj.repository;

import com.vyaparsamraj.entity.Transaction;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;
import java.math.BigDecimal;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface TransactionRepository extends JpaRepository<Transaction, UUID> {

    Page<Transaction> findByUserId(UUID userId, Pageable pageable);

    Page<Transaction> findByUserIdAndStatus(UUID userId, Transaction.TxStatus status, Pageable pageable);

    Page<Transaction> findByStatus(Transaction.TxStatus status, Pageable pageable);

    Optional<Transaction> findByIdAndUserId(UUID id, UUID userId);

    @Query("SELECT COALESCE(SUM(t.amount), 0) FROM Transaction t WHERE t.status = 'completed'")
    BigDecimal sumCompletedRevenue();
}
