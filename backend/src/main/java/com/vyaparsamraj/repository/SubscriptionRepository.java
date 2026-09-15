package com.vyaparsamraj.repository;

import com.vyaparsamraj.entity.Subscription;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface SubscriptionRepository extends JpaRepository<Subscription, UUID> {

    Page<Subscription> findByUserId(UUID userId, Pageable pageable);

    Page<Subscription> findByUserIdAndStatus(UUID userId, Subscription.SubStatus status, Pageable pageable);

    Page<Subscription> findByStatus(Subscription.SubStatus status, Pageable pageable);

    Optional<Subscription> findByIdAndUserId(UUID id, UUID userId);
}
