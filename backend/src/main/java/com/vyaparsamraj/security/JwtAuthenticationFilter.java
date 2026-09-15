package com.vyaparsamraj.security;

import io.jsonwebtoken.Claims;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.filter.OncePerRequestFilter;
import java.io.IOException;
import java.util.UUID;

/**
 * Reads the sa_session HttpOnly cookie, validates the JWT,
 * and populates the SecurityContext on every request.
 */
@Slf4j
@RequiredArgsConstructor
public class JwtAuthenticationFilter extends OncePerRequestFilter {

    private final JwtTokenProvider jwtTokenProvider;

    @Override
    protected void doFilterInternal(HttpServletRequest request,
                                    HttpServletResponse response,
                                    FilterChain chain)
            throws ServletException, IOException {

        try {
            String token = jwtTokenProvider.getTokenFromRequest(request);

            if (token != null && jwtTokenProvider.validateToken(token)) {
                Claims claims = jwtTokenProvider.parseClaims(token);

                String id       = claims.get("id",       String.class);
                String username = claims.get("username", String.class);
                String fullName = claims.get("fullName", String.class);
                String role     = claims.get("role",     String.class);
                String parentId = claims.get("parentId", String.class); // may be null

                AppUserPrincipal principal = new AppUserPrincipal(
                        UUID.fromString(id), username, fullName, role, parentId);

                UsernamePasswordAuthenticationToken auth =
                        new UsernamePasswordAuthenticationToken(
                                principal, null, principal.getAuthorities());

                SecurityContextHolder.getContext().setAuthentication(auth);
            }
        } catch (Exception e) {
            log.debug("Failed to set authentication: {}", e.getMessage());
            SecurityContextHolder.clearContext();
        }

        chain.doFilter(request, response);
    }
}
