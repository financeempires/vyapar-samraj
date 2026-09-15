package com.vyaparsamraj.controller;

import com.vyaparsamraj.dto.ApiResponse;
import com.vyaparsamraj.service.EmailService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@Slf4j
@RestController
@RequestMapping("/api/dev")
@RequiredArgsConstructor
public class EmailTestController {

    private final EmailService emailService;

    /**
     * Temporary development-only SMTP test endpoint.
     * Triggers a real test email via Gmail SMTP (JavaMailSender).
     * SECURITY: Never returns or exposes SMTP credentials in logs or response.
     */
    @PostMapping("/test-email")
    public ResponseEntity<ApiResponse<Map<String, Object>>> sendTestEmail(
            @RequestParam(defaultValue = "financeempire2121@gmail.com") String to) {
        
        boolean success = emailService.sendTestEmail(to);
        if (success) {
            return ResponseEntity.ok(ApiResponse.ok(Map.of(
                "status", "SUCCESS",
                "message", "Test email sent successfully via Gmail SMTP",
                "recipient", to
            )));
        } else {
            return ResponseEntity.status(500).body(
                ApiResponse.error("Failed to send test email via Gmail SMTP")
            );
        }
    }
}
