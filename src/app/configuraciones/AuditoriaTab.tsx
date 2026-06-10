'use client'

import { useState, useEffect, useCallback } from 'react'
import { RefreshCw, Loader2, AlertTriangle, ScrollText, ChevronDown, ChevronUp } from 'lucide-react'

interface Evento {
  id:            string
  accion:        string
  detalle:       Record<string, unknown>
  usuario_email: string | null
  creado_en:     string
}

const ACCION_META: Record<string, { label: string; color: string }> = {
  'rol.cambiado':      { label: 'Rol cambiado',     color: 'bg-blue-100 text-blue-700'     },
  'perfil.creado':     { label: 'Perfil creado',    color: 'bg-green-100 text-green-700'   },
  'perfil.editado':    { label: 'Perfil editado',   color: 'bg-amber-100 text-amber-700'   },
  'perfil.eliminado':  { label: 'Perfil eliminado', color: 'bg-red-100 text-red-700'       },
  'datos.reset':       { label: 'Reset de datos',   color: 'bg-red-100 text-red-700'       },
  'datos.exportados':  { label: 'Exportación',      color: 'bg-violet-100 text-violet-700' },
  'datos.seed':        { label: 'Datos demo',       color: 'bg-emerald-100 text-emerald-700' },
  'config.editada':    { label: 'Config editada',   color: 'bg-slate-100 text-slate-600'   },
}

export default function AuditoriaTab() {
  const [eventos,          setEventos]          = useState<Evento[]>([])
  const [loading,          setLoading]          = useState(true)
  const [migrationPending, setMigrationPending] = useState(false)
  const [expanded,         setExpanded]         = useState<string | null>(null)

  const fetchEventos = useCallback(async () => {
    setLoading(true)
    const res = await fetch('/api/dev/audit')
    if (res.ok) {
      const data = await res.json()
      setEventos(data.eventos ?? [])
      setMigrationPending(data.migrationPending === true)
    }
    setLoading(false)
  }, [])

  useEffect(() => { fetchEventos() }, [fetchEventos])

  return (
    <div>
      {migrationPending && (
        <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-xl p-4 mb-5">
          <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
          <p className="text-sm text-amber-700">
            Corre <code className="bg-amber-100 px-1 rounded font-mono text-xs">migration-configuracion.sql</code> en
            Supabase para activar el registro de auditoría.
          </p>
        </div>
      )}

      <div className="flex items-center justify-between mb-4">
        <p className="text-sm text-slate-500 flex items-center gap-1.5">
          <ScrollText className="w-4 h-4 text-violet-500" />
          Últimos {eventos.length} eventos del panel
        </p>
        <button
          onClick={fetchEventos}
          className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700 h-8 px-3 rounded-lg hover:bg-slate-100 transition-colors"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          Actualizar
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="w-5 h-5 animate-spin text-violet-500" />
        </div>
      ) : eventos.length === 0 ? (
        <p className="text-sm text-slate-400 text-center py-10">
          Sin eventos registrados todavía. Las acciones del panel (cambios de rol,
          resets, ediciones de config) aparecerán aquí.
        </p>
      ) : (
        <div className="space-y-1.5">
          {eventos.map(ev => {
            const meta = ACCION_META[ev.accion] ?? { label: ev.accion, color: 'bg-slate-100 text-slate-600' }
            const fecha = new Date(ev.creado_en).toLocaleString('es-MX', {
              dateStyle: 'short', timeStyle: 'short', timeZone: 'America/Mexico_City',
            })
            const isOpen = expanded === ev.id
            return (
              <div key={ev.id} className="bg-white border border-slate-200 rounded-xl">
                <button
                  onClick={() => setExpanded(isOpen ? null : ev.id)}
                  className="w-full flex items-center gap-3 px-3 py-2.5 text-left"
                >
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium shrink-0 ${meta.color}`}>
                    {meta.label}
                  </span>
                  <span className="flex-1 text-xs text-slate-500 truncate">
                    {ev.usuario_email ?? '—'}
                  </span>
                  <span className="text-xs text-slate-400 shrink-0">{fecha}</span>
                  {isOpen
                    ? <ChevronUp className="w-3.5 h-3.5 text-slate-300 shrink-0" />
                    : <ChevronDown className="w-3.5 h-3.5 text-slate-300 shrink-0" />}
                </button>
                {isOpen && (
                  <pre className="mx-3 mb-3 p-3 bg-slate-50 rounded-lg text-xs text-slate-600 overflow-x-auto">
                    {JSON.stringify(ev.detalle, null, 2)}
                  </pre>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
