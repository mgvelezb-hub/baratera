'use client'

import { useEffect, useState } from 'react'
import { Package, CheckCircle2 } from 'lucide-react'
import { formatMXN } from '@/lib/utils'

export interface DisplayItem {
  nombre:        string
  cantidadCajas: number
  cantidadPiezas: number
  unidad:        string
  subtotal:      number
}

type DisplayState =
  | { screen: 'idle' }
  | { screen: 'cart';     items: DisplayItem[]; total: number }
  | { screen: 'payment';  total: number; metodo: string }
  | { screen: 'complete'; items: DisplayItem[]; total: number; metodo: string; cambio: number }

export default function DisplayClient() {
  const [state, setState] = useState<DisplayState>({ screen: 'idle' })

  useEffect(() => {
    const channel = new BroadcastChannel('baratera-pos')
    channel.onmessage = (e: MessageEvent<DisplayState>) => setState(e.data)
    return () => channel.close()
  }, [])

  // ── Idle ──────────────────────────────────────────────────
  if (state.screen === 'idle') {
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-gradient-to-br from-violet-900 to-violet-700 text-white select-none">
        <div className="w-20 h-20 rounded-2xl bg-white/10 flex items-center justify-center mb-6">
          <Package className="w-10 h-10 text-white" />
        </div>
        <p className="text-xs font-semibold uppercase tracking-widest text-violet-300 mb-2">Papelería</p>
        <h1 className="text-4xl font-bold text-center">La Más Baratera</h1>
        <p className="text-violet-300 mt-3 text-lg">¡Bienvenido!</p>
      </div>
    )
  }

  // ── Cart ──────────────────────────────────────────────────
  if (state.screen === 'cart') {
    return (
      <div className="flex flex-col h-screen bg-slate-50">
        <div className="bg-violet-700 px-8 py-4 flex items-center gap-3">
          <Package className="w-6 h-6 text-white" />
          <p className="text-white font-semibold text-lg">La Más Baratera</p>
        </div>

        <div className="flex-1 overflow-y-auto px-8 py-6">
          <table className="w-full">
            <thead>
              <tr className="text-left text-xs text-slate-400 font-semibold uppercase tracking-wide border-b border-slate-200 pb-2">
                <th className="pb-3">Producto</th>
                <th className="pb-3 text-center">Cant.</th>
                <th className="pb-3 text-right">Subtotal</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {state.items.map((item, i) => {
                const parts: string[] = []
                if (item.cantidadCajas > 0)  parts.push(`${item.cantidadCajas} cajas`)
                if (item.cantidadPiezas > 0) parts.push(`${item.cantidadPiezas} piezas`)
                return (
                  <tr key={i} className="text-slate-800">
                    <td className="py-4 text-base font-medium">{item.nombre}</td>
                    <td className="py-4 text-center text-slate-500">{parts.join(' + ')}</td>
                    <td className="py-4 text-right font-semibold">{formatMXN(item.subtotal)}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        <div className="bg-white border-t-2 border-violet-200 px-8 py-6 flex items-center justify-between">
          <span className="text-xl text-slate-600 font-medium">Total</span>
          <span className="text-5xl font-bold text-violet-700">{formatMXN(state.total)}</span>
        </div>
      </div>
    )
  }

  // ── Payment ───────────────────────────────────────────────
  if (state.screen === 'payment') {
    const metodoLabel = state.metodo === 'efectivo' ? 'Efectivo'
      : state.metodo === 'tarjeta' ? 'Tarjeta'
      : 'Efectivo + Tarjeta'

    return (
      <div className="flex flex-col items-center justify-center h-screen bg-slate-900 text-white select-none">
        <p className="text-slate-400 text-lg mb-4">Total a pagar</p>
        <p className="text-8xl font-bold text-white mb-8">{formatMXN(state.total)}</p>
        <span className="bg-violet-600 text-white px-6 py-2 rounded-full text-base font-semibold">
          {metodoLabel}
        </span>
      </div>
    )
  }

  // ── Complete ──────────────────────────────────────────────
  const metodoLabel = state.metodo === 'efectivo' ? 'Efectivo'
    : state.metodo === 'tarjeta' ? 'Tarjeta'
    : 'Efectivo + Tarjeta'

  return (
    <div className="flex flex-col items-center justify-center h-screen bg-gradient-to-br from-green-700 to-green-600 text-white select-none">
      <CheckCircle2 className="w-24 h-24 text-green-200 mb-6" />
      <h1 className="text-5xl font-bold mb-2">¡Gracias!</h1>
      <p className="text-green-200 text-xl mb-8">Pago recibido · {metodoLabel}</p>
      <div className="bg-white/20 rounded-2xl px-10 py-6 text-center">
        <p className="text-green-100 text-sm mb-1">Total pagado</p>
        <p className="text-4xl font-bold">{formatMXN(state.total)}</p>
        {state.cambio > 0 && (
          <p className="text-green-200 text-xl mt-2">Cambio: {formatMXN(state.cambio)}</p>
        )}
      </div>
    </div>
  )
}
