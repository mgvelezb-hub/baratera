'use client'

import { useState, useEffect } from 'react'
import { X, Loader2, Trash2, AlertOctagon, Plus } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import type { Producto, ProductoColor } from '@/lib/types'

// Paleta de colores presets
const COLOR_PALETTE = [
  { nombre: 'Rojo',      hex: '#ef4444' },
  { nombre: 'Naranja',   hex: '#f97316' },
  { nombre: 'Amarillo',  hex: '#eab308' },
  { nombre: 'Verde',     hex: '#22c55e' },
  { nombre: 'Azul',      hex: '#3b82f6' },
  { nombre: 'Morado',    hex: '#a855f7' },
  { nombre: 'Rosa',      hex: '#ec4899' },
  { nombre: 'Negro',     hex: '#1e293b' },
  { nombre: 'Blanco',    hex: '#f8fafc' },
  { nombre: 'Gris',      hex: '#94a3b8' },
  { nombre: 'Café',      hex: '#92400e' },
  { nombre: 'Turquesa',  hex: '#06b6d4' },
]

const UNIDADES   = ['pza', 'caja', 'kg', 'lt', 'paquete', 'rollo', 'resma', 'par', 'juego']
const CATEGORIAS = ['Cuadernos', 'Escritura', 'Corrección', 'Arte y manualidades', 'Oficina', 'Escolar', 'Tecnología', 'Otro']

interface Props {
  producto: Producto
  onClose: () => void
  onSuccess: () => void
}

