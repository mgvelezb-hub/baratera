'use client'

import { useState } from 'react'
import { X, Banknote, CreditCard, Blend, CheckCircle2, Loader2 } from 'lucide-react'
import { formatMXN } from '@/lib/utils'

export interface PaymentData {
  metodo:        'efectivo' | 'tarjeta' | 'mixto'
  montoEfectivo: number
  montoTarjeta:  number
  cambio:        number
}

interface Props {
  total:       number
  confirmando: boolean
  onCancel:    () => void
  onConfirmar: (data: PaymentData) => Promise<void>
}

type Metodo = 'efectivo' | 'tarjeta' | 'mixto'

export default function PaymentModal({ total, confirmando, onCancel, onConfirmar }: Props) {
  const [metodo,           setMetodo]           = useState<Metodo>('efectivo')
  const [recibidoStr,      setRecibidoStr]       = useState('')
  const [tarjetaStr,       setTarjetaStr]        = useState('')
  const [tarjetaConfirm,   setTarjetaConfirm]    = useState(false)

  const recibido = parseFloat(recibidoStr) || 0
  const tarjeta  = parseFloat(tarjetaStr)  || 0

  // ── Derived values ─────────────────────────────────────────
  const cambioEfectivo = Math.max(0, recibido - total)
  const mixtoEfectivo  = Math.max(0, total - tarjeta)
  const mixtoCambio    = Math.max(0, recibido - mixtoEfectivo)

  function canConfirm(): boolean {
    if (confirmando) return false
    if (metodo === 'efectivo') return recibido >= total
    if (metodo === 'tarjeta')  return tarjetaConfirm
    if (metodo === 'mixto') {
      const efectivoNecesario = Math.max(0, total - tarjeta)
      return tarjetaConfirm && recibido >= efectivoNecesario && tarjeta > 0 && tarjeta <= total
    }
    return false
  }

  async function handleConfirmar() {
    if (!canConfirm()) return
    let data: PaymentData
    if (metodo === 'efectivo') {
      data = { metodo, montoEfectivo: recibido, montoTarjeta: 0, cambio: cambioEfectivo }
    } else if (metodo === 'tarjeta') {
      data = { metodo, montoEfectivo: 0, montoTarjeta: total, cambio: 0 }
    } else {
      data = { metodo, montoEfectivo: recibido, montoTarjeta: tarjeta, cambio: mixtoCambio }
    }
    await onConfirmar(data)
  }

  const tabs: { id: Metodo; label: string; icon: React.ReactNode }[] = [
    { id: 'efectivo', label: 'Efectivo',        icon: <Banknote    className="w-4 h-4" /> },
    { id: 'tarjeta',  label: 'Tarjeta',          icon: <CreditCard  className="w-4 h-4" /> },
    { id: 'mixto',    label: 'Efectivo + Tarjeta', icon: <Blend     className="w-4 h-4" /> },
  ]

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/50">
      <div className="w-full max-w-sm bg-white rounded-2xl shadow-xl">

        {/* Header */}
        <div className="flex items-center justify-between p-5 pb-4 border-b border-slate-100">
          <div>
            <h2 className="text-base font-semibold text-slate-900">Cobrar</h2>
            <p className="text-2xl font-bold text-violet-700 mt-0.5">{formatMXN(total)}</p>
          </div>
          <button onClick={onCancel} disabled={confirmando} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {/* Method tabs */}
          <div className="grid grid-cols-3 gap-1.5 bg-slate-100 p-1 rounded-xl">
            {tabs.map(t => (
              <button
                key={t.id}
                onClick={() => { setMetodo(t.id); setTarjetaConfirm(false) }}
                className={`flex flex-col items-center gap-0.5 py-2 rounded-lg text-xs font-semibold transition-colors ${
                  metodo === t.id
                    ? 'bg-white text-violet-700 shadow-sm'
                    : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                {t.icon}
                <span className="leading-tight text-center">{t.label}</span>
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
                  type="number"
                  min={total}
                  step="0.01"
                  value={recibidoStr}
                  onChange={e => setRecibidoStr(e.target.value)}
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
                <p className="text-xs text-red-500 text-center">
                  Faltan {formatMXN(total - recibido)}
                </p>
              )}
            </div>
          )}

          {/* Tarjeta */}
          {metodo === 'tarjeta' && (
            <div className="space-y-3">
              <div className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 flex items-center justify-between">
                <span className="text-sm text-slate-600 font-medium">Total a cobrar en tarjeta</span>
                <span className="text-lg font-bold text-slate-900">{formatMXN(total)}</span>
              </div>
              <button
                onClick={() => setTarjetaConfirm(!tarjetaConfirm)}
                className={`w-full flex items-center gap-3 h-12 px-4 rounded-xl border-2 transition-colors ${
                  tarjetaConfirm
                    ? 'bg-green-50 border-green-400 text-green-700'
                    : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300'
                }`}
              >
                <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 ${
                  tarjetaConfirm ? 'border-green-500 bg-green-500' : 'border-slate-300'
                }`}>
                  {tarjetaConfirm && <CheckCircle2 className="w-3.5 h-3.5 text-white" />}
                </div>
                <span className="text-sm font-semibold">
                  {tarjetaConfirm ? 'Pago con tarjeta confirmado ✓' : 'Confirmar pago con tarjeta'}
                </span>
              </button>
            </div>
          )}

          {/* Mixto */}
          {metodo === 'mixto' && (
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">
                  Monto con tarjeta ($)
                </label>
                <input
                  type="number"
                  min="0"
                  max={total}
                  step="0.01"
                  value={tarjetaStr}
                  onChange={e => setTarjetaStr(e.target.value)}
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
                    <label className="block text-sm font-medium text-slate-700 mb-1.5">
                      Efectivo recibido ($)
                    </label>
                    <input
                      type="number"
                      min={mixtoEfectivo}
                      step="0.01"
                      value={recibidoStr}
                      onChange={e => setRecibidoStr(e.target.value)}
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
                    onClick={() => setTarjetaConfirm(!tarjetaConfirm)}
                    className={`w-full flex items-center gap-3 h-11 px-4 rounded-xl border-2 transition-colors ${
                      tarjetaConfirm
                        ? 'bg-green-50 border-green-400 text-green-700'
                        : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300'
                    }`}
                  >
                    <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 ${
                      tarjetaConfirm ? 'border-green-500 bg-green-500' : 'border-slate-300'
                    }`}>
                      {tarjetaConfirm && <CheckCircle2 className="w-3.5 h-3.5 text-white" />}
                    </div>
                    <span className="text-xs font-semibold">
                      {tarjetaConfirm ? 'Tarjeta confirmada ✓' : 'Confirmar pago con tarjeta'}
                    </span>
                  </button>
                </>
              )}
            </div>
          )}

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
