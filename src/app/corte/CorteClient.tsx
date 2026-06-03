'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  DollarSign, CreditCard, ShoppingBag, AlertTriangle,
  CheckCircle2, Loader2, Clock, ChevronDown, ChevronUp, ArrowLeftRight,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import type { Venta, CorteCaja } from '@/lib/types'

const FMT = new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 0 })

function formatHora(iso: string) {
  return new Date(iso).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })
}

function formatFecha(iso: string) {
  return new Date(iso).toLocaleString('es-MX', {
    hour: '2-digit', minute: '2-digit', day: 'numeric', month: 'short',
  })
}

const METODO_BADGE: Record<string, string> = {
  efectivo:      'bg-green-50 text-green-700 border-green-200',
  tarjeta:       'bg-blue-50 text-blue-700 border-blue-200',
  transferencia: 'bg-violet-50 text-violet-700 border-violet-200',
  mixto:         'bg-amber-50 text-amber-700 border-amber-200',
}

const METODO_LABEL: Record<string, string> = {
  efectivo:      'Efectivo',
  tarjeta:       'Tarjeta',
  transferencia: 'Transferencia',
  mixto:         'Mixto',
}

interface Props {
  ventasTurno: Venta[]
  cortesHoy:   CorteCaja[]
  turnoInicio: string
}

