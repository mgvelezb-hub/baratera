-- Migration: tabla ventas + venta_items
-- Correr en Supabase → SQL Editor
-- Fecha: 2026-06-02

-- ventas: una fila por transacción completa en el POS
CREATE TABLE ventas (
  id              UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  total           DECIMAL(12,2) NOT NULL CHECK (total > 0),
  metodo          TEXT          NOT NULL CHECK (metodo IN ('efectivo', 'tarjeta', 'mixto')),
  monto_efectivo  DECIMAL(12,2) NOT NULL DEFAULT 0,
  monto_tarjeta   DECIMAL(12,2) NOT NULL DEFAULT 0,
  cambio          DECIMAL(12,2) NOT NULL DEFAULT 0,
  cajero_id       UUID          REFERENCES auth.users(id),
  created_at      TIMESTAMPTZ   NOT NULL DEFAULT now()
);

-- venta_items: una fila por producto en la transacción
CREATE TABLE venta_items (
  id              UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  venta_id        UUID          NOT NULL REFERENCES ventas(id) ON DELETE CASCADE,
  producto_id     UUID          NOT NULL REFERENCES productos(id),
  cantidad        INT           NOT NULL CHECK (cantidad > 0),
  precio_unitario DECIMAL(12,2) NOT NULL CHECK (precio_unitario > 0),
  subtotal        DECIMAL(12,2) NOT NULL CHECK (subtotal > 0),
  created_at      TIMESTAMPTZ   NOT NULL DEFAULT now()
);

-- RLS
ALTER TABLE ventas      ENABLE ROW LEVEL SECURITY;
ALTER TABLE venta_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "authenticated read ventas"
  ON ventas FOR SELECT TO authenticated USING (true);
CREATE POLICY "authenticated insert ventas"
  ON ventas FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "authenticated read venta_items"
  ON venta_items FOR SELECT TO authenticated USING (true);
CREATE POLICY "authenticated insert venta_items"
  ON venta_items FOR INSERT TO authenticated WITH CHECK (true);

-- Índices para queries comunes del dashboard
CREATE INDEX idx_ventas_created_at    ON ventas(created_at DESC);
CREATE INDEX idx_venta_items_venta_id ON venta_items(venta_id);
CREATE INDEX idx_venta_items_producto ON venta_items(producto_id);
