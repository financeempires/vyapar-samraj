-- =============================================================================
-- V1 — Baseline migration (Flyway marks this as applied without running it
--       when baseline-on-migrate=true and baseline-version=1 is set,
--       because the Neon database already contains the full schema.)
-- =============================================================================
-- This file documents the authoritative schema.
-- DO NOT DROP OR ALTER EXISTING TABLES.
-- Future schema changes go in V2__..., V3__..., etc.
-- =============================================================================

-- Extensions
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- ENUM types
DO $$ BEGIN CREATE TYPE user_role AS ENUM ('SUPER_ADMIN', 'USER', 'SUB_USER'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE user_status AS ENUM ('active', 'inactive', 'pending', 'expired'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE tx_type AS ENUM ('payment', 'refund', 'adjustment'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE tx_status AS ENUM ('pending', 'completed', 'failed', 'refunded'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE sub_status AS ENUM ('active', 'expired', 'cancelled', 'pending'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS super_admin_accounts (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  email         TEXT        NOT NULL UNIQUE,
  username      TEXT        NOT NULL UNIQUE,
  password_hash TEXT        NOT NULL,
  pin_hash      TEXT,
  full_name     TEXT        NOT NULL DEFAULT 'Super Admin',
  last_login_at TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS profiles (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  username     TEXT        NOT NULL UNIQUE,
  email        TEXT        NOT NULL UNIQUE,
  full_name    TEXT        NOT NULL DEFAULT '',
  role         user_role   NOT NULL DEFAULT 'USER',
  status       user_status NOT NULL DEFAULT 'pending',
  organization TEXT,
  parent_id    UUID        REFERENCES profiles(id) ON DELETE SET NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS plans (
  id            UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  name          TEXT          NOT NULL,
  description   TEXT,
  price         NUMERIC(12,2) NOT NULL DEFAULT 0,
  currency      CHAR(3)       NOT NULL DEFAULT 'INR',
  duration_days INT           NOT NULL DEFAULT 30,
  features      JSONB         NOT NULL DEFAULT '{}',
  is_active     BOOLEAN       NOT NULL DEFAULT TRUE,
  created_at    TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS subscriptions (
  id           UUID       PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID       NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  plan_id      UUID       NOT NULL REFERENCES plans(id)    ON DELETE RESTRICT,
  start_date   TIMESTAMPTZ NOT NULL,
  end_date     TIMESTAMPTZ NOT NULL,
  status       sub_status  NOT NULL DEFAULT 'pending',
  auto_renewal BOOLEAN     NOT NULL DEFAULT FALSE,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

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

CREATE TABLE IF NOT EXISTS activity_logs (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  type        TEXT        NOT NULL,
  description TEXT        NOT NULL,
  actor_id    TEXT,
  metadata    JSONB       NOT NULL DEFAULT '{}',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS notifications (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient_id TEXT        NOT NULL,
  type         TEXT        NOT NULL,
  title        TEXT        NOT NULL,
  body         TEXT        NOT NULL DEFAULT '',
  is_read      BOOLEAN     NOT NULL DEFAULT FALSE,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
