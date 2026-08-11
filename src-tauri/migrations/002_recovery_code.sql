-- ============================================================
-- Migration 002: Password Recovery Code
-- ============================================================

ALTER TABLE security ADD COLUMN recovery_code_hash TEXT;
