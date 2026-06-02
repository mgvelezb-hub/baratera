'use client'

import { useState } from 'react'
import { Plus, Building2, CheckCircle2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import type { Proveedor, Adeudo } from '@/lib/types'
import NuevoProveedorModal from './NuevoProveedorModal'
import AdeudoModal from './AdeudoModal'

type Filtro = 'todos' | 'urgentes' | 'vencidos' | 'pagados'

function diasParaVencer(fecha: string): number {
  const hoy  = new Date(); hoy.setHours(0, 0, 0, 0)
  const venc = new Date(fecha + 'T00:00:00')
  return Math.ceil((venc.getTime() - hoy.getTime()) / 86_400_000)
}

type Urgencia = 'vencido' | 'urgente' | 'proximo' | 'ok'

function urgencia(a: Adeudo): Urgencia {
  if (a.estado === 'pagado') return 'ok'
  const d = diasParaVencer(a.fecha_vencimiento)
  if (d < 0)  return 'vencido'
  if (d <= 3) return 'urgente'
  if (d <= 7) return 'proximo'
  return 'ok'
}

const FMT = new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 0 })

interface Props {
  proveedoresIniciales: Proveedor[]
  adeudosIniciales:     Adeudo[]
}

export default function ProveedoresClient({ proveedoresIniciales, adeudosIniciales }: Props) {
  const [proveedores,     setProveedores]     = useState(proveedoresIniciales)
  const [adeudos,         setAdeudos]         = useState(adeudosIniciales)
  const [filtro,          setFiltro]          = useState<Filtro>('todos')
  const [showNewProv,     setShowNewProv]     = useState(false)
  const [showAdeudo,      setShowAdeudo]      = useState(false)
  const [proveedorActivo, setProveedorActivo] = useState<Proveedor | null>(null)

  async function refresh() {
    const supabase = createClient()
    const [{ data: p }, { data: a }] = await Promise.all([
      supabase.from('proveedores').select('*').eq('activo', true).order('nombre'),
      supabase.from('adeudos').select('*, proveedores(nombre)').order('fecha_vencimiento', { ascending: true }),
    ])
    setProveedores(p ?? [])
    setAdeudos(a ?? [])
  }

  async function marcarPagado(a: Adeudo) {
    await createClient().from('adeudos').update({
      estado:     'pagado',
      fecha_pago: new Date().toISOString().split('T')[0],
    }).eq('id', a.id)
    await refresh()
  }

  // ── KPIs ──────────────────────────────────────────────────
  const pendientes = adeudos.filter(a => a.estado === 'pendiente')
  const totalDeuda = pendientes.reduce((s, a) => s + Number(a.monto), 0)
  const vencidos   = pendientes.filter(a => diasParaVencer(a.fecha_vencimiento) < 0)
  const urgentes   = pendientes.filter(a => { const d = diasParaVencer(a.fecha_vencimiento); return d >= 0 && d <= 3 })

  // ── Filtrado ───────────────────────────────────────────────
  const adeudosFiltrados = adeudos.filter(a => {
    if (filtro === 'todos')    return a.estado === 'pendiente'
    if (filtro === 'vencidos') return a.estado === 'pendiente' && diasParaVencer(a.fecha_vencimiento) < 0
    if (filtro === 'urgentes') {
      const d = diasParaVencer(a.fecha_vencimiento)
      return a.estado === 'pendiente' && d >= 0 && d <= 7
    }
    if (filtro === 'pagados')  return a.estado === 'pagado'
    return true
  })

  const FILTROS: { id: Filtro; label: string; count?: number }[] = [
    { id: 'todos',    label: 'Pendientes', count: pendientes.length },
    { id: 'urgentes', label: 'Esta semana', count: urgentes.length  },
    { id: 'vencidos', label: 'Vencidos',    count: vencidos.length  },
    { id: 'pagados',  label: 'Pagados'                              },
  ]

  return (
    <div className="px-4 py-5 max-w-4xl mx-auto space-y-5">

      {/* ── Header ──────────────────────────────────────────── */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Proveedores & Adeudos</h1>
          <p className="text-sm text-slate-500">Cuentas por pagar ordenadas por urgencia</p>
        </div>
        <button
          onClick={() => setShowNewProv(true)}
          className="flex items-center gap-2 h-10 px-4 bg-violet-600 hover:bg-violet-700 text-white text-sm font-semibold rounded-xl transition-colors"
        >
          <Plus className="w-4 h-4" />Nuevo proveedor
        </button>
      </div>

      {/* ── KPI strip ───────────────────────────────────────── */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-white rounded-2xl border border-slate-200 p-4">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400 mb-1">Total adeudado</p>
          <p className="text-2xl font-bold text-slate-900">{FMT.format(totalDeuda)}</p>
          <p className="text-xs text-slate-400 mt-0.5">{pendientes.length} adeudo{pendientes.length !== 1 ? 's' : ''} pendiente{pendientes.length !== 1 ? 's' : ''}</p>
        </div>
        <div className={`rounded-2xl border p-4 ${vencidos.length > 0 ? 'bg-red-50 border-red-200' : 'bg-white border-slate-200'}`}>
          <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400 mb-1">Vencidos</p>
          <p className={`text-2xl font-bold ${vencidos.length > 0 ? 'text-red-600' : 'text-slate-900'}`}>{vencidos.length}</p>
          <p className="text-xs text-slate-400 mt-0.5">requieren atención inmediata</p>
        </div>
        <div className={`rounded-2xl border p-4 ${urgentes.length > 0 ? 'bg-amber-50 border-amber-200' : 'bg-white border-slate-200'}`}>
          <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400 mb-1">Vencen en 3 días</p>
          <p className={`text-2xl font-bold ${urgentes.length > 0 ? 'text-amber-600' : 'text-slate-900'}`}>{urgentes.length}</p>
          <p className="text-xs text-slate-400 mt-0.5">adeudos urgentes</p>
        </div>
      </div>

      {/* ── Filters ─────────────────────────────────────────── */}
      <div className="flex gap-1 bg-slate-100 p-1 rounded-xl">
        {FILTROS.map(f => (
          <button
            key={f.id}
            onClick={() => setFiltro(f.id)}
            className={`flex-1 h-8 rounded-lg text-xs font-semibold transition-colors flex items-center justify-center gap-1.5 ${
              filtro === f.id ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            {f.label}
            {f.count !== undefined && f.count > 0 && (
              <span className={`w-4 h-4 rounded-full text-[10px] flex items-center justify-center font-bold ${
                filtro === f.id
                  ? f.id === 'vencidos' ? 'bg-red-100 text-red-600' : f.id === 'urgentes' ? 'bg-amber-100 text-amber-600' : 'bg-violet-100 text-violet-600'
                  : 'bg-slate-200 text-slate-500'
              }`}>
                {f.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* ── Adeudos list ────────────────────────────────────── */}
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
        {adeudosFiltrados.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-14 text-center">
            <CheckCircle2 className="w-10 h-10 text-slate-200 mb-2" />
            <p className="text-sm font-medium text-slate-500">
              {filtro === 'pagados' ? 'Sin adeudos pagados' : '¡Sin adeudos en esta categoría!'}
            </p>
          </div>
        ) : (
          <ul className="divide-y divide-slate-100">
            {adeudosFiltrados.map(a => {
              const urg   = urgencia(a)
              const dias  = a.estado === 'pendiente' ? diasParaVencer(a.fecha_vencimiento) : null
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              const prov  = (a as any).proveedores?.nombre ?? '—'

              const avatarStyle = {
                vencido: 'text-red-600 bg-red-50 border-red-200',
                urgente: 'text-amber-600 bg-amber-50 border-amber-200',
                proximo: 'text-orange-500 bg-orange-50 border-orange-200',
                ok:      a.estado === 'pagado'
                  ? 'text-green-600 bg-green-50 border-green-200'
                  : 'text-slate-600 bg-slate-50 border-slate-200',
              }[urg]

              const montoStyle = {
                vencido: 'text-red-600',
                urgente: 'text-amber-600',
                proximo: 'text-orange-500',
                ok:      a.estado === 'pagado' ? 'text-slate-400' : 'text-slate-900',
              }[urg]

              let fechaTexto = ''
              if (a.estado === 'pagado') {
                fechaTexto = `✓ Pagado ${a.fecha_pago
                  ? new Date(a.fecha_pago + 'T00:00:00').toLocaleDateString('es-MX', { day: 'numeric', month: 'short' })
                  : ''}`
              } else if (dias !== null) {
                if (dias < 0)   fechaTexto = `Venció hace ${Math.abs(dias)} día${Math.abs(dias) !== 1 ? 's' : ''}`
                else if (dias === 0) fechaTexto = '⚠ Vence hoy'
                else fechaTexto = `Vence ${new Date(a.fecha_vencimiento + 'T00:00:00').toLocaleDateString('es-MX', { day: 'numeric', month: 'short' })} (en ${dias} días)`
              }

              return (
                <li key={a.id} className="flex items-center gap-4 px-5 py-4 hover:bg-slate-50 transition-colors">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-sm font-bold shrink-0 border ${avatarStyle}`}>
                    {prov.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-slate-900">{prov}</p>
                    <p className="text-xs text-slate-500 mt-0.5 truncate">{a.descripcion}</p>
                    <p className="text-xs text-slate-400 mt-0.5">{fechaTexto}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className={`text-base font-bold ${montoStyle}`}>
                      {FMT.format(Number(a.monto))}
                    </p>
                    {a.estado === 'pendiente' && (
                      <button
                        onClick={() => marcarPagado(a)}
                        className="mt-1 text-[11px] text-violet-600 hover:text-violet-800 font-semibold"
                      >
                        Marcar pagado
                      </button>
                    )}
                  </div>
                </li>
              )
            })}
          </ul>
        )}

        {/* Totales footer */}
        {filtro !== 'pagados' && pendientes.length > 0 && (
          <div className="px-5 py-3 border-t border-slate-100 flex items-center justify-between bg-slate-50">
            <span className="text-xs text-slate-500">Total pendiente</span>
            <span className="text-base font-bold text-slate-900">{FMT.format(totalDeuda)}</span>
          </div>
        )}
      </div>

      {/* ── Proveedores registrados ──────────────────────────── */}
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <p className="text-sm font-semibold text-slate-700">Proveedores registrados</p>
          <span className="text-xs text-slate-400">{proveedores.length} activo{proveedores.length !== 1 ? 's' : ''}</span>
        </div>

        {proveedores.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <Building2 className="w-10 h-10 text-slate-200 mb-2" />
            <p className="text-sm font-medium text-slate-500">Sin proveedores registrados</p>
            <p className="text-xs text-slate-400 mt-1">Agrega tu primer proveedor arriba</p>
          </div>
        ) : (
          <ul className="divide-y divide-slate-100">
            {proveedores.map(p => {
              const deudaProv = pendientes.filter(a => a.proveedor_id === p.id)
              const totalProv = deudaProv.reduce((s, a) => s + Number(a.monto), 0)
              const tieneVencido = deudaProv.some(a => diasParaVencer(a.fecha_vencimiento) < 0)

              return (
                <li key={p.id} className="flex items-center gap-4 px-5 py-3 hover:bg-slate-50 transition-colors">
                  <div className="w-9 h-9 rounded-xl bg-violet-50 border border-violet-200 flex items-center justify-center text-sm font-bold text-violet-600 shrink-0">
                    {p.nombre.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-slate-900">{p.nombre}</p>
                    {p.contacto_tel && (
                      <p className="text-xs text-slate-400 mt-0.5">{p.contacto_tel}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {totalProv > 0 && (
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-lg border ${
                        tieneVencido
                          ? 'text-red-600 bg-red-50 border-red-200'
                          : 'text-amber-600 bg-amber-50 border-amber-200'
                      }`}>
                        {FMT.format(totalProv)}
                      </span>
                    )}
                    <button
                      onClick={() => { setProveedorActivo(p); setShowAdeudo(true) }}
                      className="text-xs text-violet-600 hover:text-violet-800 font-semibold border border-violet-200 hover:border-violet-400 rounded-lg px-2.5 py-1 transition-colors"
                    >
                      + Adeudo
                    </button>
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </div>

      {/* ── Modals ──────────────────────────────────────────── */}
      {showNewProv && (
        <NuevoProveedorModal
          onClose={() => setShowNewProv(false)}
          onSuccess={() => { setShowNewProv(false); refresh() }}
        />
      )}
      {showAdeudo && proveedorActivo && (
        <AdeudoModal
          proveedor={proveedorActivo}
          adeudo={null}
          onClose={() => { setShowAdeudo(false); setProveedorActivo(null) }}
          onSuccess={() => { setShowAdeudo(false); setProveedorActivo(null); refresh() }}
        />
      )}
    </div>
  )
}