export default function CorteClient({ ventasTurno, cortesHoy, turnoInicio }: Props) {
  const router = useRouter()

  const [efectivoContado, setEfectivoContado] = useState('')
  const [notas,           setNotas]           = useState('')
  const [loading,         setLoading]         = useState(false)
  const [error,           setError]           = useState('')
  const [showVentas,      setShowVentas]      = useState(false)

  // ── Cálculos del turno ────────────────────────────────────────
  const totalVentas        = ventasTurno.reduce((s, v) => s + Number(v.total), 0)
  const totalEfectivo      = ventasTurno.reduce((s, v) => s + Number(v.monto_efectivo), 0)
  const totalTarjeta       = ventasTurno.reduce((s, v) => s + Number(v.monto_tarjeta), 0)
  const totalTransferencia = ventasTurno.reduce((s, v) => s + Number(v.monto_transferencia ?? 0), 0)
  const totalCambio        = ventasTurno.reduce((s, v) => s + Number(v.cambio), 0)

  // Efectivo neto esperado en el cajón = efectivo recibido − cambio entregado
  const efectivoEsperado = totalEfectivo - totalCambio
  const totalDigital     = totalTarjeta + totalTransferencia

  const contado    = parseFloat(efectivoContado.replace(/,/g, '')) || 0
  const diferencia = contado - efectivoEsperado

  const estadoDiferencia =
    efectivoContado === ''         ? 'pendiente'
    : Math.abs(diferencia) === 0   ? 'exacto'
    : Math.abs(diferencia) <= 50   ? 'leve'
    : diferencia > 0               ? 'sobrante'
    : 'faltante'

  const diferenciaColor = {
    pendiente: 'text-slate-400',
    exacto:    'text-green-600',
    leve:      'text-amber-600',
    sobrante:  'text-blue-600',
    faltante:  'text-red-600',
  }[estadoDiferencia]

  const diferenciaLabel = {
    pendiente: '—',
    exacto:    'Cuadra exacto ✓',
    leve:      diferencia > 0 ? `+${FMT.format(diferencia)} sobrante` : `${FMT.format(diferencia)} faltante`,
    sobrante:  `+${FMT.format(diferencia)} sobrante`,
    faltante:  `${FMT.format(diferencia)} faltante`,
  }[estadoDiferencia]

  // ── Cerrar turno ──────────────────────────────────────────────
  async function handleCerrar() {
    if (efectivoContado.trim() === '') {
      setError('Ingresa el efectivo contado antes de cerrar.')
      return
    }
    setLoading(true)
    setError('')

    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()

    const { error: err } = await supabase.from('cortes_caja').insert({
      cajero_id:           user?.id ?? null,
      efectivo_esperado:   efectivoEsperado,
      efectivo_contado:    contado,
      diferencia,
      total_ventas:        totalVentas,
      total_efectivo:      totalEfectivo,
      total_tarjeta:       totalTarjeta,
      total_transferencia: totalTransferencia,
      num_transacciones:   ventasTurno.length,
      notas:               notas.trim() || null,
    })

    if (err) {
      setError('Error al guardar el corte. Intenta de nuevo.')
      setLoading(false)
      return
    }

    router.refresh()
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 space-y-5">

      {/* ── Header ─────────────────────────────────────────────── */}
      <div>
        <h1 className="text-xl font-bold text-slate-900">Corte de caja</h1>
        <p className="text-sm text-slate-500 mt-0.5">Turno desde {formatFecha(turnoInicio)}</p>
      </div>

      {/* ── KPIs del turno ─────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <KPI icon={ShoppingBag}    label="Total vendido"   value={FMT.format(totalVentas)}        accent="violet" />
        <KPI icon={DollarSign}     label="Efectivo"        value={FMT.format(totalEfectivo)}       accent="green"  />
        <KPI icon={CreditCard}     label="Tarjeta"         value={FMT.format(totalTarjeta)}        accent="blue"   />
        <KPI icon={ArrowLeftRight} label="Transferencia"   value={FMT.format(totalTransferencia)}  accent="purple" />
      </div>

      {/* ── Lista de ventas colapsable ──────────────────────────── */}
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
        <button
          className="w-full flex items-center justify-between px-5 py-4 text-left hover:bg-slate-50 transition-colors"
          onClick={() => setShowVentas(v => !v)}
        >
          <span className="text-sm font-semibold text-slate-700">
            Ventas del turno ({ventasTurno.length})
          </span>
          {showVentas
            ? <ChevronUp className="w-4 h-4 text-slate-400" />
            : <ChevronDown className="w-4 h-4 text-slate-400" />}
        </button>

        {showVentas && (
          ventasTurno.length === 0 ? (
            <p className="px-5 pb-5 text-sm text-slate-400">Sin ventas en este turno.</p>
          ) : (
            <ul className="divide-y divide-slate-100 border-t border-slate-100">
              {ventasTurno.map(v => (
                <li key={v.id} className="flex items-center justify-between px-5 py-2.5 text-sm">
                  <div className="flex items-center gap-2.5">
                    <Clock className="w-3.5 h-3.5 text-slate-300 shrink-0" />
                    <span className="text-slate-500 tabular-nums">{formatHora(v.created_at)}</span>
                    <span className={`text-[11px] font-medium px-1.5 py-0.5 rounded border ${METODO_BADGE[v.metodo] ?? ''}`}>
                      {METODO_LABEL[v.metodo] ?? v.metodo}
                    </span>
                  </div>
                  <span className="font-semibold text-slate-800 tabular-nums">{FMT.format(Number(v.total))}</span>
                </li>
              ))}
            </ul>
          )
        )}
      </div>

      {/* ── Cuadre de efectivo ─────────────────────────────────── */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 space-y-4">
        <p className="text-sm font-semibold text-slate-700">Cuadre de efectivo</p>

        <div className="space-y-1.5 text-sm">
          <Row label="Efectivo recibido"          value={FMT.format(totalEfectivo)} />
          <Row label="Cambio entregado"           value={`− ${FMT.format(totalCambio)}`} muted />
          <div className="border-t border-slate-100 pt-1.5">
            <Row label="Efectivo esperado en caja" value={FMT.format(efectivoEsperado)} bold />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1.5">
            ¿Cuánto efectivo hay en el cajón?
          </label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-slate-400 font-medium">$</span>
            <input
              type="number" min="0" step="0.01" inputMode="decimal"
              value={efectivoContado}
              onChange={e => { setEfectivoContado(e.target.value); setError('') }}
              placeholder="0.00"
              className="w-full h-12 pl-7 pr-4 rounded-xl border border-slate-300 text-base font-semibold focus:outline-none focus:ring-2 focus:ring-violet-500"
            />
          </div>
        </div>

        <div className="flex items-center justify-between px-4 py-3 rounded-xl bg-slate-50 border border-slate-200">
          <span className="text-sm text-slate-600">Diferencia</span>
          <span className={`text-base font-bold ${diferenciaColor}`}>{diferenciaLabel}</span>
        </div>
      </div>

      {/* ── Cuadre de medios digitales ─────────────────────────── */}
      {totalDigital > 0 && (
        <div className="bg-white rounded-2xl border border-slate-200 p-5 space-y-3">
          <div>
            <p className="text-sm font-semibold text-slate-700">Medios digitales</p>
            <p className="text-xs text-slate-400 mt-0.5">Verificar contra terminal bancaria y cuenta</p>
          </div>

          <div className="space-y-2 text-sm">
            {totalTarjeta > 0 && (
              <div className="flex items-center justify-between px-4 py-2.5 rounded-xl bg-blue-50 border border-blue-200">
                <div className="flex items-center gap-2">
                  <CreditCard className="w-4 h-4 text-blue-500" />
                  <span className="text-blue-700 font-medium">Tarjeta</span>
                </div>
                <span className="font-bold text-blue-700 tabular-nums">{FMT.format(totalTarjeta)}</span>
              </div>
            )}
            {totalTransferencia > 0 && (
              <div className="flex items-center justify-between px-4 py-2.5 rounded-xl bg-violet-50 border border-violet-200">
                <div className="flex items-center gap-2">
                  <ArrowLeftRight className="w-4 h-4 text-violet-500" />
                  <span className="text-violet-700 font-medium">Transferencia</span>
                </div>
                <span className="font-bold text-violet-700 tabular-nums">{FMT.format(totalTransferencia)}</span>
              </div>
            )}
            {totalTarjeta > 0 && totalTransferencia > 0 && (
              <div className="flex items-center justify-between pt-1 border-t border-slate-100 text-slate-600">
                <span className="text-xs font-medium">Total digital</span>
                <span className="text-sm font-bold tabular-nums">{FMT.format(totalDigital)}</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Notas + Cerrar turno ───────────────────────────────── */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 space-y-4">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1.5">
            Notas <span className="font-normal text-slate-400">(opcional)</span>
          </label>
          <textarea
            value={notas} onChange={e => setNotas(e.target.value)}
            placeholder="Observaciones sobre el corte..."
            rows={2}
            className="w-full px-3 py-2.5 rounded-xl border border-slate-300 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-violet-500"
          />
        </div>

        {error && (
          <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            {error}
          </p>
        )}

        <button
          onClick={handleCerrar}
          disabled={loading || ventasTurno.length === 0}
          className="w-full h-12 bg-violet-600 hover:bg-violet-700 disabled:bg-violet-200 disabled:cursor-not-allowed text-white font-semibold rounded-xl transition-colors flex items-center justify-center gap-2"
        >
          {loading
            ? <><Loader2 className="w-4 h-4 animate-spin" /> Guardando...</>
            : <><CheckCircle2 className="w-4 h-4" /> Cerrar turno</>}
        </button>

        {ventasTurno.length === 0 && (
          <p className="text-xs text-center text-slate-400">
            Sin ventas en el turno actual — no hay nada que cortar.
          </p>
        )}
      </div>

      {/* ── Historial de cortes del día ────────────────────────── */}
      {cortesHoy.length > 0 && (
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100">
            <p className="text-sm font-semibold text-slate-700">Cortes de hoy</p>
          </div>
          <ul className="divide-y divide-slate-100">
            {cortesHoy.map(c => {
              const dif      = Number(c.diferencia)
              const difColor = dif === 0 ? 'text-green-600'
                : Math.abs(dif) <= 50   ? 'text-amber-600'
                : dif > 0               ? 'text-blue-600'
                : 'text-red-600'

              return (
                <li key={c.id} className="px-5 py-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Clock className="w-3.5 h-3.5 text-slate-300" />
                      <span className="text-sm font-medium text-slate-700">{formatHora(c.created_at)}</span>
                      <span className="text-xs text-slate-400">· {c.num_transacciones} venta{c.num_transacciones !== 1 ? 's' : ''}</span>
                    </div>
                    <span className="text-sm font-bold text-slate-800">{FMT.format(Number(c.total_ventas))}</span>
                  </div>
                  <div className="flex items-center justify-between mt-1 text-xs text-slate-400">
                    <span>
                      Ef. {FMT.format(Number(c.total_efectivo))}
                      {Number(c.total_tarjeta) > 0       && ` · Tarjeta ${FMT.format(Number(c.total_tarjeta))}`}
                      {Number(c.total_transferencia) > 0 && ` · Transf. ${FMT.format(Number(c.total_transferencia))}`}
                    </span>
                    <span className={`font-semibold ${difColor}`}>
                      {dif === 0 ? 'Cuadra' : dif > 0 ? `+${FMT.format(dif)}` : FMT.format(dif)}
                    </span>
                  </div>
                  {c.notas && <p className="mt-1 text-xs text-slate-400 italic">{c.notas}</p>}
                </li>
              )
            })}
          </ul>
        </div>
      )}
    </div>
  )
}

// ── Sub-componentes ───────────────────────────────────────────

function KPI({ icon: Icon, label, value, accent }: {
  icon:   React.ElementType
  label:  string
  value:  string
  accent: 'violet' | 'green' | 'blue' | 'purple' | 'slate'
}) {
  const colors = {
    violet: 'bg-violet-50 text-violet-600',
    green:  'bg-green-50 text-green-600',
    blue:   'bg-blue-50 text-blue-600',
    purple: 'bg-purple-50 text-purple-600',
    slate:  'bg-slate-100 text-slate-500',
  }
  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-4">
      <div className={`w-8 h-8 rounded-xl flex items-center justify-center mb-2 ${colors[accent]}`}>
        <Icon className="w-4 h-4" />
      </div>
      <p className="text-xs text-slate-500 mb-0.5">{label}</p>
      <p className="text-base font-bold text-slate-900 tabular-nums">{value}</p>
    </div>
  )
}

function Row({ label, value, muted = false, bold = false }: {
  label:  string
  value:  string
  muted?: boolean
  bold?:  boolean
}) {
  return (
    <div className="flex items-center justify-between">
      <span className={muted ? 'text-slate-400' : 'text-slate-600'}>{label}</span>
      <span className={bold ? 'font-bold text-slate-900' : muted ? 'text-slate-400' : 'text-slate-700'}>
        {value}
      </span>
    </div>
  )
}
