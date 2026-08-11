-- ============================================================
-- Migration 003: Pin to Sidebar (Budgets & Savings Goals)
-- ============================================================

ALTER TABLE budgets ADD COLUMN pinned INTEGER NOT NULL DEFAULT 0;
ALTER TABLE savings_goals ADD COLUMN pinned INTEGER NOT NULL DEFAULT 0;
