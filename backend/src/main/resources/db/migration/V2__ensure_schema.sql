-- =============================================================================
-- V2 — Defensive schema reconciliation (fully idempotent)
-- Handles a Neon database where tables may exist with partial columns.
-- Strategy: CREATE TABLE IF NOT EXISTS, then ADD COLUMN IF NOT EXISTS for
-- each column, then create indexes only if their column exists.
-- =============================================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- ENUM types (no-op if already exist)
DO $$ BEGIN CREATE TYPE user_role AS ENUM ('SUPER_ADMIN', 'USER', 'SUB_USER'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE user_status AS ENUM ('active', 'inactive', 'pending', 'expired'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE tx_type AS ENUM ('payment', 'refund', 'adjustment'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE tx_status AS ENUM ('pending', 'completed', 'failed', 'refunded'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE sub_status AS ENUM ('active', 'expired', 'cancelled', 'pending'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ── Helper: create index only if column exists ────────────────────────────────
-- We do all index creation via DO blocks to avoid errors on missing columns.

-- ── super_admin_accounts ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS super_admin_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid()
);
ALTER TABLE super_admin_accounts ADD COLUMN IF NOT EXISTS email         TEXT        UNIQUE;
ALTER TABLE super_admin_accounts ADD COLUMN IF NOT EXISTS username      TEXT        UNIQUE;
ALTER TABLE super_admin_accounts ADD COLUMN IF NOT EXISTS password_hash TEXT;
ALTER TABLE super_admin_accounts ADD COLUMN IF NOT EXISTS pin_hash      TEXT;
ALTER TABLE super_admin_accounts ADD COLUMN IF NOT EXISTS full_name     TEXT        NOT NULL DEFAULT 'Super Admin';
ALTER TABLE super_admin_accounts ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMPTZ;
ALTER TABLE super_admin_accounts ADD COLUMN IF NOT EXISTS created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW();
ALTER TABLE super_admin_accounts ADD COLUMN IF NOT EXISTS updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW();
CREATE INDEX IF NOT EXISTS idx_super_admin_username ON super_admin_accounts (username);
CREATE INDEX IF NOT EXISTS idx_super_admin_email    ON super_admin_accounts (email);

-- ── profiles ──────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid()
);
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS username     TEXT        UNIQUE;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS email        TEXT        UNIQUE;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS full_name    TEXT        NOT NULL DEFAULT '';
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS role         user_role   NOT NULL DEFAULT 'USER';
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS status       user_status NOT NULL DEFAULT 'pending';
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS organization TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS parent_id    UUID;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW();
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW();
CREATE INDEX IF NOT EXISTS idx_profiles_username     ON profiles (username);
CREATE INDEX IF NOT EXISTS idx_profiles_email        ON profiles (email);
CREATE INDEX IF NOT EXISTS idx_profiles_role         ON profiles (role);
CREATE INDEX IF NOT EXISTS idx_profiles_status       ON profiles (status);
CREATE INDEX IF NOT EXISTS idx_profiles_parent_id    ON profiles (parent_id);

-- ── plans ─────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid()
);
ALTER TABLE plans ADD COLUMN IF NOT EXISTS name          TEXT          NOT NULL DEFAULT '';
ALTER TABLE plans ADD COLUMN IF NOT EXISTS description   TEXT;
ALTER TABLE plans ADD COLUMN IF NOT EXISTS price         NUMERIC(12,2) NOT NULL DEFAULT 0;
ALTER TABLE plans ADD COLUMN IF NOT EXISTS currency      CHAR(3)       NOT NULL DEFAULT 'INR';
ALTER TABLE plans ADD COLUMN IF NOT EXISTS duration_days INT           NOT NULL DEFAULT 30;
ALTER TABLE plans ADD COLUMN IF NOT EXISTS features      JSONB         NOT NULL DEFAULT '{}';
ALTER TABLE plans ADD COLUMN IF NOT EXISTS is_active     BOOLEAN       NOT NULL DEFAULT TRUE;
ALTER TABLE plans ADD COLUMN IF NOT EXISTS created_at    TIMESTAMPTZ   NOT NULL DEFAULT NOW();
ALTER TABLE plans ADD COLUMN IF NOT EXISTS updated_at    TIMESTAMPTZ   NOT NULL DEFAULT NOW();
CREATE INDEX IF NOT EXISTS idx_plans_created_at ON plans (created_at);
CREATE INDEX IF NOT EXISTS idx_plans_is_active  ON plans (is_active);

-- ── subscriptions ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid()
);
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS user_id      UUID;
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS plan_id      UUID;
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS start_date   TIMESTAMPTZ;
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS end_date     TIMESTAMPTZ;
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS status       sub_status  NOT NULL DEFAULT 'pending';
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS auto_renewal BOOLEAN     NOT NULL DEFAULT FALSE;
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW();
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW();
CREATE INDEX IF NOT EXISTS idx_subs_user_id  ON subscriptions (user_id);
CREATE INDEX IF NOT EXISTS idx_subs_plan_id  ON subscriptions (plan_id);
CREATE INDEX IF NOT EXISTS idx_subs_status   ON subscriptions (status);
CREATE INDEX IF NOT EXISTS idx_subs_end_date ON subscriptions (end_date);

-- ── transactions ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid()
);
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS user_id         UUID;
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS organization_id UUID;
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS amount          NUMERIC(14,2);
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS currency        CHAR(3)    NOT NULL DEFAULT 'INR';
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS type            tx_type;
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS status          tx_status  NOT NULL DEFAULT 'pending';
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS description     TEXT;
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS reference_id    TEXT;
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW();
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW();
CREATE INDEX IF NOT EXISTS idx_tx_user_id         ON transactions (user_id);
CREATE INDEX IF NOT EXISTS idx_tx_organization_id ON transactions (organization_id);
CREATE INDEX IF NOT EXISTS idx_tx_status          ON transactions (status);
CREATE INDEX IF NOT EXISTS idx_tx_created_at      ON transactions (created_at);
CREATE INDEX IF NOT EXISTS idx_tx_type            ON transactions (type);

