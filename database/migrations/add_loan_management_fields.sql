-- Migration: Add loan management fields for rejection and modification tracking
-- Date: 2026-01-29
-- Description: Adds fields to track loan rejections and term modifications by bankers

-- Campos para rechazo de préstamos
ALTER TABLE loans ADD COLUMN IF NOT EXISTS rejected_at TIMESTAMPTZ;
ALTER TABLE loans ADD COLUMN IF NOT EXISTS rejected_by VARCHAR(20);
ALTER TABLE loans ADD COLUMN IF NOT EXISTS rejection_reason TEXT;

-- Campos para modificación de términos
ALTER TABLE loans ADD COLUMN IF NOT EXISTS original_loan_amount BIGINT;
ALTER TABLE loans ADD COLUMN IF NOT EXISTS original_term_months INTEGER;
ALTER TABLE loans ADD COLUMN IF NOT EXISTS modified_by VARCHAR(20);
ALTER TABLE loans ADD COLUMN IF NOT EXISTS modified_at TIMESTAMPTZ;
ALTER TABLE loans ADD COLUMN IF NOT EXISTS modification_reason TEXT;

-- Índices para mejorar queries
CREATE INDEX IF NOT EXISTS idx_loans_rejected_at ON loans(rejected_at);
CREATE INDEX IF NOT EXISTS idx_loans_modified_at ON loans(modified_at);
