'use client'

import { useState } from 'react'
import Link from 'next/link'
import { MoreVertical, ClipboardList, TrendingDown, Plus } from 'lucide-react'
import type { Producto } from '@/lib/types'
import { calcularSemaforo } from '@/lib/types'
import { formatMXN } from '@/lib/utils'
import SemaforoBadge from './Semaforobadge'
import MovimientoModal from './MovimientoModal'

interface Props {
  producto: Producto
  onRefresh: () => void
}

export default function ProductoCard({ producto, onRefresh }: Props) {
  const [showMenu, setShowMenu] = useState(false)
  const [modalTipo, setModalTipo] = useState<'levantamiento_inventario' | 'salida_venta_manual' | 'entrada_compra' | null>(null)

  const semaforo = calcularSemaforo(producto.stock_fisico, producto.stock_minimo)

  function handleMovimientoSuccess() {
    setModalTipo(null)
    onRefresh()
  }

  return (
    <>
      <div className={`bg-white rounded-xl border transition-all ${
        semaforo === 'rojo' ? 'border-red-200 bg-red-50/30' : 'border-slate-200 hover:border-slate-300'
      }`}>
        <div className="p-4">
          {/* Header */}
          <div className="flex items-start justify-between gap-2 mb-3">
            <div className="min-w-0">
              <h3 className="text-sm font-semibold text-slate-900 leading-tight line-clamp-2">
                {producto.nombre}
              </h3>
              {producto.sku && (
                <p className="text-xs text-slate-400 mt-0.5">{producto.sku}</p>
              )}
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              <SemaforoBadge semaforo={semaforo} />
              <div className="relative">
                <button
                  onClick={() => setShowMenu(!showMenu)}
                  className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-slate-100 text-slate-400"
                  aria-label="Opciones"
                >
                  <MoreVertical className="w-4 h-4" />
                </button>
                {showMenu && (
                  <>
                    <div className="fixed inset-0 z-10" onClick={() => setShowMenu(false)} />
                    <div className="absolute right-0 top-8 z-20 bg-white rounded-xl border border-slate-200 shadow-lg py-1 min-w-[160px]">
                      <button
                        onClick={() => { setShowMenu(false); setModalTipo('levantamiento_inventario') }}
                        className="w-full h-9 px-3 text-sm text-left text-slate-700 hover:bg-slate-50 flex items-center gap-2"
                      >
                        <ClipboardList className="w-4 h-4 text-blue-500" />
                        Levantar inventario
                      </button>
                      <button
                        onClick={() => { setShowMenu(false); setModalTipo('entrada_compra') }}
                        className="w-full h-9 px-3 text-sm text-left text-slate-700 hover:bg-slate-50 flex items-center gap-2"
                      >
                        <Plus className="w-4 h-4 text-green-500" />
                        Entrada (compra)
                      </button>
                      <button
                        onClick={() => { setShowMenu(false); setModalTipo('salida_venta_manual') }}
                        className="w-full h-9 px-3 text-sm text-left text-slate-700 hover:bg-slate-50 flex items-center gap-2"
                      >
                        <TrendingDown className="w-4 h-4 text-amber-500" />
                        Registrar venta
                      </button>
                      <hr className="my-1 border-slate-100" />
                      <Link
                        href={`/inventario/${producto.id}`}
                        onClick={() => setShowMenu(false)}
                        className="w-full h-9 px-3 text-sm text-left text-slate-700 hover:bg-slate-50 flex items-center gap-2"
                      >
                        Ver historial
                      </Link>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Stock */}
          <div className="flex items-end justify-between">
            <div>
              <p className={`text-2xl font-bold leading-none ${
                semaforo === 'rojo' ? 'text-red-600' :
                semaforo === 'amarillo' ? 'text-amber-600' :
                'text-slate-900'
              }`}>
                {producto.stock_fisico}
                <span className="text-sm font-normal text-slate-400 ml-1">{producto.unidad}</span>
              </p>
              <p className="text-xs text-slate-400 mt-1">
                Mínimo: {producto.stock_minimo} {producto.unidad}
              </p>
            </div>
            <div className="text-right">
              <p className="text-sm font-semibold text-slate-900">{formatMXN(producto.precio_menudeo)}</p>
              {producto.precio_mayoreo && (
                <p className="text-xs text-slate-400">{formatMXN(producto.precio_mayoreo)} mayoreo</p>
              )}
            </div>
          </div>

          {/* Quick action — levantar inventario */}
          <button
            onClick={() => setModalTipo('levantamiento_inventario')}
            className="mt-3 w-full h-9 bg-violet-50 hover:bg-violet-100 text-violet-700 text-xs font-semibold rounded-lg transition-colors flex items-center justify-center gap-1.5"
          >
            <ClipboardList className="w-3.5 h-3.5" />
            Levantar inventario
          </button>
        </div>
      </div>

      {modalTipo && (
        <MovimientoModal
          producto={producto}
          defaultTipo={modalTipo}
          onClose={() => setModalTipo(null)}
          onSuccess={handleMovimientoSuccess}
        />
      )}
    </>
  )
}
