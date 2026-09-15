package com.vyaparsamraj.security;

import lombok.Getter;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.userdetails.UserDetails;
import java.util.Collection;
import java.util.List;
import java.util.UUID;

/**
 * The principal stored in the SecurityContext after JWT validation.
 * No password is stored here — it's only used for authorization decisions.
 */
@Getter
public class AppUserPrincipal implements UserDetails {

    private final UUID id;
    private final String username;
    private final String fullName;
    private final String role;           // "SUPER_ADMIN" | "USER" | "SUB_USER"
    private final String parentId;       // null unless SUB_USER

    public AppUserPrincipal(UUID id, String username, String fullName,
                            String role, String parentId) {
        this.id       = id;
        this.username = username;
        this.fullName = fullName;
        this.role     = role;
        this.parentId = parentId;
    }

    @Override
    public Collection<? extends GrantedAuthority> getAuthorities() {
        return List.of(new SimpleGrantedAuthority("ROLE_" + role));
    }

    // ── No password stored in principal ──────────────────────────────────────
    @Override public String getPassword()            { return null; }
    @Override public boolean isAccountNonExpired()   { return true; }
    @Override public boolean isAccountNonLocked()    { return true; }
    @Override public boolean isCredentialsNonExpired(){ return true; }
    @Override public boolean isEnabled()             { return true; }

    public boolean isSuperAdmin() { return "SUPER_ADMIN".equals(role); }
    public boolean isUser()       { return "USER".equals(role); }
    public boolean isSubUser()    { return "SUB_USER".equals(role); }

    /** Returns the data-scope owner id (null = admin = no filter) */
    public UUID getOwnerId() {
        if (isSuperAdmin()) return null;
        if (isSubUser() && parentId != null) return UUID.fromString(parentId);
        return id;
    }
}
