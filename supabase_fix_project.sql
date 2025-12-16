-- FIX & UPDATE SCRIPT
-- Run this in the Supabase SQL Editor

-- 1. Fix 'time_logs' ID generation (Solve "Error al iniciar turno")
-- We switch to gen_random_uuid() which is built-in and doesn't depend on extensions sometimes failing to load.
ALTER TABLE time_logs ALTER COLUMN id SET DEFAULT gen_random_uuid();
ALTER TABLE activity_logs ALTER COLUMN id SET DEFAULT gen_random_uuid();
ALTER TABLE bolos ALTER COLUMN id SET DEFAULT gen_random_uuid();
ALTER TABLE applications ALTER COLUMN id SET DEFAULT gen_random_uuid();
ALTER TABLE citizens ALTER COLUMN id SET DEFAULT gen_random_uuid();
ALTER TABLE credit_cards ALTER COLUMN id SET DEFAULT gen_random_uuid();

-- 2. Update 'citizens' table for DNI Image
ALTER TABLE citizens ADD COLUMN IF NOT EXISTS dni_image_url text;

-- 3. Create Storage Bucket for DNI Images
INSERT INTO storage.buckets (id, name, public) 
VALUES ('dni-images', 'dni-images', true)
ON CONFLICT (id) DO NOTHING;

-- 4. Storage Policies for DNI Images
DROP POLICY IF EXISTS "Staff can upload dni images" ON storage.objects;
CREATE POLICY "Staff can upload dni images"
ON storage.objects FOR INSERT
WITH CHECK ( bucket_id = 'dni-images' AND auth.role() = 'authenticated' );

DROP POLICY IF EXISTS "Public can view dni images" ON storage.objects;
CREATE POLICY "Public can view dni images"
ON storage.objects FOR SELECT
USING ( bucket_id = 'dni-images' );
