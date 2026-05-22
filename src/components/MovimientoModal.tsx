'use client'

import { useState } from 'react'
import { X, Loader2 } from 'lucide-react'
import type { Producto, MovimientoTipo } from '@/lib/types'
import { TIPOS_MOVIMIENTO } from '@/lib/types'
import { createClient } from '@/lib/supabase/client'

interface Props {
  producto: Producto
  onClose: () => void
  onSuccess: () => void
  defaultTipo?: MovimientoTipo
}

export default function MovimientoModal({ producto, onClose, onSuccess, defaultTipo = 'salida_venta_manual' }: Props) {
  const [tipo, setTipo] = useState<MovimientoTipo>(defaultTipo)
  const [cantidad, setCantidad] = useState('')
  const [notas, setNotas] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const tipoConfig = TIPOS_MOVIMIENTO[tipo]
  const cantidadNum = parseInt(cantidad) || 0
  const nuevoStock = tipo === 'levantamiento_inventario'
    ? cantidadNum
    : producto.stock_fisico + (tipoConfig.signo * cantidadNum)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!cantidadNum || cantidadNum <= 0) {
      setError('La cantidad debe ser mayor a 0')
      return
    }
    if (nuevoStock < 0) {
      setError('No hay suficiente stock para esta operación')
      return
    }

    setLoading(true)
    setError('')

    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()

    const nuevoStockFinal = tipo === 'levantamiento_inventario'
      ? cantidadNum
      : producto.stock_fisico + (tipoConfig.signo * cantidadNum)

    const { error: ledgerError } = await supabase.from('stock_ledger').insert({
      producto_id: producto.id,
      tipo,
      qty_antes: producto.stock_fisico,
      qty_despues: nuevoStockFinal,
      notas: notas || null,
      canal: 'manual',
      usuario_id: user?.id ?? null,
    })

    if (ledgerError) {
      setError('Error al registrar el movimiento. Intenta de nuevo.')
      setLoading(false)
      return
    }

    const { error: updateError } = await supabase
      .from('productos')
      .update({ stock_fisico: nuevoStockFinal })
      .eq('id', producto.id)

    if (updateError) {
      setError('Movimiento guardado pero error al actualizar stock. Recarga la página.')
      setLoading(false)
      return
    }

    onSuccess()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/40">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-xl">
        {/* Header */}
        <div className="flex items-start justify-between p-5 pb-4">
          <div>
            <h2 className="text-base font-semibold text-slate-900">Registrar movimiento</h2>
            <p className="text-sm text-slate-500 mt-0.5 line-clamp-1">{producto.nombre}</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="px-5 pb-5 space-y-4">
          {/* Tipo de movimiento */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Tipo</label>
            <div className="grid grid-cols-2 gap-2">
              {(Object.entries(TIPOS_MOVIMIENTO) as [MovimientoTipo, typeof TIPOS_MOVIMIENTO[MovimientoTipo]][]).map(([key, cfg]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => { setTipo(key); setError('') }}
                  className={`h-10 px-3 rounded-lg text-sm font-medium border transition-colors text-left ${
                    tipo === key
                      ? 'bg-violet-50 border-violet-300 text-violet-700'
                      : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  {cfg.label}
                </button>
              ))}
            </div>
          </div>

          {/* Cantidad */}
          <div>
            <label htmlFor="cantidad" className="block text-sm font-medium text-slate-700 mb-1.5">
              {tipo === 'levantamiento_inventario' ? 'Cantidad contada' : 'Cantidad'}
            </label>
            <input
              id="cantidad"
              type="number"
              min="1"
              value={cantidad}
              onChange={e => { setCantidad(e.target.value); setError('') }}
              required
              autoFocus
              className="w-full h-11 px-3 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 text-center text-lg font-semibold"
              placeholder="0"
            />
          </div>

          {/* Preview stock */}
          <div className="bg-slate-50 rounded-xl p-3 flex items-center justify-between text-sm">
            <div className="text-slate-500">
              Stock actual: <span className="font-semibold text-slate-900">{producto.stock_fisico} {producto.unidad}</span>
            </div>
            <div className="text-slate-500">
              Quedará: <span className={`font-semibold ${nuevoStock < producto.stock_minimo ? 'text-red-600' : 'text-slate-900'}`}>
                {nuevoStock} {producto.unidad}
              </span>
            </div>
          </div>

          {/* Notas */}
          <div>
            <label htmlFor="notas" className="block text-sm font-medium text-slate-700 mb-1.5">
              Notas <span className="text-slate-400 font-normal">(opcional)</span>
            </label>
            <input
              id="notas"
              type="text"
              value={notas}
              onChange={e => setNotas(e.target.value)}
              className="w-full h-11 px-3 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
              placeholder="Ej: Compra Proveedor X, factura #123..."
              maxLength={200}
            />
          </div>

          {error && (
            <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>
          )}

          {/* Botones */}
          <div className="flex gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 h-11 rounded-xl border border-slate-200 text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading || !cantidadNum}
              className="flex-1 h-11 bg-violet-600 hover:bg-violet-700 disabled:bg-violet-300 text-white text-sm font-semibold rounded-xl transition-colors flex items-center justify-center gap-2"
            >
              {loading && <Loader2 className="w-4 h-4 animate-spin" />}
              {loading ? 'Guardando...' : 'Guardar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
