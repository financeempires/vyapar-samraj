package com.vyaparsamraj.security;

import io.jsonwebtoken.*;
import io.jsonwebtoken.security.Keys;
import jakarta.servlet.http.Cookie;
import jakarta.servlet.http.HttpServletRequest;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import javax.crypto.SecretKey;
import java.nio.charset.StandardCharsets;
import java.util.Date;
import java.util.UUID;

/**
 * JWT token creation + validation.
 *
 * Cookie name:  sa_session  (same as Next.js backend — tokens are cross-compatible)
 * Algorithm:    HS256
 * Claims:       id, username, fullName, role, parentId
 */
@Slf4j
@Component
public class JwtTokenProvider {

    @Value("${app.jwt.secret}")
    private String jwtSecret;

    @Value("${app.jwt.expiration-ms}")
    private long jwtExpirationMs;

    @Value("${app.jwt.cookie-name}")
    private String cookieName;

    private SecretKey key() {
        return Keys.hmacShaKeyFor(jwtSecret.getBytes(StandardCharsets.UTF_8));
    }

    public String generateToken(UUID id, String username, String fullName, String role) {
        return generateToken(id, username, fullName, role, null);
    }

    public String generateToken(UUID id, String username, String fullName, String role, String parentId) {
        var builder = Jwts.builder()
                .claim("id",       id.toString())
                .claim("username", username)
                .claim("fullName", fullName)
                .claim("role",     role)
                .issuedAt(new Date())
                .expiration(new Date(System.currentTimeMillis() + jwtExpirationMs))
                .signWith(key(), Jwts.SIG.HS256);

        if (parentId != null) {
            builder.claim("parentId", parentId);
        }

        return builder.compact();
    }

    public Claims parseClaims(String token) {
        return Jwts.parser()
                .verifyWith(key())
                .build()
                .parseSignedClaims(token)
                .getPayload();
    }

    public boolean validateToken(String token) {
        try {
            parseClaims(token);
            return true;
        } catch (JwtException | IllegalArgumentException e) {
            log.debug("JWT validation failed: {}", e.getMessage());
            return false;
        }
    }

    public String getTokenFromRequest(HttpServletRequest request) {
        String authHeader = request.getHeader("Authorization");
        if (authHeader != null && authHeader.startsWith("Bearer ")) {
            return authHeader.substring(7);
        }
        if (request.getCookies() != null) {
            for (Cookie c : request.getCookies()) {
                if (cookieName.equals(c.getName())) return c.getValue();
            }
        }
        String cookieHeader = request.getHeader("Cookie");
        if (cookieHeader != null) {
            String[] cookies = cookieHeader.split(";");
            for (String cookie : cookies) {
                String[] pair = cookie.trim().split("=", 2);
                if (pair.length == 2 && cookieName.equals(pair[0].trim())) {
                    return pair[1].trim();
                }
            }
        }
        return null;
    }

    public String getCookieName() { return cookieName; }

    public long getExpirationMs() { return jwtExpirationMs; }
}
