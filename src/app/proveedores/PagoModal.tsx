'use client'

import { useState } from 'react'
import { X, Banknote, CreditCard, ArrowLeftRight, Blend, Loader2, CheckCircle2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import type { Adeudo } from '@/lib/types'
import { formatMXN } from '@/lib/utils'

type Metodo = 'efectivo' | 'tarjeta' | 'transferencia' | 'mixto'

interface Props {
  adeudo:    Adeudo
  onClose:   () => void
  onSuccess: () => void
}

const METODOS = [
  { id: 'efectivo'      as Metodo, label: 'Efectivo',      Icon: Banknote       },
  { id: 'tarjeta'       as Metodo, label: 'Tarjeta',        Icon: CreditCard     },
  { id: 'transferencia' as Metodo, label: 'Transferencia',  Icon: ArrowLeftRight },
  { id: 'mixto'         as Metodo, label: 'Mixto',          Icon: Blend          },
]

export default function PagoModal({ adeudo, onClose, onSuccess }: Props) {
  const restante = Number(adeudo.monto) - Number(adeudo.monto_pagado)

  const [montoStr,  setMontoStr]  = useState(restante.toFixed(2))
  const [metodo,    setMetodo]    = useState<Metodo>('efectivo')
  const [efStr,     setEfStr]     = useState('')
  const [tarStr,    setTarStr]    = useState('')
  const [transStr,  setTransStr]  = useState('')
  const [notas,     setNotas]     = useState('')
  const [loading,   setLoading]   = useState(false)
  const [error,     setError]     = useState('')

  const monto       = parseFloat(montoStr) || 0
  const ef          = parseFloat(efStr)    || 0
  const tar         = parseFloat(tarStr)   || 0
  const trans       = parseFloat(transStr) || 0
  const sumaMixto   = ef + tar + trans
  const diferencia  = monto - sumaMixto
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const provNombre  = (adeudo as any).proveedores?.nombre ?? '—'

  function canSubmit() {
    if (loading || monto <= 0 || monto > restante + 0.01) return false
    if (metodo === 'mixto') return Math.abs(diferencia) < 0.01 && sumaMixto > 0
    return true
  }

  function handleMetodo(m: Metodo) {
    setMetodo(m)
    setEfStr(''); setTarStr(''); setTransStr('')
    setError('')
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!canSubmit()) return
    setLoading(true)
    setError('')

    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()

    let mEf = 0, mTar = 0, mTrans = 0
    if (metodo === 'efectivo')      mEf    = monto
    if (metodo === 'tarjeta')       mTar   = monto
    if (metodo === 'transferencia') mTrans = monto
    if (metodo === 'mixto')         { mEf = ef; mTar = tar; mTrans = trans }

    const { error: pagoErr } = await supabase.from('pagos_proveedor').insert({
      adeudo_id:           adeudo.id,
      monto,
      metodo,
      monto_efectivo:      mEf,
      monto_tarjeta:       mTar,
      monto_transferencia: mTrans,
      notas:               notas.trim() || null,
      created_by:          user?.id ?? null,
    })

    if (pagoErr) {
      setError('Error al registrar el pago. Intenta de nuevo.')
      setLoading(false)
      return
    }

    const nuevoPagado = Number(adeudo.monto_pagado) + monto
    const nuevoEstado = nuevoPagado >= Number(adeudo.monto) - 0.01 ? 'pagado' : 'parcial'

    await supabase.from('adeudos').update({
      monto_pagado: nuevoPagado,
      estado:       nuevoEstado,
      fecha_pago:   nuevoEstado === 'pagado' ? new Date().toISOString().split('T')[0] : null,
    }).eq('id', adeudo.id)

    setLoading(false)
    onSuccess()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/50">
      <div className="w-full max-w-sm bg-white rounded-2xl shadow-xl">

        {/* Header */}
        <div className="flex items-center justify-between p-5 pb-4 border-b border-slate-100">
          <div>
            <h2 className="text-base font-semibold text-slate-900">Registrar pago</h2>
            <p className="text-xs text-slate-500 mt-0.5 max-w-[220px] truncate">
              {provNombre} · {adeudo.descripcion}
            </p>
          </div>
          <button onClick={onClose} disabled={loading} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400">
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">

          {/* Balance */}
          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="bg-slate-50 rounded-xl p-2">
              <p className="text-[10px] text-slate-400 font-semibold uppercase tracking-wide">Total</p>
              <p className="text-sm font-bold text-slate-900">{formatMXN(Number(adeudo.monto))}</p>
            </div>
            <div className="bg-green-50 rounded-xl p-2">
              <p className="text-[10px] text-green-600 font-semibold uppercase tracking-wide">Pagado</p>
              <p className="text-sm font-bold text-green-700">{formatMXN(Number(adeudo.monto_pagado))}</p>
            </div>
            <div className="bg-amber-50 rounded-xl p-2">
              <p className="text-[10px] text-amber-600 font-semibold uppercase tracking-wide">Resta</p>
              <p className="text-sm font-bold text-amber-700">{formatMXN(restante)}</p>
            </div>
          </div>

          {/* Monto */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Monto a pagar</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">$</span>
              <input
                type="number" step="0.01" min="0.01" max={restante}
                value={montoStr}
                onChange={e => { setMontoStr(e.target.value); setError('') }}
                className="w-full h-12 pl-7 pr-4 text-lg font-semibold rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-violet-500 text-center"
              />
            </div>
            {monto > restante + 0.01 && (
              <p className="text-xs text-red-500 mt-1">Excede el saldo pendiente ({formatMXN(restante)})</p>
            )}
          </div>

          {/* Método */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Método de pago</label>
            <div className="grid grid-cols-2 gap-1.5 bg-slate-100 p-1 rounded-xl">
              {METODOS.map(({ id, label, Icon }) => (
                <button
                  key={id} type="button"
                  onClick={() => handleMetodo(id)}
                  className={`flex items-center justify-center gap-1.5 py-2.5 rounded-lg text-xs font-semibold transition-colors ${
                    metodo === id
                      ? 'bg-white text-violet-700 shadow-sm'
                      : 'text-slate-500 hover:text-slate-700'
                  }`}
                >
                  <Icon className="w-4 h-4" />{label}
                </button>
              ))}
            </div>
          </div>

          {/* Mixto sub-fields */}
          {metodo === 'mixto' && (
            <div className="space-y-2">
              {[
                { label: 'Efectivo',      value: efStr,    set: setEfStr    },
                { label: 'Tarjeta',       value: tarStr,   set: setTarStr   },
                { label: 'Transferencia', value: transStr, set: setTransStr },
              ].map(f => (
                <div key={f.label} className="flex items-center gap-3">
                  <span className="text-xs text-slate-500 w-24 shrink-0">{f.label}</span>
                  <div className="relative flex-1">
                    <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 text-xs">$</span>
                    <input
                      type="number" step="0.01" min="0"
                      value={f.value}
                      onChange={e => { f.set(e.target.value); setError('') }}
                      placeholder="0.00"
                      className="w-full h-9 pl-6 pr-3 text-sm rounded-lg border border-slate-300 focus:outline-none focus:ring-1 focus:ring-violet-400"
                    />
                  </div>
                </div>
              ))}
              <div className={`flex items-center justify-between px-3 py-2 rounded-lg text-xs font-semibold ${
                Math.abs(diferencia) < 0.01
                  ? 'bg-green-50 text-green-700'
                  : 'bg-amber-50 text-amber-700'
              }`}>
                <span>
                  {Math.abs(diferencia) < 0.01 ? '✓ Cuadra' : diferencia > 0
                    ? `Faltan ${formatMXN(diferencia)}`
                    : `Sobran ${formatMXN(-diferencia)}`}
                </span>
                <span>Suma: {formatMXN(sumaMixto)}</span>
              </div>
            </div>
          )}

          {/* Notas */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">
              Notas <span className="text-slate-400 font-normal">(opcional)</span>
            </label>
            <input
              type="text"
              value={notas}
              onChange={e => setNotas(e.target.value)}
              placeholder="Folio de transferencia, núm. de cheque..."
              className="w-full h-10 px-3 rounded-xl border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
            />
          </div>

          {error && <p className="text-xs text-red-500 text-center">{error}</p>}

          {/* Buttons */}
          <div className="flex gap-2 pt-1">
            <button
              type="button" onClick={onClose} disabled={loading}
              className="flex-1 h-11 rounded-xl border border-slate-200 text-sm text-slate-600 hover:bg-slate-50 transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit" disabled={!canSubmit()}
              className="flex-1 h-11 bg-violet-600 hover:bg-violet-700 disabled:bg-slate-200 disabled:text-slate-400 text-white text-sm font-bold rounded-xl transition-colors flex items-center justify-center gap-2"
            >
              {loading
                ? <><Loader2 className="w-4 h-4 animate-spin" />Registrando...</>
                : <><CheckCircle2 className="w-4 h-4" />Pagar {monto > 0 ? formatMXN(monto) : ''}</>
              }
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
