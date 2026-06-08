'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

// Roles del sistema:
//   admin     → acceso total
//   encargado → mismos que cajero + puede dar entrada, pero sin ver costos/proveedores
//   (otros)   → cajero básico

export function useIsAdmin() {
  const [role, setRole] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    createClient().auth.getUser().then(({ data: { user } }) => {
      setRole(user?.user_metadata?.role ?? null)
      setLoading(false)
    })
  }, [])

  return {
    isAdmin:    role === 'admin',
    canEntrada: role === 'admin' || role === 'encargado',
    showCostos: role === 'admin',   // encargado puede entrar stock pero no ve proveedor ni precio
    loading,
  }
}
