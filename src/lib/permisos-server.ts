import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import {
  todosLosPermisos,
  permisosDesdeLista,
  ROLES_FALLBACK,
  PERMISOS_SIN_ROL,
  type Permisos,
} from '@/lib/permisos'

// Versión server-side del check de permisos — para proteger páginas
// completas (dashboard, corte, costos, proveedores) y no solo ocultar
// los links del sidebar. Mismo fallback que useIsAdmin.

export async function getPermisosServer(): Promise<{ role: string | null; permisos: Permisos }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return { role: null, permisos: {} }

  const role = (user.app_metadata as Record<string, string> | null)?.role ?? null

  if (role === 'developer') {
    return { role, permisos: todosLosPermisos() }
  }

  if (role) {
    const { data, error } = await supabase
      .from('roles')
      .select('permisos')
      .eq('nombre', role)
      .maybeSingle()

    if (!error && data?.permisos && typeof data.permisos === 'object') {
      return { role, permisos: data.permisos as Permisos }
    }
    return { role, permisos: permisosDesdeLista(ROLES_FALLBACK[role] ?? PERMISOS_SIN_ROL) }
  }

  return { role: null, permisos: permisosDesdeLista(PERMISOS_SIN_ROL) }
}

// Redirige a /inventario si el usuario no tiene el permiso.
// Usar al inicio de cada page server component protegido.
export async function requirePermiso(key: string) {
  const { permisos } = await getPermisosServer()
  if (permisos[key] !== true) redirect('/inventario')
}
