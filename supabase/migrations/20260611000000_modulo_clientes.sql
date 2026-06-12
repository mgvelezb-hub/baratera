-- ============================================================
-- BARATERA OS — Módulo Clientes v1
-- Ejecutar en: Supabase Dashboard → SQL Editor
-- ============================================================

-- ── 1. Tabla clientes ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS clientes (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  numero_cliente  TEXT UNIQUE NOT NULL,
  nombre          TEXT NOT NULL,
  telefono        TEXT UNIQUE NOT NULL,
  correo          TEXT,
  recibe_promo    BOOLEAN NOT NULL DEFAULT false,
  tipo            TEXT NOT NULL DEFAULT 'frecuente'
                  CHECK (tipo IN ('frecuente', 'mayorista')),
  notas           TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Secuencia para auto-generar numero_cliente (CLI-0001, CLI-0002, ...)
CREATE SEQUENCE IF NOT EXISTS clientes_seq START 1;

-- RLS: cualquier usuario autenticado puede leer; escritura sólo vía admin (service key)
ALTER TABLE clientes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "clientes_select_all" ON clientes;
CREATE POLICY "clientes_select_all" ON clientes
  FOR SELECT USING (true);

-- ── 2. Tabla ticket_secuencia (contador diario de tickets) ─────
CREATE TABLE IF NOT EXISTS ticket_secuencia (
  fecha           DATE PRIMARY KEY,
  ultimo_numero   INTEGER NOT NULL DEFAULT 0
);

-- Sin policies públicas: sólo accesible con service role key
ALTER TABLE ticket_secuencia ENABLE ROW LEVEL SECURITY;

-- ── 3. Función PG: siguiente número de ticket (atómica) ────────
CREATE OR REPLACE FUNCTION next_ticket_num(p_fecha DATE)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_num INTEGER;
BEGINracion
  INSERT INTO ticket_secuencia (fecha, ultimo_numero)
  VALUES (p_fecha, 1)
  ON CONFLICT (fecha) DO UPDATE
    SET ultimo_numero = ticket_secuencia.ultimo_numero + 1
  RETURNING ultimo_numero INTO v_num;

  RETURN TO_CHAR(p_fecha, 'YYYYMMDD') || '-' || LPAD(v_num::TEXT, 3, '0');
END;
$$;

-- ── 4. Nuevas columnas en ventas ───────────────────────────────
ALTER TABLE ventas
  ADD COLUMN IF NOT EXISTS cliente_id    UUID REFERENCES clientes(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS cupon_pct     INTEGER CHECK (cupon_pct IN (5, 10, 15, 20)),
  ADD COLUMN IF NOT EXISTS descuento     DECIMAL(12,2),
  ADD COLUMN IF NOT EXISTS numero_ticket TEXT;

-- Índices
CREATE INDEX IF NOT EXISTS idx_ventas_numero_ticket ON ventas(numero_ticket);
CREATE INDEX IF NOT EXISTS idx_ventas_cliente_id    ON ventas(cliente_id);

-- ── Verificación ───────────────────────────────────────────────
-- SELECT next_ticket_num(CURRENT_DATE);  -- debe retornar YYYYMMDD-001
