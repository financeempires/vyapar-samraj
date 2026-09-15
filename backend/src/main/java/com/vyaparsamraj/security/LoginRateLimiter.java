package com.vyaparsamraj.security;

import com.vyaparsamraj.exception.RateLimitException;
import io.github.bucket4j.Bandwidth;
import io.github.bucket4j.Bucket;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import java.time.Duration;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

/**
 * In-memory rate limiter for login attempts using Bucket4j.
 * Keyed by client IP — no Redis required.
 *
 * Config: app.rate-limit.login.capacity (default 5 attempts per 15 minutes)
 */
@Component
public class LoginRateLimiter {

    private final Map<String, Bucket> buckets = new ConcurrentHashMap<>();
    private final long capacity;
    private final long refillMinutes;

    public LoginRateLimiter(
            @Value("${app.rate-limit.login.capacity:5}") long capacity,
            @Value("${app.rate-limit.login.refill-minutes:15}") long refillMinutes) {
        this.capacity     = capacity;
        this.refillMinutes = refillMinutes;
    }

    public void checkLimit(String ip) {
        Bucket bucket = buckets.computeIfAbsent(ip, this::newBucket);
        if (!bucket.tryConsume(1)) {
            throw new RateLimitException();
        }
    }

    private Bucket newBucket(String ip) {
        Bandwidth limit = Bandwidth.builder()
                .capacity(capacity)
                .refillGreedy(capacity, Duration.ofMinutes(refillMinutes))
                .build();
        return Bucket.builder().addLimit(limit).build();
    }
}
