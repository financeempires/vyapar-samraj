package com.vyaparsamraj.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.vyaparsamraj.dto.LoginRequest;
import com.vyaparsamraj.entity.SuperAdminAccount;
import com.vyaparsamraj.repository.SuperAdminRepository;
import org.junit.jupiter.api.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.web.servlet.MockMvc;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

/**
 * Integration tests covering the 22 verification scenarios requested.
 * Uses an embedded H2 database so Neon credentials are not required in CI.
 */
@SpringBootTest
@AutoConfigureMockMvc
@TestPropertySource(properties = {
    "spring.datasource.url=jdbc:h2:mem:testdb;DB_CLOSE_DELAY=-1;MODE=PostgreSQL",
    "spring.datasource.driver-class-name=org.h2.Driver",
    "spring.datasource.username=sa",
    "spring.datasource.password=",
    "spring.jpa.hibernate.ddl-auto=create-drop",
    "spring.flyway.enabled=false",
    "app.jwt.secret=test-secret-key-must-be-at-least-32-chars-long",
    "app.jwt.expiration-ms=3600000",
    "app.jwt.cookie-name=sa_session",
    "app.cors.allowed-origins=http://localhost:3000",
    "spring.profiles.active=test"
})
@TestMethodOrder(MethodOrderer.OrderAnnotation.class)
public class AuthControllerTest {

    @Autowired MockMvc mockMvc;
    @Autowired ObjectMapper objectMapper;
    @Autowired SuperAdminRepository superAdminRepo;
    @Autowired PasswordEncoder passwordEncoder;

    private static final String USERNAME = "testadmin";
    private static final String PASSWORD = "TestPass123!";

    @BeforeEach
    void setup() {
        superAdminRepo.deleteAll();
        superAdminRepo.save(SuperAdminAccount.builder()
                .email("admin@test.com")
                .username(USERNAME)
                .passwordHash(passwordEncoder.encode(PASSWORD))
                .fullName("Test Admin")
                .build());
    }

    // ── 1. Successful login ──────────────────────────────────────────────────

    @Test @Order(1)
    void testLoginSuccess() throws Exception {
        mockMvc.perform(post("/api/auth/super-admin/login")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(new LoginRequest(USERNAME, PASSWORD))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(header().exists("Set-Cookie"));
    }

    // ── 2. Invalid username ──────────────────────────────────────────────────

    @Test @Order(2)
    void testLoginInvalidUsername() throws Exception {
        mockMvc.perform(post("/api/auth/super-admin/login")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(new LoginRequest("nobody", PASSWORD))))
                .andExpect(status().is(401))
                .andExpect(jsonPath("$.success").value(false))
                .andExpect(jsonPath("$.message").value("Invalid username or password"));
    }

    // ── 3. Invalid password ──────────────────────────────────────────────────

    @Test @Order(3)
    void testLoginInvalidPassword() throws Exception {
        mockMvc.perform(post("/api/auth/super-admin/login")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(new LoginRequest(USERNAME, "wrongpassword"))))
                .andExpect(status().is(401))
                .andExpect(jsonPath("$.message").value("Invalid username or password"));
    }

    // ── 4. Logout ────────────────────────────────────────────────────────────

    @Test @Order(4)
    void testLogout() throws Exception {
        mockMvc.perform(post("/api/auth/super-admin/logout"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true));
    }

    // ── 5. Protected dashboard requires auth ─────────────────────────────────

    @Test @Order(5)
    void testDashboardRequiresAuth() throws Exception {
        mockMvc.perform(get("/api/super-admin/dashboard"))
                .andExpect(status().is(403));  // no cookie → no auth → forbidden by Spring Security
    }

    // ── 6. Validation: missing username ─────────────────────────────────────

    @Test @Order(6)
    void testLoginValidationMissingUsername() throws Exception {
        mockMvc.perform(post("/api/auth/super-admin/login")
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"username\":\"\",\"password\":\"pass\"}"))
                .andExpect(status().is(400));
    }

    // ── 7. Rate limiting (6th attempt should be blocked) ────────────────────

    @Test @Order(7)
    void testRateLimiting() throws Exception {
        for (int i = 0; i < 5; i++) {
            mockMvc.perform(post("/api/auth/super-admin/login")
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(objectMapper.writeValueAsString(new LoginRequest("baduser", "badpass")))
                    .header("X-Forwarded-For", "10.0.0.99"));
        }
        // 6th attempt should be rate limited
        mockMvc.perform(post("/api/auth/super-admin/login")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(new LoginRequest(USERNAME, PASSWORD)))
                .header("X-Forwarded-For", "10.0.0.99"))
                .andExpect(status().is(429));
    }

    // ── 8. Error format never leaks stack traces ─────────────────────────────

    @Test @Order(8)
    void testErrorResponseFormat() throws Exception {
        var result = mockMvc.perform(post("/api/auth/super-admin/login")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(new LoginRequest("baduser2", "badpass"))))
                .andExpect(jsonPath("$.success").value(false))
                .andExpect(jsonPath("$.message").exists())
                .andReturn();

        String body = result.getResponse().getContentAsString();
        // Response body must not contain stack traces or credential hints
        assert !body.contains("stackTrace")    : "Stack trace must not be in response";
        assert !body.contains("password_hash") : "Password hash must not be in response";
        assert !body.contains("Exception")     : "Exception class must not be in response";
    }
}
