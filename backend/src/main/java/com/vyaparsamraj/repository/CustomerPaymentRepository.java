package com.vyaparsamraj.repository;

import com.vyaparsamraj.entity.CustomerPayment;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.math.BigDecimal;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface CustomerPaymentRepository extends JpaRepository<CustomerPayment, UUID> {

    List<CustomerPayment> findByCustomerIdOrderByCreatedAtAscIdAsc(UUID customerId);

    @Query("SELECT p FROM CustomerPayment p WHERE p.customerId = :customerId AND (p.loanId = :loanId OR (:loanId = :customerId AND p.loanId IS NULL)) ORDER BY p.createdAt ASC, p.paymentDate ASC")
    List<CustomerPayment> findByCustomerIdAndLoanId(@Param("customerId") UUID customerId, @Param("loanId") UUID loanId);

    @Query("SELECT COALESCE(SUM(p.amount), 0) FROM CustomerPayment p WHERE p.customerId = :customerId AND (p.loanId = :customerId OR p.loanId IS NULL)")
    BigDecimal sumAmountByCustomerIdMainLoan(@Param("customerId") UUID customerId);

    @Query("SELECT COALESCE(SUM(p.amount), 0) FROM CustomerPayment p WHERE p.loanId = :loanId")
    BigDecimal sumAmountByLoanId(@Param("loanId") UUID loanId);

    @Query("SELECT COALESCE(SUM(p.amount), 0) FROM CustomerPayment p WHERE p.loanId = :loanId AND p.id <> :excludePaymentId")
    BigDecimal sumAmountByLoanIdExcluding(@Param("loanId") UUID loanId, @Param("excludePaymentId") UUID excludePaymentId);

    @Query("SELECT COALESCE(SUM(p.amount), 0) FROM CustomerPayment p WHERE p.customerId = :customerId AND (p.loanId = :customerId OR p.loanId IS NULL) AND p.id <> :excludePaymentId")
    BigDecimal sumAmountByCustomerIdMainLoanExcluding(@Param("customerId") UUID customerId, @Param("excludePaymentId") UUID excludePaymentId);

    Optional<CustomerPayment> findByIdAndCustomerId(UUID id, UUID customerId);
}
