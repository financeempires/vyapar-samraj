package com.vyaparsamraj.repository;

import com.vyaparsamraj.entity.Notification;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface NotificationRepository extends JpaRepository<Notification, UUID> {
    List<Notification> findTop50ByRecipientIdOrderByCreatedAtDesc(String recipientId);
    Optional<Notification> findByIdAndRecipientId(UUID id, String recipientId);
}
