package com.vyaparsamraj.audit;

import com.vyaparsamraj.entity.ActivityLog;
import com.vyaparsamraj.repository.ActivityLogRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;
import java.util.Map;

/**
 * Async audit logger — fires and forgets.
 * Logs internally on failure but never blocks the main request.
 * NEVER log passwords, PINs, JWTs, or DB credentials.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class AuditLogger {

    private final ActivityLogRepository repo;

    @Async
    public void log(String type, String description, String actorId) {
        log(type, description, actorId, Map.of());
    }

    @Async
    public void log(String type, String description, String actorId, Map<String, Object> metadata) {
        try {
            repo.save(ActivityLog.builder()
                    .type(type)
                    .description(description)
                    .actorId(actorId)
                    .metadata(metadata)
                    .build());
        } catch (Exception e) {
            log.warn("Failed to write audit log [type={}]: {}", type, e.getMessage());
        }
    }
}
