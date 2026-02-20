-- Fix: Add missing citizen_dni_id to existing visa_requests table
-- Run this if you already executed the original visa_system.sql

-- Add the column if it doesn't exist
ALTER TABLE public.visa_requests 
ADD COLUMN IF NOT EXISTS citizen_dni_id INTEGER REFERENCES public.citizen_dni(id);

-- Recreate the pending_visa_requests view with the correct column
DROP VIEW IF EXISTS pending_visa_requests;

CREATE OR REPLACE VIEW pending_visa_requests AS
SELECT 
    vr.*,
    d.nombre,
    d.apellido
FROM public.visa_requests vr
LEFT JOIN public.citizen_dni d ON vr.citizen_dni_id = d.id
WHERE vr.status = 'pending'
ORDER BY vr.created_at ASC;
