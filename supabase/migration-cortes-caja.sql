-- Migration: tabla cortes_caja
-- Correr en Supabase → SQL Editor
-- Fecha: 2026-06-02

CREATE TABLE cortes_caja (
  id                  UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  cajero_id           UUID          REFERENCES auth.users(id),
  efectivo_esperado   DECIMAL(12,2) NOT NULL,
  efectivo_contado    DECIMAL(12,2) NOT NULL,
  diferencia          DECIMAL(12,2) NOT NULL,
  total_ventas        DECIMAL(12,2) NOT NULL,
  total_efectivo      DECIMAL(12,2) NOT NULL,
  total_tarjeta       DECIMAL(12,2) NOT NULL,
  num_transacciones   INT           NOT NULL DEFAULT 0,
  notas               TEXT,
  created_at          TIMESTAMPTZ   NOT NULL DEFAULT now()
);

ALTER TABLE cortes_caja ENABLE ROW LEVEL SECURITY;

CREATE POLICY "authenticated read cortes_caja"
  ON cortes_caja FOR SELECT TO authenticated USING (true);
CREATE POLICY "authenticated insert cortes_caja"
  ON cortes_caja FOR INSERT TO authenticated WITH CHECK (true);

CREATE INDEX idx_cortes_caja_created_at ON cortes_caja(created_at DESC);
