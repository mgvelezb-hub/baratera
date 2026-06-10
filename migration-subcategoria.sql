-- Agrega la columna subcategoria al catálogo de productos.
-- Representa el contenido/variante del producto (ej: "100 hojas", "25 piezas").
-- Corre en Supabase: Dashboard → SQL Editor → Run.

ALTER TABLE productos ADD COLUMN IF NOT EXISTS subcategoria TEXT;
