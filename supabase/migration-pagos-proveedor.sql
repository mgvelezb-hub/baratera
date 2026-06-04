-- ── Pagos parciales a proveedores ──────────────────────────────
CREATE TABLE IF NOT EXISTS pagos_proveedor (
  id                  UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  adeudo_id           UUID          NOT NULL REFERENCES adeudos(id) ON DELETE CASCADE,
  monto               DECIMAL(12,2) NOT NULL CHECK (monto > 0),
  metodo              TEXT          NOT NULL CHECK (metodo IN ('efectivo','tarjeta','transferencia','mixto')),
  monto_efectivo      DECIMAL(12,2) NOT NULL DEFAULT 0,
  monto_tarjeta       DECIMAL(12,2) NOT NULL DEFAULT 0,
  monto_transferencia DECIMAL(12,2) NOT NULL DEFAULT 0,
  notas               TEXT,
  created_by          UUID          REFERENCES auth.users(id),
  created_at          TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

ALTER TABLE pagos_proveedor ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Autenticados gestionan pagos_proveedor"
  ON pagos_proveedor FOR ALL USING (auth.uid() IS NOT NULL);

CREATE INDEX IF NOT EXISTS idx_pagos_proveedor_adeudo ON pagos_proveedor(adeudo_id);

-- ── Columna monto_pagado en adeudos ────────────────────────────
ALTER TABLE adeudos ADD COLUMN IF NOT EXISTS
  monto_pagado DECIMAL(12,2) NOT NULL DEFAULT 0;

-- Sincroniza adeudos ya marcados como pagados
UPDATE adeudos SET monto_pagado = monto WHERE estado = 'pagado' AND monto_pagado = 0;

-- ── Estado incluye 'parcial' ───────────────────────────────────
ALTER TABLE adeudos DROP CONSTRAINT IF EXISTS adeudos_estado_check;
ALTER TABLE adeudos ADD CONSTRAINT adeudos_estado_check
  CHECK (estado IN ('pendiente','parcial','pagado'));
