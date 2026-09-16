package com.vyaparsamraj.repository;

import com.vyaparsamraj.entity.CustomerLoan;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface CustomerLoanRepository extends JpaRepository<CustomerLoan, UUID> {

    List<CustomerLoan> findByCustomerIdAndUserIdOrderByCreatedAtDesc(UUID customerId, UUID userId);

    Optional<CustomerLoan> findByIdAndUserId(UUID id, UUID userId);
}
