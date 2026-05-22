'use client'

import { useState } from 'react'
import { X, Loader2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import type { Producto } from '@/lib/types'

const UNIDADES   = ['pza', 'caja', 'kg', 'lt', 'paquete', 'rollo', 'resma', 'par', 'juego']
const CATEGORIAS = ['Cuadernos', 'Escritura', 'Corrección', 'Arte y manualidades', 'Oficina', 'Escolar', 'Tecnología', 'Otro']

interface Props {
  producto: Producto
  onClose: () => void
  onSuccess: () => void
}

export default function EditarProductoModal({ producto, onClose, onSuccess }: Props) {
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState('')

  const [form, setForm] = useState({
    nombre:          producto.nombre,
    sku:             producto.sku ?? '',
    descripcion:     producto.descripcion ?? '',
    categoria:       producto.categoria ?? '',
    unidad:          producto.unidad,
    precio_menudeo:  String(producto.precio_menudeo),
    precio_mayoreo:  producto.precio_mayoreo ? String(producto.precio_mayoreo) : '',
    umbral_mayoreo:  producto.umbral_mayoreo  ? String(producto.umbral_mayoreo)  : '',
    precio_caja:     producto.precio_caja    ? String(producto.precio_caja)    : '',
    piezas_por_caja: producto.piezas_por_caja ? String(producto.piezas_por_caja) : '',
    stock_minimo:    String(producto.stock_minimo),
  })

  function set(field: string, value: string) {
    setForm(f => ({ ...f, [field]: value }))
    setError('')
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.nombre.trim()) { setError('El nombre es requerido'); return }
    if (!form.precio_menudeo || parseFloat(form.precio_menudeo) < 0) {
      setError('El precio menudeo debe ser mayor a 0'); return
    }
    if (form.precio_caja && !form.piezas_por_caja) {
      setError('Indica cuántas piezas tiene cada caja'); return
    }
    if (form.piezas_por_caja && !form.precio_caja) {
      setError('Indica el precio por caja'); return
    }

    setLoading(true)
    const { error: updateError } = await createClient()
      .from('productos')
      .update({
        nombre:          form.nombre.trim(),
        sku:             form.sku.trim() || null,
        descripcion:     form.descripcion.trim() || null,
        categoria:       form.categoria || null,
        unidad:          form.unidad,
        precio_menudeo:  parseFloat(form.precio_menudeo),
        precio_mayoreo:  form.precio_mayoreo  ? parseFloat(form.precio_mayoreo)  : null,
        umbral_mayoreo:  form.umbral_mayoreo  ? parseInt(form.umbral_mayoreo)    : null,
        precio_caja:     form.precio_caja     ? parseFloat(form.precio_caja)     : null,
        piezas_por_caja: form.piezas_por_caja ? parseInt(form.piezas_por_caja)   : null,
        stock_minimo:    parseInt(form.stock_minimo) || 5,
      })
      .eq('id', producto.id)

    if (updateError) {
      setError('Error al guardar. Verifica que el SKU no esté repetido.')
      setLoading(false)
      return
    }

    onSuccess()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/40 overflow-y-auto">
      <div className="w-full max-w-lg bg-white rounded-2xl shadow-xl my-auto">
        <div className="flex items-center justify-between p-5 pb-4 border-b border-slate-100">
          <div>
            <h2 className="text-base font-semibold text-slate-900">Editar producto</h2>
            <p className="text-xs text-slate-400 mt-0.5 line-clamp-1">{producto.nombre}</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400">
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-5 max-h-[80vh] overflow-y-auto">

          {/* Nombre */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Nombre *</label>
            <input
              type="text"
              value={form.nombre}
              onChange={e => set('nombre', e.target.value)}
              required
              autoFocus
              className="w-full h-11 px-3 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
            />
          </div>

          {/* SKU + Categoría */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">SKU / Código</label>
              <input
                type="text"
                value={form.sku}
                onChange={e => set('sku', e.target.value.toUpperCase())}
                className="w-full h-11 px-3 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
                placeholder="CUA-100H"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Categoría</label>
              <select
                value={form.categoria}
                onChange={e => set('categoria', e.target.value)}
                className="w-full h-11 px-3 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 bg-white"
              >
                <option value="">Sin categoría</option>
                {CATEGORIAS.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          </div>

          {/* Unidad + Stock mínimo */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Unidad base</label>
              <select
                value={form.unidad}
                onChange={e => set('unidad', e.target.value)}
                className="w-full h-11 px-3 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 bg-white"
              >
                {UNIDADES.map(u => <option key={u} value={u}>{u}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Stock mínimo</label>
              <input
                type="number"
                min="0"
                value={form.stock_minimo}
                onChange={e => set('stock_minimo', e.target.value)}
                className="w-full h-11 px-3 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
              />
            </div>
          </div>

          {/* Precio menudeo */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Precio menudeo * ($)</label>
            <input
              type="number"
              min="0"
              step="0.01"
              value={form.precio_menudeo}
              onChange={e => set('precio_menudeo', e.target.value)}
              required
              className="w-full h-11 px-3 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
              placeholder="0.00"
            />
          </div>

          {/* Precio mayoreo */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Precio mayoreo ($)</label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={form.precio_mayoreo}
                onChange={e => set('precio_mayoreo', e.target.value)}
                className="w-full h-11 px-3 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
                placeholder="0.00"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">
                Cantidad mín. mayoreo
              </label>
              <input
                type="number"
                min="1"
                value={form.umbral_mayoreo}
                onChange={e => set('umbral_mayoreo', e.target.value)}
                disabled={!form.precio_mayoreo}
                className="w-full h-11 px-3 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 disabled:bg-slate-50 disabled:text-slate-400"
                placeholder="Ej: 12"
              />
            </div>
          </div>

          {/* Precio caja */}
          <div className="rounded-xl border border-slate-200 p-4 bg-slate-50 space-y-3">
            <p className="text-xs font-semibold text-slate-600 uppercase tracking-wide">
              Venta por caja (opcional)
            </p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Precio por caja ($)</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.precio_caja}
                  onChange={e => set('precio_caja', e.target.value)}
                  className="w-full h-11 px-3 rounded-lg border border-slate-300 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
                  placeholder="0.00"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Piezas por caja</label>
                <input
                  type="number"
                  min="1"
                  value={form.piezas_por_caja}
                  onChange={e => set('piezas_por_caja', e.target.value)}
                  disabled={!form.precio_caja}
                  className="w-full h-11 px-3 rounded-lg border border-slate-300 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 disabled:bg-slate-50 disabled:text-slate-400"
                  placeholder="Ej: 12"
                />
              </div>
            </div>
            {form.precio_caja && form.piezas_por_caja && (
              <p className="text-xs text-violet-600">
                Precio por pieza (caja): {
                  (parseFloat(form.precio_caja) / parseInt(form.piezas_por_caja)).toLocaleString('es-MX', { style: 'currency', currency: 'MXN' })
                } c/u
              </p>
            )}
          </div>

          {error && (
            <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>
          )}

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
              disabled={loading}
              className="flex-1 h-11 bg-violet-600 hover:bg-violet-700 disabled:bg-violet-300 text-white text-sm font-semibold rounded-xl transition-colors flex items-center justify-center gap-2"
            >
              {loading && <Loader2 className="w-4 h-4 animate-spin" />}
              {loading ? 'Guardando...' : 'Guardar cambios'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
