-- ── Clientes v2 ─────────────────────────────────────────────────
-- Agrega tipo 'normal' al check constraint, cambia el default,
-- y crea la tabla notificaciones para alertas de admin.

-- 1. Ampliar el CHECK para permitir 'normal'
ALTER TABLE clientes DROP CONSTRAINT IF EXISTS clientes_tipo_check;
ALTER TABLE clientes ADD CONSTRAINT clientes_tipo_check
  CHECK (tipo IN ('normal', 'mayorista', 'frecuente'));

-- 2. Cambiar el default de 'frecuente' a 'normal' para nuevos clientes
ALTER TABLE clientes ALTER COLUMN tipo SET DEFAULT 'normal';

-- 3. Tabla de notificaciones para alertas de admin (cupones, upgrades, etc.)
CREATE TABLE IF NOT EXISTS notificaciones (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo        TEXT NOT NULL,
  mensaje     TEXT NOT NULL,
  datos       JSONB DEFAULT '{}'::jsonb,
  leida       BOOLEAN DEFAULT false,
  created_at  TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE notificaciones ENABLE ROW LEVEL SECURITY;

-- Cualquier usuario autenticado puede insertar (cajero registra cupones)
CREATE POLICY "auth_inserta_notificaciones" ON notificaciones
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- Cualquier usuario autenticado puede leer (el dashboard filtra por rol en código)
CREATE POLICY "auth_lee_notificaciones" ON notificaciones
  FOR SELECT USING (auth.role() = 'authenticated');

-- Solo admin/duena/developer puede marcar como leída
CREATE POLICY "admin_actualiza_notificaciones" ON notificaciones
  FOR UPDATE USING (
    (auth.jwt() -> 'app_metadata' ->> 'role') IN ('developer', 'admin', 'duena')
  );
