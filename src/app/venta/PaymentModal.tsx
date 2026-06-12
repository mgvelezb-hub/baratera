'use client'

import { useState } from 'react'
import { X, Banknote, CreditCard, Blend, CheckCircle2, Loader2, ArrowLeftRight } from 'lucide-react'
import { formatMXN } from '@/lib/utils'

export interface PaymentData {
  metodo:              'efectivo' | 'tarjeta' | 'transferencia' | 'mixto'
  montoEfectivo:       number
  montoTarjeta:        number
  montoTransferencia:  number
  cambio:              number
  cuponPct?:           number | null
  descuento?:          number | null
}

interface Props {
  total:       number
  confirmando: boolean
  onCancel:    () => void
  onConfirmar: (data: PaymentData) => Promise<void>
}

type Metodo = PaymentData['metodo']

const COUPON_CODES: Record<string, number> = {
  'BARA5':    5,
  '10PAPE':   10,
  'LAMAS15':  15,
  'LABARA20': 20,
}

export default function PaymentModal({ total: totalOriginal, confirmando, onCancel, onConfirmar }: Props) {
  const [metodo,         setMetodo]         = useState<Metodo>('efectivo')
  const [recibidoStr,    setRecibidoStr]    = useState('')
  const [tarjetaStr,     setTarjetaStr]     = useState('')
  const [digitalConfirm, setDigitalConfirm] = useState(false)
  const [cuponPct,       setCuponPct]       = useState<number | null>(null)
  const [codigoStr,      setCodigoStr]      = useState('')
  const [codigoError,    setCodigoError]    = useState('')

  const descuento  = cuponPct ? Math.round(totalOriginal * cuponPct) / 100 : 0
  const total      = totalOriginal - descuento

  const recibido = parseFloat(recibidoStr) || 0
  const tarjeta  = parseFloat(tarjetaStr)  || 0

  const cambioEfectivo = Math.max(0, recibido - total)
  const mixtoEfectivo  = Math.max(0, total - tarjeta)
  const mixtoCambio    = Math.max(0, recibido - mixtoEfectivo)

  function canConfirm(): boolean {
    if (confirmando) return false
    if (metodo === 'efectivo')      return recibido >= total
    if (metodo === 'tarjeta')       return digitalConfirm
    if (metodo === 'transferencia') return digitalConfirm
    if (metodo === 'mixto') {
      const necesario = Math.max(0, total - tarjeta)
      return digitalConfirm && recibido >= necesario && tarjeta > 0 && tarjeta <= total
    }
    return false
  }

  async function handleConfirmar() {
    if (!canConfirm()) return
    let data: PaymentData
    const extra = { cuponPct, descuento: descuento > 0 ? descuento : null }
    if (metodo === 'efectivo') {
      data = { metodo, montoEfectivo: recibido, montoTarjeta: 0, montoTransferencia: 0, cambio: cambioEfectivo, ...extra }
    } else if (metodo === 'tarjeta') {
      data = { metodo, montoEfectivo: 0, montoTarjeta: total, montoTransferencia: 0, cambio: 0, ...extra }
    } else if (metodo === 'transferencia') {
      data = { metodo, montoEfectivo: 0, montoTarjeta: 0, montoTransferencia: total, cambio: 0, ...extra }
    } else {
      data = { metodo, montoEfectivo: recibido, montoTarjeta: tarjeta, montoTransferencia: 0, cambio: mixtoCambio, ...extra }
    }
    await onConfirmar(data)
  }

  function handleMetodo(m: Metodo) {
    setMetodo(m)
    setDigitalConfirm(false)
    setRecibidoStr('')
    setTarjetaStr('')
    setCuponPct(null)
    setCodigoStr('')
    setCodigoError('')
  }

  function aplicarCodigo() {
    const pct = COUPON_CODES[codigoStr.trim().toUpperCase()]
    if (pct) {
      setCuponPct(pct)
      setCodigoError('')
    } else {
      setCodigoError('Código no válido')
      setCuponPct(null)
    }
  }

  const tabs: { id: Metodo; label: string; icon: React.ReactNode }[] = [
    { id: 'efectivo',      label: 'Efectivo',        icon: <Banknote       className="w-4 h-4" /> },
    { id: 'tarjeta',       label: 'Tarjeta',          icon: <CreditCard     className="w-4 h-4" /> },
    { id: 'transferencia', label: 'Transferencia',    icon: <ArrowLeftRight className="w-4 h-4" /> },
    { id: 'mixto',         label: 'Ef. + Tarjeta',   icon: <Blend          className="w-4 h-4" /> },
  ]

  const digitalLabel = metodo === 'transferencia' ? 'transferencia' : 'tarjeta'

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/50">
      <div className="w-full max-w-sm bg-white rounded-2xl shadow-xl">

        {/* Header */}
        <div className="flex items-center justify-between p-5 pb-4 border-b border-slate-100">
          <div>
            <h2 className="text-base font-semibold text-slate-900">Cobrar</h2>
            {cuponPct ? (
              <div className="mt-0.5">
                <span className="text-sm text-slate-400 line-through mr-2">{formatMXN(totalOriginal)}</span>
                <span className="text-2xl font-bold text-green-600">{formatMXN(total)}</span>
              </div>
            ) : (
              <p className="text-2xl font-bold text-violet-700 mt-0.5">{formatMXN(total)}</p>
            )}
          </div>
          <button onClick={onCancel} disabled={confirmando} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 space-y-4">

          {/* Method tabs — 2×2 grid */}
          <div className="grid grid-cols-2 gap-1.5 bg-slate-100 p-1 rounded-xl">
            {tabs.map(t => (
              <button
                key={t.id}
                onClick={() => handleMetodo(t.id)}
                className={`flex items-center justify-center gap-1.5 py-2.5 rounded-lg text-xs font-semibold transition-colors ${
                  metodo === t.id
                    ? 'bg-white text-violet-700 shadow-sm'
                    : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                {t.icon}
                {t.label}
              </button>
            ))}
          </div>

          {/* Efectivo */}
          {metodo === 'efectivo' && (
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">
                  ¿Cuánto entrega el cliente?
                </label>
                <input
                  type="number" min={total} step="0.01"
                  value={recibidoStr} onChange={e => setRecibidoStr(e.target.value)}
                  placeholder={formatMXN(total)}
                  className="w-full h-12 px-4 text-lg font-semibold rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-violet-500 text-center"
                />
              </div>
              {recibido >= total && (
                <div className="flex items-center justify-between bg-green-50 border border-green-200 rounded-xl px-4 py-3">
                  <span className="text-sm text-green-700 font-medium">Cambio</span>
                  <span className="text-xl font-bold text-green-700">{formatMXN(cambioEfectivo)}</span>
                </div>
              )}
              {recibido > 0 && recibido < total && (
                <p className="text-xs text-red-500 text-center">Faltan {formatMXN(total - recibido)}</p>
              )}
            </div>
          )}

          {/* Tarjeta o Transferencia — misma UI, solo cambia el label */}
          {(metodo === 'tarjeta' || metodo === 'transferencia') && (
            <div className="space-y-3">
              <div className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 flex items-center justify-between">
                <span className="text-sm text-slate-600 font-medium">
                  Total a cobrar por {digitalLabel}
                </span>
                <span className="text-lg font-bold text-slate-900">{formatMXN(total)}</span>
              </div>
              <button
                onClick={() => setDigitalConfirm(v => !v)}
                className={`w-full flex items-center gap-3 h-12 px-4 rounded-xl border-2 transition-colors ${
                  digitalConfirm
                    ? 'bg-green-50 border-green-400 text-green-700'
                    : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300'
                }`}
              >
                <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 ${
                  digitalConfirm ? 'border-green-500 bg-green-500' : 'border-slate-300'
                }`}>
                  {digitalConfirm && <CheckCircle2 className="w-3.5 h-3.5 text-white" />}
                </div>
                <span className="text-sm font-semibold">
                  {digitalConfirm
                    ? `Pago por ${digitalLabel} confirmado ✓`
                    : `Confirmar pago por ${digitalLabel}`}
                </span>
              </button>
            </div>
          )}

          {/* Mixto (Efectivo + Tarjeta) */}
          {metodo === 'mixto' && (
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Monto con tarjeta ($)</label>
                <input
                  type="number" min="0" max={total} step="0.01"
                  value={tarjetaStr} onChange={e => setTarjetaStr(e.target.value)}
                  placeholder="0.00"
                  className="w-full h-11 px-4 rounded-xl border border-slate-300 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-violet-500 text-center"
                />
              </div>

              {tarjeta > 0 && tarjeta <= total && (
                <>
                  <div className="bg-slate-50 rounded-xl px-4 py-2 flex items-center justify-between">
                    <span className="text-xs text-slate-500">Restante en efectivo</span>
                    <span className="text-sm font-bold text-slate-900">{formatMXN(mixtoEfectivo)}</span>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1.5">Efectivo recibido ($)</label>
                    <input
                      type="number" min={mixtoEfectivo} step="0.01"
                      value={recibidoStr} onChange={e => setRecibidoStr(e.target.value)}
                      placeholder={formatMXN(mixtoEfectivo)}
                      className="w-full h-11 px-4 rounded-xl border border-slate-300 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-violet-500 text-center"
                    />
                  </div>
                  {recibido >= mixtoEfectivo && (
                    <div className="flex items-center justify-between bg-green-50 border border-green-200 rounded-xl px-4 py-2">
                      <span className="text-xs text-green-700 font-medium">Cambio</span>
                      <span className="text-sm font-bold text-green-700">{formatMXN(mixtoCambio)}</span>
                    </div>
                  )}
                  <button
                    onClick={() => setDigitalConfirm(v => !v)}
                    className={`w-full flex items-center gap-3 h-11 px-4 rounded-xl border-2 transition-colors ${
                      digitalConfirm
                        ? 'bg-green-50 border-green-400 text-green-700'
                        : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300'
                    }`}
                  >
                    <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 ${
                      digitalConfirm ? 'border-green-500 bg-green-500' : 'border-slate-300'
                    }`}>
                      {digitalConfirm && <CheckCircle2 className="w-3.5 h-3.5 text-white" />}
                    </div>
                    <span className="text-xs font-semibold">
                      {digitalConfirm ? 'Tarjeta confirmada ✓' : 'Confirmar pago con tarjeta'}
                    </span>
                  </button>
                </>
              )}
            </div>
          )}

          {/* Código de descuento */}
          <div className="border-t border-slate-100 pt-3">
            <p className="text-xs text-slate-400 font-medium mb-2">Código de descuento</p>
            {cuponPct ? (
              <div className="flex items-center justify-between bg-green-50 border border-green-200 rounded-xl px-3 py-2">
                <span className="text-sm text-green-700 font-semibold">✓ {codigoStr} — {cuponPct}% Off</span>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-green-600 font-bold">−{formatMXN(descuento)}</span>
                  <button
                    type="button"
                    onClick={() => { setCuponPct(null); setCodigoStr(''); setCodigoError('') }}
                    className="text-green-500 hover:text-red-500 text-xs"
                  >✕</button>
                </div>
              </div>
            ) : (
              <>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={codigoStr}
                    onChange={e => { setCodigoStr(e.target.value.toUpperCase()); setCodigoError('') }}
                    onKeyDown={e => e.key === 'Enter' && aplicarCodigo()}
                    placeholder="Ej. BARA5"
                    className="flex-1 h-10 px-3 rounded-xl border border-slate-200 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-violet-500 tracking-widest"
                  />
                  <button
                    type="button"
                    onClick={aplicarCodigo}
                    disabled={!codigoStr.trim()}
                    className="h-10 px-4 bg-slate-100 hover:bg-slate-200 disabled:opacity-40 text-slate-700 text-sm font-medium rounded-xl transition-colors"
                  >
                    Aplicar
                  </button>
                </div>
                {codigoError && (
                  <p className="text-xs text-red-500 mt-1">{codigoError}</p>
                )}
              </>
            )}
          </div>

          {/* Confirm button */}
          <button
            onClick={handleConfirmar}
            disabled={!canConfirm()}
            className="w-full h-12 bg-violet-600 hover:bg-violet-700 disabled:bg-slate-200 disabled:text-slate-400 text-white text-sm font-bold rounded-xl transition-colors flex items-center justify-center gap-2"
          >
            {confirmando
              ? <><Loader2 className="w-4 h-4 animate-spin" />Registrando...</>
              : 'Confirmar cobro'
            }
          </button>
        </div>
      </div>
    </div>
  )
}
