-- Migration: colores por producto + proveedor en entradas de stock
-- Correr en Supabase → SQL Editor
-- Fecha: 2026-06-02

-- 1. Tabla de variantes de color por producto (opcional por producto)
CREATE TABLE producto_colores (
  id          UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  producto_id UUID          NOT NULL REFERENCES productos(id) ON DELETE CASCADE,
  nombre      TEXT          NOT NULL,
  hex         TEXT          NOT NULL DEFAULT '#94a3b8',
  stock       INT           NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ   NOT NULL DEFAULT now(),
  UNIQUE(producto_id, nombre)
);

ALTER TABLE producto_colores ENABLE ROW LEVEL SECURITY;

CREATE POLICY "auth read producto_colores"
  ON producto_colores FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth insert producto_colores"
  ON producto_colores FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "auth update producto_colores"
  ON producto_colores FOR UPDATE TO authenticated USING (true);
CREATE POLICY "auth delete producto_colores"
  ON producto_colores FOR DELETE TO authenticated USING (true);

CREATE INDEX idx_producto_colores_producto ON producto_colores(producto_id);

-- 2. Columnas opcionales en stock_ledger
ALTER TABLE stock_ledger
  ADD COLUMN IF NOT EXISTS color_variante TEXT,
  ADD COLUMN IF NOT EXISTS proveedor_id   UUID REFERENCES proveedores(id),
  ADD COLUMN IF NOT EXISTS precio_unitario DECIMAL(12,2);
