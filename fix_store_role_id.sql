-- =====================================================
-- FIX: Corregir role_id con espacio y "2" extras
-- =====================================================

-- El role_id actual tiene '144994972205069113 2' cuando debería ser solo '1449949722050691132'
-- Removiendo el espacio y asegurando el ID correcto

UPDATE store_items 
SET role_id = '1449949722050691132'
WHERE item_key = 'swat_vehicle';

-- Verificar el cambio
SELECT item_key, name, role_id 
FROM store_items 
WHERE item_key = 'swat_vehicle';
