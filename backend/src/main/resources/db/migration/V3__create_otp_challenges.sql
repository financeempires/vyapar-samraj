-- =============================================================================
-- V3 — Create otp_challenges table for Super Admin 2FA / OTP verification
-- Stores hashed 6-digit OTPs with short expiration (5 mins) and attempt limits.
-- =============================================================================

CREATE TABLE IF NOT EXISTS otp_challenges (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  super_admin_id UUID        NOT NULL,
  otp_hash       TEXT        NOT NULL,
  attempt_count  INT         NOT NULL DEFAULT 0,
  used           BOOLEAN     NOT NULL DEFAULT FALSE,
  expires_at     TIMESTAMPTZ NOT NULL,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_otp_challenges_admin   ON otp_challenges (super_admin_id);
CREATE INDEX IF NOT EXISTS idx_otp_challenges_expires ON otp_challenges (expires_at);
