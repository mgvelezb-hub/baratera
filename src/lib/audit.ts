import { createAdminClient } from '@/lib/supabase/admin'

// Log append-only de acciones del panel developer (tabla `auditoria`).
// Errores silenciosos: si la migración no ha corrido, la acción principal
// no debe fallar por no poder auditarse.

export async function logAudit(
  accion:  string,
  detalle: Record<string, unknown>,
  email?:  string | null,
) {
  try {
    await createAdminClient().from('auditoria').insert({
      accion,
      detalle,
      usuario_email: email ?? null,
    })
  } catch {
    // tabla inexistente o error de red — no bloquear la acción principal
  }
}