-- ── activity_logs ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS activity_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid()
);
ALTER TABLE activity_logs ADD COLUMN IF NOT EXISTS type        TEXT        NOT NULL DEFAULT '';
ALTER TABLE activity_logs ADD COLUMN IF NOT EXISTS description TEXT        NOT NULL DEFAULT '';
ALTER TABLE activity_logs ADD COLUMN IF NOT EXISTS actor_id    TEXT;
ALTER TABLE activity_logs ADD COLUMN IF NOT EXISTS metadata    JSONB       NOT NULL DEFAULT '{}';
ALTER TABLE activity_logs ADD COLUMN IF NOT EXISTS created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW();
CREATE INDEX IF NOT EXISTS idx_activity_actor      ON activity_logs (actor_id);
CREATE INDEX IF NOT EXISTS idx_activity_type       ON activity_logs (type);
CREATE INDEX IF NOT EXISTS idx_activity_created_at ON activity_logs (created_at DESC);

-- ── notifications ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid()
);
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS recipient_id TEXT        NOT NULL DEFAULT '';
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS type         TEXT        NOT NULL DEFAULT '';
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS title        TEXT        NOT NULL DEFAULT '';
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS body         TEXT        NOT NULL DEFAULT '';
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS is_read      BOOLEAN     NOT NULL DEFAULT FALSE;
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW();
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW();
CREATE INDEX IF NOT EXISTS idx_notifications_recipient ON notifications (recipient_id);
CREATE INDEX IF NOT EXISTS idx_notifications_is_read   ON notifications (is_read);
CREATE INDEX IF NOT EXISTS idx_notifications_created   ON notifications (created_at DESC);