export default function EditarProductoModal({ producto, onClose, onSuccess }: Props) {
  const [loading,         setLoading]         = useState(false)
  const [error,           setError]           = useState('')
  const [confirmDesact,   setConfirmDesact]   = useState(false)
  const [confirmEliminar, setConfirmEliminar] = useState(false)
  const [dangerLoading,   setDangerLoading]   = useState(false)

  // Colores
  const [colores,         setColores]         = useState<ProductoColor[]>([])
  const [nuevoColorHex,   setNuevoColorHex]   = useState(COLOR_PALETTE[0].hex)
  const [nuevoColorNombre,setNuevoColorNombre]= useState('')
  const [colorLoading,    setColorLoading]    = useState(false)
  const [colorError,      setColorError]      = useState('')

  useEffect(() => {
    createClient()
      .from('producto_colores')
      .select('*')
      .eq('producto_id', producto.id)
      .order('nombre')
      .then(({ data }) => setColores(data ?? []))
  }, [producto.id])

  async function agregarColor() {
    if (!nuevoColorNombre.trim()) { setColorError('Escribe el nombre del color'); return }
    if (colores.some(c => c.nombre.toLowerCase() === nuevoColorNombre.trim().toLowerCase())) {
      setColorError('Ya existe ese color'); return
    }
    setColorLoading(true)
    setColorError('')
    const { data, error: err } = await createClient()
      .from('producto_colores')
      .insert({ producto_id: producto.id, nombre: nuevoColorNombre.trim(), hex: nuevoColorHex, stock: 0 })
      .select()
      .single()
    if (err) { setColorError('Error al agregar color'); setColorLoading(false); return }
    setColores(prev => [...prev, data])
    setNuevoColorNombre('')
    setColorLoading(false)
  }

  async function eliminarColor(color: ProductoColor) {
    if (color.stock > 0) { setColorError(`No puedes eliminar "${color.nombre}" mientras tenga stock (${color.stock})`); return }
    await createClient().from('producto_colores').delete().eq('id', color.id)
    setColores(prev => prev.filter(c => c.id !== color.id))
  }

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

  async function handleDesactivar() {
    setDangerLoading(true)
    await createClient().from('productos').update({ activo: false }).eq('id', producto.id)
    onSuccess()
  }

  async function handleEliminar() {
    setDangerLoading(true)
    const supabase = createClient()
    await supabase.from('stock_ledger').delete().eq('producto_id', producto.id)
    await supabase.from('productos').delete().eq('id', producto.id)
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
            <button type="button" onClick={onClose}
              className="flex-1 h-11 rounded-xl border border-slate-200 text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors">
              Cancelar
            </button>
            <button type="submit" disabled={loading}
              className="flex-1 h-11 bg-violet-600 hover:bg-violet-700 disabled:bg-violet-300 text-white text-sm font-semibold rounded-xl transition-colors flex items-center justify-center gap-2">
              {loading && <Loader2 className="w-4 h-4 animate-spin" />}
              {loading ? 'Guardando...' : 'Guardar cambios'}
            </button>
          </div>

          {/* ── Colores (variantes opcionales) ───────────── */}
          <div className="border-t border-slate-100 pt-5 space-y-3">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Variantes de color</p>
            <p className="text-xs text-slate-400">Activa colores solo si este producto se maneja por tonos distintos (cuadernos, plumas, etc.)</p>

            {/* Colores existentes */}
            {colores.length > 0 && (
              <div className="space-y-1.5">
                {colores.map(c => (
                  <div key={c.id} className="flex items-center justify-between px-3 py-2 bg-slate-50 rounded-lg">
                    <div className="flex items-center gap-2">
                      <span className="w-4 h-4 rounded-full border border-black/10 shrink-0" style={{ backgroundColor: c.hex }} />
                      <span className="text-sm font-medium text-slate-700">{c.nombre}</span>
                      <span className="text-xs text-slate-400">{c.stock} en stock</span>
                    </div>
                    <button type="button" onClick={() => eliminarColor(c)}
                      className="p-1 text-slate-300 hover:text-red-400 transition-colors">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Agregar color */}
            <div className="space-y-2">
              <div className="flex flex-wrap gap-1.5">
                {COLOR_PALETTE.map(p => (
                  <button
                    key={p.hex}
                    type="button"
                    onClick={() => { setNuevoColorHex(p.hex); setNuevoColorNombre(p.nombre) }}
                    className={`w-7 h-7 rounded-full border-2 transition-all ${nuevoColorHex === p.hex ? 'border-violet-500 scale-110' : 'border-white shadow'}`}
                    style={{ backgroundColor: p.hex }}
                    title={p.nombre}
                  />
                ))}
              </div>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={nuevoColorNombre}
                  onChange={e => { setNuevoColorNombre(e.target.value); setColorError('') }}
                  placeholder="Nombre del color"
                  className="flex-1 h-9 px-3 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
                />
                <button type="button" onClick={agregarColor} disabled={colorLoading}
                  className="h-9 px-3 bg-violet-600 hover:bg-violet-700 disabled:bg-violet-300 text-white text-sm font-semibold rounded-lg flex items-center gap-1 transition-colors">
                  <Plus className="w-3.5 h-3.5" />
                  Agregar
                </button>
              </div>
              {colorError && <p className="text-xs text-red-500">{colorError}</p>}
            </div>
          </div>

          {/* ── Danger zone ───────────────────────────────── */}
          <div className="border-t border-red-100 pt-5 space-y-3">
            <p className="text-xs font-semibold text-red-400 uppercase tracking-wide">Zona de riesgo</p>

            {/* Desactivar */}
            {!confirmDesact && !confirmEliminar && (
              <button
                type="button"
                onClick={() => setConfirmDesact(true)}
                className="w-full h-10 border border-red-200 text-red-600 hover:bg-red-50 text-sm font-semibold rounded-xl flex items-center justify-center gap-2 transition-colors"
              >
                <Trash2 className="w-4 h-4" />
                Desactivar producto
              </button>
            )}
            {confirmDesact && (
              <div className="bg-red-50 border border-red-200 rounded-xl p-4">
                <p className="text-sm font-semibold text-red-800 mb-1">¿Desactivar este producto?</p>
                <p className="text-xs text-red-600 mb-3">
                  Dejará de aparecer en el inventario. El historial se conserva.
                </p>
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={handleDesactivar}
                    disabled={dangerLoading}
                    className="flex-1 h-10 bg-red-600 hover:bg-red-700 disabled:bg-red-400 text-white text-sm font-semibold rounded-xl transition-colors"
                  >
                    {dangerLoading ? 'Desactivando...' : 'Sí, desactivar'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmDesact(false)}
                    className="flex-1 h-10 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 text-sm font-semibold rounded-xl transition-colors"
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            )}

            {/* Eliminar permanentemente */}
            {!confirmDesact && !confirmEliminar && (
              <button
                type="button"
                onClick={() => setConfirmEliminar(true)}
                className="w-full h-10 border border-red-300 bg-red-50 text-red-700 hover:bg-red-100 text-sm font-semibold rounded-xl flex items-center justify-center gap-2 transition-colors"
              >
                <AlertOctagon className="w-4 h-4" />
                Eliminar permanentemente
              </button>
            )}
            {confirmEliminar && (
              <div className="bg-red-50 border-2 border-red-400 rounded-xl p-4">
                <p className="text-sm font-bold text-red-900 mb-1">¿Eliminar permanentemente?</p>
                <p className="text-xs text-red-700 mb-3">
                  Se borrarán el producto y <span className="font-semibold">todo su historial</span>. Esta acción no se puede deshacer.
                </p>
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={handleEliminar}
                    disabled={dangerLoading}
                    className="flex-1 h-10 bg-red-700 hover:bg-red-800 disabled:bg-red-400 text-white text-sm font-semibold rounded-xl transition-colors"
                  >
                    {dangerLoading ? 'Eliminando...' : 'Sí, eliminar todo'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmEliminar(false)}
                    className="flex-1 h-10 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 text-sm font-semibold rounded-xl transition-colors"
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            )}
          </div>
        </form>
      </div>
    </div>
  )
}
