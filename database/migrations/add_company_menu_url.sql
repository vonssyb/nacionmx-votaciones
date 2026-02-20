-- Add menu_url field to companies table
-- This field will store the URL to the company's menu/catalog

ALTER TABLE companies 
ADD COLUMN IF NOT EXISTS menu_url TEXT;

-- Add comment to explain the field
COMMENT ON COLUMN companies.menu_url IS 'URL to company menu/catalog/services list';
