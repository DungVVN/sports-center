-- Add the single highest-authority role. This must stay in its own migration:
-- PostgreSQL cannot safely use a new enum value in the same transaction.
ALTER TYPE "user_role" ADD VALUE IF NOT EXISTS 'admin';
