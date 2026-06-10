'use client'

import { AlertTriangle } from 'lucide-react'
import { useConfig } from '@/lib/hooks/useConfig'

// Banner global: visible en todas las páginas cuando
// configuracion.mantenimiento.activo = true (se apaga desde /configuraciones).
export default function MaintenanceBanner() {
  const { config, loading } = useConfig()

  if (loading || !config.mantenimiento.activo) return null

  return (
    <div className="sticky top-0 z-50 flex items-center justify-center gap-2 bg-amber-500 text-white text-sm font-medium px-4 py-2 text-center">
      <AlertTriangle className="w-4 h-4 shrink-0" />
      {config.mantenimiento.mensaje}
    </div>
  )
}
