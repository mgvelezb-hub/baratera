'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

// Roles del sistema:
//   developer → acceso total + módulo de configuraciones
//   admin     → acceso total al negocio
//   encargado → inventario (ver + entrada + agregar) sin costos
//   (otros)   → cajero básico (solo POS + ver inventario)

export function useIsAdmin() {
  const [role, setRole] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    createClient().auth.getUser().then(({ data: { user } }) => {
      const base = user?.app_metadata?.role ?? null
      // Soporte para simulación de rol en desarrollo (solo developer)
      const simRole = typeof window !== 'undefined' ? localStorage.getItem('devSimRole') : null
      setRole(simRole ?? base)
      setLoading(false)
    })
  }, [])

  const isDeveloper = role === 'developer'

  return {
    isDeveloper,
    isAdmin:    isDeveloper || role === 'admin',
    canEntrada: isDeveloper || role === 'admin' || role === 'encargado',
    showCostos: isDeveloper || role === 'admin',
    loading,
  }
}
