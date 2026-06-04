'use client'

import { useState, useEffect } from 'react'
import { X, Loader2, Plus } from 'lucide-react'
import type { Producto, MovimientoTipo, Proveedor, ProductoColor } from '@/lib/types'
import { TIPOS_MOVIMIENTO } from '@/lib/types'
import { createClient } from '@/lib/supabase/client'

interface Props {
  producto:    Producto
  colores?:    ProductoColor[]
  onClose:     () => void
  onSuccess:   () => void
  defaultTipo?: MovimientoTipo
}

const TIPOS_VISIBLES: MovimientoTipo[] = ['entrada_compra', 'ajuste_positivo', 'ajuste_negativo', 'devolucion']

export default function MovimientoModal({ producto, colores = [], onClose, onSuccess, defaultTipo = 'entrada_compra' }: Props) {
  const [tipo,             setTipo]             = useState<MovimientoTipo>(defaultTipo)
  const [cantidad,         setCantidad]         = useState('')
  const [notas,            setNotas]            = useState('')
  const [loading,          setLoading]          = useState(false)
  const [error,            setError]            = useState('')

  // Proveedor (solo para entrada_compra)
  const [proveedores,      setProveedores]      = useState<Pick<Proveedor, 'id' | 'nombre'>[]>([])
  const [proveedorId,      setProveedorId]      = useState<string>('') // '' = ninguno, 'nuevo' = inline
  const [nuevoProvNombre,  setNuevoProvNombre]  = useState('')
  const [precioUnitario,   setPrecioUnitario]   = useState('')

  // Color (solo si el producto tiene variantes)
  const [colorSeleccionado, setColorSeleccionado] = useState<string>('')

  const tieneColores    = colores.length > 0
  const esEntrada       = tipo === 'entrada_compra'
  const tipoConfig      = TIPOS_MOVIMIENTO[tipo]
  const cantidadNum     = parseInt(cantidad) || 0
  const nuevoStockTotal = tipo === 'levantamiento_inventario'
    ? cantidadNum
    : producto.stock_fisico + (tipoConfig.signo * cantidadNum)

  // Fetch proveedores al abrir si es entrada
  useEffect(() => {
    if (!esEntrada) return
    createClient()
      .from('proveedores')
      .select('id, nombre')
      .eq('activo', true)
      .order('nombre')
      .then(({ data }) => setProveedores(data ?? []))
  }, [esEntrada])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!cantidadNum || cantidadNum <= 0) { setError('La cantidad debe ser mayor a 0'); return }
    if (nuevoStockTotal < 0)              { setError('No hay suficiente stock para esta operación'); return }
    if (esEntrada && proveedorId === 'nuevo' && !nuevoProvNombre.trim()) {
      setError('Escribe el nombre del nuevo proveedor'); return
    }
    if (tieneColores && !colorSeleccionado) { setError('Selecciona el color'); return }

    setLoading(true)
    setError('')

    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()

    // Si es nuevo proveedor, crearlo primero
    let finalProveedorId: string | null = null
    if (esEntrada) {
      if (proveedorId === 'nuevo') {
        const { data: newProv } = await supabase
          .from('proveedores')
          .insert({ nombre: nuevoProvNombre.trim() })
          .select('id')
          .single()
        finalProveedorId = newProv?.id ?? null
      } else if (proveedorId) {
        finalProveedorId = proveedorId
      }
    }

    const nuevoStockFinal = tipo === 'levantamiento_inventario'
      ? cantidadNum
      : producto.stock_fisico + (tipoConfig.signo * cantidadNum)

    // Insertar en stock_ledger
    const { error: ledgerError } = await supabase.from('stock_ledger').insert({
      producto_id:    producto.id,
      tipo,
      qty_antes:      producto.stock_fisico,
      qty_despues:    nuevoStockFinal,
      notas:          notas || null,
      canal:          'manual',
      usuario_id:     user?.id ?? null,
      color_variante: colorSeleccionado || null,
      proveedor_id:   finalProveedorId,
      precio_unitario: esEntrada && precioUnitario ? parseFloat(precioUnitario) : null,
    })

    if (ledgerError) {
      setError('Error al registrar el movimiento. Intenta de nuevo.')
      setLoading(false)
      return
    }

    // Actualizar stock_fisico del producto
    const { error: updateError } = await supabase
      .from('productos')
      .update({ stock_fisico: nuevoStockFinal })
      .eq('id', producto.id)

    if (updateError) {
      setError('Movimiento guardado pero error al actualizar stock. Recarga la página.')
      setLoading(false)
      return
    }

    // Actualizar stock de la variante de color si aplica
    if (colorSeleccionado) {
      const colorRow = colores.find(c => c.nombre === colorSeleccionado)
      if (colorRow) {
        const nuevoStockColor = colorRow.stock + (tipoConfig.signo * cantidadNum)
        await supabase
          .from('producto_colores')
          .update({ stock: Math.max(0, nuevoStockColor) })
          .eq('id', colorRow.id)
      }
    }

    onSuccess()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/40">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-start justify-between p-5 pb-4">
          <div>
            <h2 className="text-base font-semibold text-slate-900">Registrar movimiento</h2>
            <p className="text-sm text-slate-500 mt-0.5 line-clamp-1">{producto.nombre}</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400">
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="px-5 pb-5 space-y-4">
          {/* Tipo */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Tipo</label>
            <div className="grid grid-cols-2 gap-2">
              {TIPOS_VISIBLES.map(key => (
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
                  {TIPOS_MOVIMIENTO[key].label}
                </button>
              ))}
            </div>
          </div>

          {/* Color (si aplica) */}
          {tieneColores && (
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Color *</label>
                <div className="flex flex-wrap gap-2">
                  {colores.map(c => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => { setColorSeleccionado(c.nombre); setError('') }}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-sm font-medium transition-colors ${
                        colorSeleccionado === c.nombre
                          ? 'border-violet-400 bg-violet-50 text-violet-700'
                          : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                      }`}
                    >
                      <span
                        className="w-3 h-3 rounded-full shrink-0 border border-black/10"
                        style={{ backgroundColor: c.hex }}
                      />
                      {c.nombre}
                      <span className="text-xs text-slate-400 ml-0.5">({c.stock})</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Detalle del color seleccionado */}
              {colorSeleccionado && (() => {
                const colorActual = colores.find(c => c.nombre === colorSeleccionado)
                if (!colorActual) return null
                return (
                  <div className="rounded-xl border border-violet-200 bg-violet-50 px-4 py-3 space-y-2">
                    <p className="text-xs font-semibold text-violet-700 uppercase tracking-wide flex items-center gap-1.5">
                      <span className="w-3 h-3 rounded-full border border-black/10 shrink-0" style={{ backgroundColor: colorActual.hex }} />
                      {colorActual.nombre}
                    </p>
                    <div className="grid grid-cols-3 gap-2 text-sm">
                      <div className="bg-white rounded-lg px-3 py-2 border border-violet-100">
                        <p className="text-xs text-slate-400 mb-0.5">Stock actual</p>
                        <p className="font-bold text-slate-900">{colorActual.stock}</p>
                      </div>
                      <div className="bg-white rounded-lg px-3 py-2 border border-violet-100">
                        <p className="text-xs text-slate-400 mb-0.5">Stock mínimo</p>
                        <p className="font-bold text-slate-900">{producto.stock_minimo}</p>
                      </div>
                      <div className="bg-white rounded-lg px-3 py-2 border border-violet-100">
                        <p className="text-xs text-slate-400 mb-0.5">Unidad</p>
                        <p className="font-bold text-slate-900">{producto.unidad}</p>
                      </div>
                    </div>
                  </div>
                )
              })()}
            </div>
          )}

          {/* Cantidad */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Cantidad</label>
            <input
              type="number" min="1" value={cantidad}
              onChange={e => { setCantidad(e.target.value); setError('') }}
              required
              className="w-full h-11 px-3 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 text-center text-lg font-semibold"
              placeholder="0"
            />
          </div>

          {/* Preview stock */}
          <div className="bg-slate-50 rounded-xl p-3 flex items-center justify-between text-sm">
            <span className="text-slate-500">
              Stock actual: <span className="font-semibold text-slate-900">{producto.stock_fisico} {producto.unidad}</span>
            </span>
            <span className="text-slate-500">
              Quedará: <span className={`font-semibold ${nuevoStockTotal < producto.stock_minimo ? 'text-red-600' : 'text-slate-900'}`}>
                {nuevoStockTotal} {producto.unidad}
              </span>
            </span>
          </div>

          {/* Proveedor + precio (solo entrada_compra) */}
          {esEntrada && (
            <div className="space-y-3 border-t border-slate-100 pt-3">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Datos de compra</p>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Proveedor</label>
                <select
                  value={proveedorId}
                  onChange={e => { setProveedorId(e.target.value); setError('') }}
                  className="w-full h-11 px-3 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 bg-white"
                >
                  <option value="">— Sin especificar —</option>
                  {proveedores.map(p => (
                    <option key={p.id} value={p.id}>{p.nombre}</option>
                  ))}
                  <option value="nuevo">+ Agregar nuevo proveedor</option>
                </select>
              </div>

              {proveedorId === 'nuevo' && (
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">Nombre del proveedor *</label>
                  <input
                    type="text"
                    value={nuevoProvNombre}
                    onChange={e => setNuevoProvNombre(e.target.value)}
                    placeholder="Ej: Distribuidora Norte"
                    className="w-full h-11 px-3 rounded-lg border border-violet-300 bg-violet-50 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
                  />
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">
                  Precio de compra <span className="font-normal text-slate-400">(por {producto.unidad})</span>
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-slate-400">$</span>
                  <input
                    type="number" min="0" step="0.01"
                    value={precioUnitario}
                    onChange={e => setPrecioUnitario(e.target.value)}
                    placeholder="0.00"
                    className="w-full h-11 pl-7 pr-3 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Notas */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">
              Notas <span className="text-slate-400 font-normal">(opcional)</span>
            </label>
            <input
              type="text" value={notas}
              onChange={e => setNotas(e.target.value)}
              className="w-full h-11 px-3 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
              placeholder="Ej: Factura #123..."
              maxLength={200}
            />
          </div>

          {error && <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>}

          <div className="flex gap-2 pt-1">
            <button type="button" onClick={onClose}
              className="flex-1 h-11 rounded-xl border border-slate-200 text-sm font-medium text-slate-600 hover:bg-slate-50">
              Cancelar
            </button>
            <button type="submit" disabled={loading || !cantidadNum}
              className="flex-1 h-11 bg-violet-600 hover:bg-violet-700 disabled:bg-violet-300 text-white text-sm font-semibold rounded-xl flex items-center justify-center gap-2">
              {loading && <Loader2 className="w-4 h-4 animate-spin" />}
              {loading ? 'Guardando...' : 'Guardar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
