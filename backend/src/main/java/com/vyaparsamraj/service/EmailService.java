package com.vyaparsamraj.service;

import jakarta.mail.internet.MimeMessage;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.mail.javamail.MimeMessageHelper;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.time.LocalDateTime;

@Slf4j
@Service
@RequiredArgsConstructor
public class EmailService {

    private final JavaMailSender javaMailSender;

    @Value("${spring.mail.username:financeempire2121@gmail.com}")
    private String smtpFromEmail;

    @Value("${RESEND_API_KEY:}")
    private String resendApiKey;

    @Value("${SUPER_ADMIN_OTP_FROM:Vyapar Samraj <onboarding@resend.dev>}")
    private String resendSenderEmail;

    private final HttpClient httpClient = HttpClient.newBuilder()
            .connectTimeout(Duration.ofSeconds(5))
            .build();

    /**
     * Sends an OTP verification email via JavaMailSender (Gmail SMTP).
     * Async execution prevents blocking the login HTTP thread.
     */
    @Async
    public void sendOtpEmail(String toEmail, String otpCode) {
        String subject = "Vyapar Samraj - Super Admin Login OTP";
        String htmlContent = """
            <div style="font-family: Arial, sans-serif; max-width: 500px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 12px; background-color: #ffffff;">
              <h2 style="color: #2351D9; margin-top: 0;">Vyapar Samraj</h2>
              <p style="font-size: 16px; color: #0D1B3E; margin-bottom: 8px;">Your Super Admin login verification code is:</p>
              <div style="font-size: 32px; font-weight: bold; letter-spacing: 8px; color: #2351D9; background-color: #F8FAFF; border: 1px solid #DBEAFE; border-radius: 8px; padding: 16px; text-align: center; margin: 16px 0;">
                %s
              </div>
              <p style="font-size: 14px; color: #64748B;">This code is valid for <strong>5 minutes</strong>. Do not share this code with anyone.</p>
              <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 20px 0;" />
              <p style="font-size: 12px; color: #94A3B8; margin-bottom: 0;">If you did not attempt to log in, please secure your account immediately.</p>
            </div>
            """.formatted(otpCode);

        send(toEmail, subject, htmlContent);
    }

    @Async
    public void sendForgotPasswordOtpEmail(String toEmail, String otpCode) {
        String subject = "Vyapar Samraj - Super Admin Password Reset OTP";
        String htmlContent = """
            <div style="font-family: Arial, sans-serif; max-width: 500px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 12px; background-color: #ffffff;">
              <h2 style="color: #2351D9; margin-top: 0;">Vyapar Samraj</h2>
              <p style="font-size: 16px; color: #0D1B3E; margin-bottom: 8px;">Your Super Admin password reset verification code is:</p>
              <div style="font-size: 32px; font-weight: bold; letter-spacing: 8px; color: #2351D9; background-color: #F8FAFF; border: 1px solid #DBEAFE; border-radius: 8px; padding: 16px; text-align: center; margin: 16px 0;">
                %s
              </div>
              <p style="font-size: 14px; color: #64748B;">This code is valid for <strong>5 minutes</strong>. Do not share this code with anyone.</p>
              <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 20px 0;" />
              <p style="font-size: 12px; color: #94A3B8; margin-bottom: 0;">If you did not request a password reset, please secure your account immediately.</p>
            </div>
            """.formatted(otpCode);

        send(toEmail, subject, htmlContent);
    }

    @Async
    public void sendPinResetOtpEmail(String toEmail, String otpCode) {
        String subject = "Vyapar Samraj - Security PIN Reset OTP";
        String htmlContent = """
            <div style="font-family: Arial, sans-serif; max-width: 500px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 12px; background-color: #ffffff;">
              <h2 style="color: #2351D9; margin-top: 0;">Vyapar Samraj</h2>
              <p style="font-size: 16px; color: #0D1B3E; margin-bottom: 8px;">Your Security PIN reset verification code is:</p>
              <div style="font-size: 32px; font-weight: bold; letter-spacing: 8px; color: #2351D9; background-color: #F8FAFF; border: 1px solid #DBEAFE; border-radius: 8px; padding: 16px; text-align: center; margin: 16px 0;">
                %s
              </div>
              <p style="font-size: 14px; color: #64748B;">This code is valid for <strong>5 minutes</strong>. Do not share this code with anyone.</p>
              <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 20px 0;" />
              <p style="font-size: 12px; color: #94A3B8; margin-bottom: 0;">If you did not request a PIN reset, please secure your account immediately.</p>
            </div>
            """.formatted(otpCode);

        send(toEmail, subject, htmlContent);
    }

