-- =============================================================================
-- VYAPAR SAMRAJ — Neon PostgreSQL Schema
-- Run this once to create all required tables, indexes, and RLS policies.
-- =============================================================================

-- ── Extensions ────────────────────────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS "pgcrypto";    -- for gen_random_uuid() and crypt()
CREATE EXTENSION IF NOT EXISTS "pg_trgm";     -- for ILIKE text search indexes

-- ── ENUM types ────────────────────────────────────────────────────────────────
DO $$ BEGIN
  CREATE TYPE user_role   AS ENUM ('SUPER_ADMIN', 'USER', 'SUB_USER');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE user_status AS ENUM ('active', 'inactive', 'pending', 'expired');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE tx_type     AS ENUM ('payment', 'refund', 'adjustment');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE tx_status   AS ENUM ('pending', 'completed', 'failed', 'refunded');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE sub_status  AS ENUM ('active', 'expired', 'cancelled', 'pending');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- =============================================================================
-- 1. SUPER ADMIN ACCOUNTS
-- =============================================================================
CREATE TABLE IF NOT EXISTS super_admin_accounts (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  email          TEXT        NOT NULL UNIQUE,
  username       TEXT        NOT NULL UNIQUE,
  password_hash  TEXT        NOT NULL,
  pin_hash       TEXT,
  full_name      TEXT        NOT NULL DEFAULT 'Super Admin',
  last_login_at  TIMESTAMPTZ,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_super_admin_username ON super_admin_accounts (username);
CREATE INDEX IF NOT EXISTS idx_super_admin_email    ON super_admin_accounts (email);

-- =============================================================================
-- 2. PROFILES  (users and sub-users)
-- =============================================================================
CREATE TABLE IF NOT EXISTS profiles (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  username        TEXT        NOT NULL UNIQUE,
  email           TEXT        NOT NULL UNIQUE,
  full_name       TEXT        NOT NULL DEFAULT '',
  role            user_role   NOT NULL DEFAULT 'USER',
  status          user_status NOT NULL DEFAULT 'pending',
  organization    TEXT,
  parent_id       UUID        REFERENCES profiles(id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_profiles_username     ON profiles (username);
CREATE INDEX IF NOT EXISTS idx_profiles_email        ON profiles (email);
CREATE INDEX IF NOT EXISTS idx_profiles_role         ON profiles (role);
CREATE INDEX IF NOT EXISTS idx_profiles_status       ON profiles (status);
CREATE INDEX IF NOT EXISTS idx_profiles_parent_id    ON profiles (parent_id);
CREATE INDEX IF NOT EXISTS idx_profiles_organization ON profiles (organization);
-- Trigram index for ILIKE searches
CREATE INDEX IF NOT EXISTS idx_profiles_search ON profiles USING GIN (
  (username || ' ' || full_name || ' ' || email) gin_trgm_ops
);

-- =============================================================================
-- 3. PLANS
-- =============================================================================
CREATE TABLE IF NOT EXISTS plans (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  name          TEXT        NOT NULL,
  description   TEXT,
  price         NUMERIC(12,2) NOT NULL DEFAULT 0,
  currency      CHAR(3)     NOT NULL DEFAULT 'INR',
  duration_days INT         NOT NULL DEFAULT 30,
  areas         TEXT,
  features      JSONB       NOT NULL DEFAULT '{}',
  is_active     BOOLEAN     NOT NULL DEFAULT TRUE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_plans_is_active  ON plans (is_active);
CREATE INDEX IF NOT EXISTS idx_plans_created_at ON plans (created_at);

-- =============================================================================
-- 4. SUBSCRIPTIONS
-- =============================================================================
CREATE TABLE IF NOT EXISTS subscriptions (
  id           UUID       PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID       NOT NULL REFERENCES profiles(id)      ON DELETE CASCADE,
  plan_id      UUID       NOT NULL REFERENCES plans(id)         ON DELETE RESTRICT,
  max_sub_users INT       DEFAULT NULL,
  start_date   TIMESTAMPTZ NOT NULL,
  end_date     TIMESTAMPTZ NOT NULL,
  status       sub_status  NOT NULL DEFAULT 'pending',
  auto_renewal BOOLEAN     NOT NULL DEFAULT FALSE,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_subs_user_id    ON subscriptions (user_id);
CREATE INDEX IF NOT EXISTS idx_subs_plan_id    ON subscriptions (plan_id);
CREATE INDEX IF NOT EXISTS idx_subs_status     ON subscriptions (status);
CREATE INDEX IF NOT EXISTS idx_subs_end_date   ON subscriptions (end_date);

-- =============================================================================
-- 5. TRANSACTIONS
-- =============================================================================
CREATE TABLE IF NOT EXISTS transactions (
  id              UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID          NOT NULL REFERENCES profiles(id) ON DELETE RESTRICT,
  organization_id UUID,
  amount          NUMERIC(14,2) NOT NULL,
  currency        CHAR(3)       NOT NULL DEFAULT 'INR',
  type            tx_type       NOT NULL,
  status          tx_status     NOT NULL DEFAULT 'pending',
  description     TEXT,
  reference_id    TEXT,
  created_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tx_user_id         ON transactions (user_id);
CREATE INDEX IF NOT EXISTS idx_tx_organization_id ON transactions (organization_id);
CREATE INDEX IF NOT EXISTS idx_tx_status          ON transactions (status);
CREATE INDEX IF NOT EXISTS idx_tx_created_at      ON transactions (created_at);
CREATE INDEX IF NOT EXISTS idx_tx_type            ON transactions (type);

-- =============================================================================
-- 6. ACTIVITY LOGS  (audit trail)
-- =============================================================================
CREATE TABLE IF NOT EXISTS activity_logs (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  type        TEXT        NOT NULL,
  description TEXT        NOT NULL,
  actor_id    TEXT,                    -- UUID as text to allow super-admin IDs
  metadata    JSONB       NOT NULL DEFAULT '{}',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_activity_actor      ON activity_logs (actor_id);
CREATE INDEX IF NOT EXISTS idx_activity_type       ON activity_logs (type);
CREATE INDEX IF NOT EXISTS idx_activity_created_at ON activity_logs (created_at DESC);

-- =============================================================================
-- 7. NOTIFICATIONS
-- =============================================================================
CREATE TABLE IF NOT EXISTS notifications (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient_id  TEXT        NOT NULL,   -- can be super-admin or profile UUID
  type          TEXT        NOT NULL,
  title         TEXT        NOT NULL,
  body          TEXT        NOT NULL DEFAULT '',
  is_read       BOOLEAN     NOT NULL DEFAULT FALSE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notifications_recipient ON notifications (recipient_id);
CREATE INDEX IF NOT EXISTS idx_notifications_is_read   ON notifications (is_read);
CREATE INDEX IF NOT EXISTS idx_notifications_created   ON notifications (created_at DESC);

-- =============================================================================
-- 8. AREAS (User-scoped areas)
-- =============================================================================
CREATE TABLE IF NOT EXISTS areas (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  name          TEXT        NOT NULL,
  section       VARCHAR(20) NOT NULL DEFAULT 'DAILY',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_areas_user_id ON areas (user_id);
CREATE INDEX IF NOT EXISTS idx_areas_section ON areas (section);
