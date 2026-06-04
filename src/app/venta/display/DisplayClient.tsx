'use client'

import { useEffect, useState } from 'react'
import { Package, CheckCircle2 } from 'lucide-react'
import { formatMXN, pluralUnidad } from '@/lib/utils'

export interface DisplayItem {
  nombre:         string
  cantidadCajas:  number
  cantidadPiezas: number
  unidad:         string
  subtotal:       number
  colorNombre?:   string | null
  ahorro?:        number
}

type DisplayState =
  | { screen: 'idle' }
  | { screen: 'cart';     items: DisplayItem[]; total: number }
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
                if (item.cantidadCajas  > 0) parts.push(`${item.cantidadCajas} ${pluralUnidad('caja', item.cantidadCajas)}`)
                if (item.cantidadPiezas > 0) {
                  const uPzas = item.cantidadCajas > 0 ? 'pza' : item.unidad
                  parts.push(`${item.cantidadPiezas} ${pluralUnidad(uPzas, item.cantidadPiezas)}`)
                }
                const cantDesc = [parts.join(' + '), item.colorNombre ?? null].filter(Boolean).join(' · ')
                return (
                  <tr key={i} className="text-slate-800">
                    <td className="py-4 text-base font-medium">{item.nombre}</td>
                    <td className="py-4 text-center text-slate-500">
                      <span>{cantDesc}</span>
                      {(item.ahorro ?? 0) > 0 && (
                        <span className="block text-sm text-green-600 font-semibold mt-0.5">
                          Mayoreo · Ahorro: {formatMXN(item.ahorro!)}
                        </span>
                      )}
                    </td>
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

  // ── Complete ──────────────────────────────────────────────
  return (
    <div className="flex flex-col items-center justify-center h-screen bg-gradient-to-br from-green-700 to-green-600 text-white select-none">
      <CheckCircle2 className="w-28 h-28 text-green-200 mb-8" />
      <h1 className="text-6xl font-bold mb-4">¡Gracias por tu compra!</h1>
      <p className="text-green-200 text-2xl">¡Regresa pronto! · ¡Bendiciones!</p>
    </div>
  )
}
