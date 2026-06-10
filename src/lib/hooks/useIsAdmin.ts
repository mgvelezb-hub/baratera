'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import {
  type Permisos,
  todosLosPermisos,
  permisosDesdeLista,
  ROLES_FALLBACK,
  PERMISOS_SIN_ROL,
} from '@/lib/permisos'

// Roles del sistema (dinámicos — tabla `roles` en Supabase):
//   developer → siempre todos los permisos + módulo configuraciones
//   resto     → permisos según su fila en la tabla `roles`
// Fallback: si la tabla no existe o el rol no tiene fila, se usa
// ROLES_FALLBACK (comportamiento previo a la migración).

interface RoleState {
  role:     string | null
  permisos: Permisos
}

// Caché a nivel módulo: evita repetir el fetch del rol en cada componente
// que monta el hook dentro de la misma página (Sidebar + Client + Cards).
let cache: { state: RoleState; ts: number } | null = null
let pending: Promise<RoleState> | null = null
const CACHE_TTL = 60_000

async function resolveRoleState(): Promise<RoleState> {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const baseRole = (user?.app_metadata as Record<string, string> | null)?.role ?? null
  // Simulación de rol (solo la activa el developer desde /configuraciones)
  const simRole = typeof window !== 'undefined' ? localStorage.getItem('devSimRole') : null
  const role = simRole || baseRole

  if (role === 'developer') {
    return { role, permisos: todosLosPermisos() }
  }

  // Intentar leer permisos dinámicos de la tabla `roles`
  if (role) {
    const { data, error } = await supabase
      .from('roles')
      .select('permisos')
      .eq('nombre', role)
      .maybeSingle()

    if (!error && data?.permisos && typeof data.permisos === 'object') {
      return { role, permisos: data.permisos as Permisos }
    }
    // Tabla inexistente, error de red o rol sin fila → fallback hardcodeado
    return { role, permisos: permisosDesdeLista(ROLES_FALLBACK[role] ?? PERMISOS_SIN_ROL) }
  }

  // Sin rol asignado → permisos de cajero
  return { role: null, permisos: permisosDesdeLista(PERMISOS_SIN_ROL) }
}

function getRoleState(): Promise<RoleState> {
  if (cache && Date.now() - cache.ts < CACHE_TTL) return Promise.resolve(cache.state)
  if (!pending) {
    pending = resolveRoleState()
      .then(state => {
        cache = { state, ts: Date.now() }
        return state
      })
      .finally(() => { pending = null })
  }
  return pending
}

// Invalidar caché (p.ej. tras cambiar la simulación de rol o editar permisos)
export function invalidateRoleCache() {
  cache = null
}

export function useIsAdmin() {
  const [state, setState]     = useState<RoleState>({ role: null, permisos: {} })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let mounted = true
    getRoleState().then(s => {
      if (mounted) {
        setState(s)
        setLoading(false)
      }
    })
    return () => { mounted = false }
  }, [])

  const can = useCallback(
    (key: string) => state.permisos[key] === true,
    [state.permisos],
  )

  const isDeveloper = state.role === 'developer'

  return {
    role: state.role,
    isDeveloper,
    can,
    // Flags legacy — calculados desde permisos para no romper consumidores
    isAdmin:    isDeveloper || state.role === 'admin',
    canEntrada: can('inventario.entrada'),
    showCostos: can('inventario.costos'),
    loading,
  }
}
