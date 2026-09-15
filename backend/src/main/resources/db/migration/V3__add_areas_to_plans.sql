-- Flyway migration V3: Add areas column to plans table
ALTER TABLE plans ADD COLUMN IF NOT EXISTS areas TEXT;
