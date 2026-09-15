-- =============================================================================
-- Seed: Create initial Super Admin account
-- Run AFTER schema.sql
--
-- Replace 'your_password' below with your chosen password before running.
-- This uses pgcrypto crypt() with bcrypt (bf) hashing.
-- =============================================================================

INSERT INTO super_admin_accounts (email, username, password_hash, full_name)
VALUES (
  'admin@vyaparsamraj.com',
  'superadmin',
  crypt('your_password', gen_salt('bf', 10)),
  'Super Admin'
)
ON CONFLICT (username) DO NOTHING;
