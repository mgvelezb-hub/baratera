-- Agrega stock_minimo individual por color en producto_colores.
-- Si es NULL, la UI debe usar el stock_minimo del producto padre.
ALTER TABLE producto_colores
  ADD COLUMN IF NOT EXISTS stock_minimo INT DEFAULT NULL;
