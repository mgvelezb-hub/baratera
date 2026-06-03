-- Migration: agregar transferencia como método de pago
-- Correr en Supabase → SQL Editor
-- Fecha: 2026-06-02

-- 1. ventas: nueva columna + ampliar CHECK
ALTER TABLE ventas
  ADD COLUMN monto_transferencia DECIMAL(12,2) NOT NULL DEFAULT 0;

ALTER TABLE ventas
  DROP CONSTRAINT ventas_metodo_check;

ALTER TABLE ventas
  ADD CONSTRAINT ventas_metodo_check
    CHECK (metodo IN ('efectivo', 'tarjeta', 'transferencia', 'mixto'));

-- 2. cortes_caja: nueva columna para cuadre digital
ALTER TABLE cortes_caja
  ADD COLUMN total_transferencia DECIMAL(12,2) NOT NULL DEFAULT 0;
