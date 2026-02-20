-- Migration: Add Security Fields to Dealership Sales
-- Purpose: Enable license plates and wanted status for vehicles

ALTER TABLE dealership_sales 
ADD COLUMN IF NOT EXISTS plate VARCHAR(10) UNIQUE,
ADD COLUMN IF NOT EXISTS wanted BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS wanted_reason TEXT;

-- Create index for fast plate lookup
CREATE INDEX IF NOT EXISTS idx_sales_plate ON dealership_sales(plate);

-- Create index for wanted vehicles
CREATE INDEX IF NOT EXISTS idx_sales_wanted ON dealership_sales(wanted) WHERE wanted = TRUE;
