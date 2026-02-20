-- Migration: Add CASCADE delete for purchase_transactions
-- This allows purchase_transactions to be automatically deleted when user_purchases are deleted

-- Drop existing foreign key constraint
ALTER TABLE purchase_transactions
DROP CONSTRAINT IF EXISTS purchase_transactions_purchase_id_fkey;

-- Recreate foreign key with ON DELETE CASCADE
ALTER TABLE purchase_transactions
ADD CONSTRAINT purchase_transactions_purchase_id_fkey
FOREIGN KEY (purchase_id)
REFERENCES user_purchases(id)
ON DELETE CASCADE;

-- Add comment
COMMENT ON CONSTRAINT purchase_transactions_purchase_id_fkey ON purchase_transactions 
IS 'FK with CASCADE delete - when user_purchase is deleted, related transactions are also deleted';