    @Async
    public void sendLoginNotification(String toEmail, String fullName) {
        send(toEmail,
             "New login to your Vyapar Samraj account",
             "<p>Hello " + fullName + ",</p><p>A new Super Admin login was detected on your account.</p>");
    }

    /**
     * Sends a test email via JavaMailSender to verify SMTP connectivity & credentials.
     * Returns true if sent successfully.
     */
    public boolean sendTestEmail(String toEmail) {
        String subject = "Vyapar Samraj — Gmail SMTP Integration Test";
        String htmlContent = """
            <div style="font-family: Arial, sans-serif; max-width: 500px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 12px; background-color: #ffffff;">
              <h2 style="color: #2351D9; margin-top: 0;">Vyapar Samraj — SMTP Test</h2>
              <p style="font-size: 15px; color: #0D1B3E;">This test email confirms that your <strong>Spring Boot JavaMailSender</strong> is successfully connected to Gmail SMTP.</p>
              <div style="background-color: #ECFDF5; border: 1px solid #A7F3D0; border-radius: 8px; padding: 12px 16px; margin: 16px 0;">
                <p style="color: #065F46; font-weight: bold; margin: 0;">✓ SMTP Connection: PASS</p>
                <p style="color: #065F46; font-weight: bold; margin: 4px 0 0 0;">✓ Authentication: PASS</p>
              </div>
              <p style="font-size: 12px; color: #64748B;">Timestamp: %s</p>
            </div>
            """.formatted(LocalDateTime.now().toString());

        return send(toEmail, subject, htmlContent);
    }

    private boolean send(String to, String subject, String htmlBody) {
        // Attempt 1: JavaMailSender (Gmail SMTP)
        if (javaMailSender != null) {
            try {
                MimeMessage message = javaMailSender.createMimeMessage();
                MimeMessageHelper helper = new MimeMessageHelper(message, true, "UTF-8");
                helper.setFrom(smtpFromEmail, "Vyapar Samraj");
                helper.setTo(to);
                helper.setSubject(subject);
                helper.setText(htmlBody, true);

                javaMailSender.send(message);
                log.info("[SMTP JavaMailSender] Successfully sent email to recipient: {}", maskEmail(to));
                return true;
            } catch (Exception e) {
                log.error("[SMTP JavaMailSender Error] Failed sending email: {}", e.getMessage());
            }
        }

        // Attempt 2: Resend API Fallback
        if (resendApiKey != null && !resendApiKey.isBlank()) {
            try {
                String jsonPayload = """
                    {
                      "from": "%s",
                      "to": ["%s"],
                      "subject": "%s",
                      "html": %s
                    }
                    """.formatted(
                        escapeJson(resendSenderEmail),
                        escapeJson(to),
                        escapeJson(subject),
                        toJsonString(htmlBody)
                    );

                HttpRequest request = HttpRequest.newBuilder()
                        .uri(URI.create("https://api.resend.com/emails"))
                        .header("Authorization", "Bearer " + resendApiKey)
                        .header("Content-Type", "application/json")
                        .POST(HttpRequest.BodyPublishers.ofString(jsonPayload))
                        .build();

                httpClient.sendAsync(request, HttpResponse.BodyHandlers.ofString())
                        .thenAccept(res -> log.info("[Resend Email] Status: {} for to: {}", res.statusCode(), maskEmail(to)))
                        .exceptionally(ex -> {
                            log.error("[Resend Email Error] Failed to send email: {}", ex.getMessage());
                            return null;
                        });
                return true;
            } catch (Exception e) {
                log.error("[Email Service Error] Failed sending email via Resend: {}", e.getMessage());
            }
        }

        log.info("[Email Service] Simulated email delivery to: {} | Subject: {}", maskEmail(to), subject);
        return false;
    }

    private String maskEmail(String email) {
        if (email == null || !email.contains("@")) return "******@domain.com";
        String[] parts = email.split("@");
        return parts[0].charAt(0) + "***@" + parts[1];
    }

    private String escapeJson(String input) {
        if (input == null) return "";
        return input.replace("\"", "\\\"");
    }

    private String toJsonString(String input) {
        if (input == null) return "\"\"";
        return "\"" + input.replace("\\", "\\\\")
                           .replace("\"", "\\\"")
                           .replace("\n", "\\n")
                           .replace("\r", "\\r")
                           .replace("\t", "\\t") + "\"";
    }
}
