package com.vyaparsamraj.service;

import com.vyaparsamraj.entity.Notification;
import com.vyaparsamraj.exception.*;
import com.vyaparsamraj.repository.NotificationRepository;
import com.vyaparsamraj.security.AppUserPrincipal;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.util.*;

@Service
@RequiredArgsConstructor
public class NotificationService {

    private final NotificationRepository repo;

    public List<Notification> list(AppUserPrincipal p) {
        return repo.findTop50ByRecipientIdOrderByCreatedAtDesc(p.getId().toString());
    }

    @Transactional
    public Notification markRead(AppUserPrincipal p, UUID id) {
        Notification n = repo.findByIdAndRecipientId(id, p.getId().toString())
                .orElseThrow(() -> new ResourceNotFoundException("Notification not found"));
        n.setIsRead(true);
        return repo.save(n);
    }
}
