'use client'

import { useState, useEffect } from 'react'
import { X, Loader2, Plus, Trash2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useConfig } from '@/lib/hooks/useConfig'
import { CONFIG_DEFAULTS } from '@/lib/config'
import { formatNum, formatStockConCajas, colorStyle } from '@/lib/utils'
import type { Proveedor } from '@/lib/types'

interface ColorDraft { nombre: string; hex: string; stock: number; stock_minimo: number }

const UNIDADES = ['pza', 'caja', 'kg', 'lt', 'paquete', 'rollo', 'resma', 'par', 'juego']

interface Props {
  onClose:     () => void
  showCostos?: boolean   // false → oculta proveedor y precio de compra (rol encargado)
  onSuccess: () => void
}

export default function NuevoProductoModal({ onClose, onSuccess, showCostos = true }: Props) {
  const { config } = useConfig()
  const COLOR_PALETTE = config.inventario.colores.length > 0 ? config.inventario.colores : CONFIG_DEFAULTS.inventario.colores
  const CATEGORIAS = config.inventario.categorias.length > 0 ? config.inventario.categorias : CONFIG_DEFAULTS.inventario.categorias
  const [loading,              setLoading]              = useState(false)
  const [error,                setError]                = useState('')
  const [coloresDraft,         setColoresDraft]         = useState<ColorDraft[]>([])
  const [paletaSeleccion,      setPaletaSeleccion]      = useState<Set<string>>(new Set())
  const [generalStock,         setGeneralStock]         = useState(0)
  const [generalStockMinimo,   setGeneralStockMinimo]   = useState('')
  const [nuevoColorHex,        setNuevoColorHex]        = useState(COLOR_PALETTE[0].hex)
  const [nuevoColorNombre,     setNuevoColorNombre]     = useState('')
  const [colorError,           setColorError]           = useState('')
  const [proveedores,          setProveedores]          = useState<Pick<Proveedor, 'id' | 'nombre'>[]>([])
  const [proveedorId,          setProveedorId]          = useState('')
  const [nuevoProvNombre,      setNuevoProvNombre]      = useState('')
  const [precioUnitario,       setPrecioUnitario]       = useState('')
  const [form, setForm] = useState({
    nombre: '',
    sku: '',
    descripcion: '',
    precio_menudeo: '',
    precio_mayoreo: '',
    umbral_mayoreo: '',
    precio_caja: '',
    piezas_por_caja: '',
    stock_fisico:  '0',
    stock_minimo:  '5',
    unidad:        'pza',
    categoria:     '',
    subcategoria:  '',
  })

  useEffect(() => {
    createClient().from('proveedores').select('id, nombre').eq('activo', true).order('nombre')
      .then(({ data }) => setProveedores(data ?? []))
  }, [])

  function set(field: string, value: string) {
    setForm(f => ({ ...f, [field]: value }))
    setError('')
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.nombre.trim()) { setError('El nombre es requerido'); return }
    if (!form.precio_menudeo || parseFloat(form.precio_menudeo) < 0) { setError('El precio menudeo debe ser mayor a 0'); return }
    if (form.precio_caja && !form.piezas_por_caja) { setError(`Indica cuántas ${form.unidad} tiene cada caja`); return }

    setLoading(true)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()

    // Resolver proveedor
    let finalProveedorId: string | null = null
    if (proveedorId === 'nuevo' && nuevoProvNombre.trim()) {
      const { data: newProv } = await supabase.from('proveedores')
        .insert({ nombre: nuevoProvNombre.trim() }).select('id').single()
      finalProveedorId = newProv?.id ?? null
    } else if (proveedorId) {
      finalProveedorId = proveedorId
    }
    const precioNum = precioUnitario ? parseFloat(precioUnitario) : null

    // Si hay piezas_por_caja, el stock del color se ingresó en esa unidad — convertir a piezas
    const ppc = form.piezas_por_caja ? parseInt(form.piezas_por_caja) : 0
    const stockColores = coloresDraft.reduce((s, c) => s + (ppc > 0 ? c.stock * ppc : c.stock), 0)
    const stockInicial = coloresDraft.length > 0 ? stockColores : (parseInt(form.stock_fisico) || 0)

    const { data: producto, error: insertError } = await supabase
      .from('productos')
      .insert({
        nombre:          form.nombre.trim(),
        sku:             form.sku.trim() || null,
        descripcion:     form.descripcion.trim() || null,
        categoria:       form.categoria || null,
        subcategoria:    form.subcategoria.trim() || null,
        precio_menudeo:  parseFloat(form.precio_menudeo),
        precio_mayoreo:  form.precio_mayoreo  ? parseFloat(form.precio_mayoreo)  : null,
        umbral_mayoreo:  form.umbral_mayoreo  ? parseInt(form.umbral_mayoreo)    : null,
        precio_caja:     form.precio_caja     ? parseFloat(form.precio_caja)     : null,
        piezas_por_caja: form.piezas_por_caja ? parseInt(form.piezas_por_caja)   : null,
        stock_fisico: stockInicial,
        stock_minimo: ((parseInt(form.stock_minimo) || 5)) * (ppc > 0 ? ppc : 1),
        unidad: form.unidad,
      })
      .select()
      .single()

    if (insertError || !producto) {
      setError('Error al guardar. Verifica que el SKU no esté repetido.')
      setLoading(false)
      return
    }

    if (coloresDraft.length > 0) {
      // Insertar cada color; stock_minimo se guarda en UPDATE separado (resiliente a migración pendiente)
      let stockAcum = 0
      for (const c of coloresDraft) {
        const stockPiezas = ppc > 0 ? c.stock * ppc : c.stock
        const { data: colorRow } = await supabase.from('producto_colores')
          .insert({ producto_id: producto.id, nombre: c.nombre, hex: c.hex, stock: stockPiezas })
          .select().single()
        // stock_minimo por color — convertido a piezas igual que stock
        const minPiezas = ppc > 0 ? c.stock_minimo * ppc : c.stock_minimo
        if (colorRow && minPiezas > 0) {
          await supabase.from('producto_colores')
            .update({ stock_minimo: minPiezas }).eq('id', colorRow.id)
        }
        if (stockPiezas > 0) {
          await supabase.from('stock_ledger').insert({
            producto_id:     producto.id,
            tipo:            'levantamiento_inventario',
            qty_antes:       stockAcum,
            qty_despues:     stockAcum + stockPiezas,
            notas:           `Stock inicial — color ${c.nombre}`,
            canal:           'manual',
            usuario_id:      user?.id ?? null,
            color_variante:  c.nombre,
            proveedor_id:    finalProveedorId,
            precio_unitario: precioNum,
          })
          stockAcum += stockPiezas
        }
      }
    } else if (stockInicial > 0) {
      await supabase.from('stock_ledger').insert({
        producto_id:     producto.id,
        tipo:            'levantamiento_inventario',
        qty_antes:       0,
        qty_despues:     stockInicial,
        notas:           'Stock inicial al crear producto',
        canal:           'manual',
        usuario_id:      user?.id ?? null,
        proveedor_id:    finalProveedorId,
        precio_unitario: precioNum,
      })
    }

    onSuccess()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/40 overflow-y-auto">
      <div className="w-full max-w-lg bg-white rounded-2xl shadow-xl my-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-5 pb-4 border-b border-slate-100">
          <h2 className="text-base font-semibold text-slate-900">Nuevo producto</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400">
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4 max-h-[80vh] overflow-y-auto">
          {/* Nombre */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Nombre *</label>
            <input
              type="text"
              value={form.nombre}
              onChange={e => set('nombre', e.target.value)}
              required
              className="w-full h-11 px-3 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
              placeholder="Ej: Cuaderno Profesional 100 hojas"
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
              <div className="flex gap-1.5">
                <select
                  value={CATEGORIAS.includes(form.categoria) ? form.categoria : ''}
                  onChange={e => set('categoria', e.target.value)}
                  className="flex-1 h-11 px-3 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 bg-white"
                >
                  <option value="">Sin categoría</option>
                  {CATEGORIAS.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                  {form.categoria && !CATEGORIAS.includes(form.categoria) && (
                    <option value={form.categoria}>{form.categoria}</option>
                  )}
                </select>
                <input
                  type="text"
                  value={CATEGORIAS.includes(form.categoria) ? '' : form.categoria}
                  onChange={e => set('categoria', e.target.value)}
                  placeholder="Nueva…"
                  className="w-20 h-11 px-2 rounded-lg border border-dashed border-violet-300 text-xs text-slate-600 focus:outline-none focus:ring-2 focus:ring-violet-500 bg-violet-50 placeholder-violet-300"
                />
              </div>
            </div>
          </div>

          {/* Subcategoría */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">
              Subcategoría <span className="font-normal text-slate-400">(ej: 100 hojas, 25 piezas)</span>
            </label>
            <div className="flex gap-1.5">
              <select
                value={(config.inventario.subcategorias ?? []).includes(form.subcategoria) ? form.subcategoria : ''}
                onChange={e => set('subcategoria', e.target.value)}
                className="flex-1 h-11 px-3 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 bg-white"
              >
                <option value="">Sin subcategoría</option>
                {(config.inventario.subcategorias ?? []).map(s => <option key={s} value={s}>{s}</option>)}
                {form.subcategoria && !(config.inventario.subcategorias ?? []).includes(form.subcategoria) && (
                  <option value={form.subcategoria}>{form.subcategoria}</option>
                )}
              </select>
              <input
                type="text"
                value={(config.inventario.subcategorias ?? []).includes(form.subcategoria) ? '' : form.subcategoria}
                onChange={e => set('subcategoria', e.target.value)}
                placeholder="Nueva…"
                className="w-20 h-11 px-2 rounded-lg border border-dashed border-violet-300 text-xs text-slate-600 focus:outline-none focus:ring-2 focus:ring-violet-500 bg-violet-50 placeholder-violet-300"
              />
            </div>
          </div>

          {/* Precios */}
          <div className="grid grid-cols-2 gap-3">
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
          </div>

          {/* Umbral mayoreo */}
          {form.precio_mayoreo && (
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">
                Cantidad mínima para mayoreo <span className="font-normal text-slate-400">({form.unidad})</span>
              </label>
              <input
                type="number"
                min="1"
                value={form.umbral_mayoreo}
                onChange={e => set('umbral_mayoreo', e.target.value)}
                className="w-full h-11 px-3 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
                placeholder="Ej: 12"
              />
              {form.piezas_por_caja && form.umbral_mayoreo && (
                <p className="text-xs text-slate-400 mt-1">
                  ≥ {form.umbral_mayoreo} {form.unidad} sueltas → precio mayoreo (independiente de cajas)
                </p>
              )}
            </div>
          )}

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
                <label className="block text-sm font-medium text-slate-700 mb-1.5">{form.unidad} por caja</label>
                <input
                  type="number"
                  min="1"
                  value={form.piezas_por_caja}
                  onChange={e => set('piezas_por_caja', e.target.value)}
                  className="w-full h-11 px-3 rounded-lg border border-slate-300 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
                  placeholder="Ej: 12"
                />
              </div>
            </div>
          </div>

          {/* Stock + Mínimo + Unidad */}
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Stock actual</label>
              {coloresDraft.length > 0 ? (
                <div className="w-full h-11 px-3 rounded-lg border border-slate-100 bg-slate-50 text-sm flex items-center text-slate-400 gap-1">
                  {coloresDraft.reduce((s, c) => s + c.stock, 0)} {form.piezas_por_caja ? form.unidad : ''}
                  <span className="text-xs">(suma de colores)</span>
                </div>
              ) : (
                <input
                  type="number"
                  min="0"
                  value={form.stock_fisico}
                  onChange={e => set('stock_fisico', e.target.value)}
                  className="w-full h-11 px-3 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
                />
              )}
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
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Unidad</label>
              <select
                value={form.unidad}
                onChange={e => set('unidad', e.target.value)}
                className="w-full h-11 px-3 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 bg-white"
              >
                {UNIDADES.map(u => <option key={u} value={u}>{u}</option>)}
              </select>
            </div>
          </div>

          {/* Colores (opcional) */}
          <div className="border-t border-slate-100 pt-4 space-y-3">
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Variantes de color</p>
              <p className="text-xs text-slate-400 mt-0.5">Opcional — solo si el producto se maneja por colores</p>
            </div>

            {/* Paleta multi-select */}
            <div className="space-y-2">
              <p className="text-xs text-slate-500">Toca para seleccionar uno o varios colores:</p>
              <div className="flex flex-wrap gap-1.5">
                {COLOR_PALETTE.map(cp => {
                  const yaExiste  = coloresDraft.some(c => c.nombre === cp.nombre)
                  const isSel     = paletaSeleccion.has(cp.nombre)
                  return (
                    <button
                      key={cp.hex}
                      type="button"
                      disabled={yaExiste}
                      onClick={() => {
                        setColorError('')
                        setPaletaSeleccion(prev => {
                          const n = new Set(prev)
                          n.has(cp.nombre) ? n.delete(cp.nombre) : n.add(cp.nombre)
                          return n
                        })
                      }}
                      className={`flex items-center gap-1.5 px-2 py-1 rounded-lg border text-xs font-medium transition-all ${
                        yaExiste
                          ? 'opacity-30 cursor-not-allowed border-slate-100 text-slate-400'
                          : isSel
                            ? 'border-violet-500 bg-violet-50 text-violet-700'
                            : 'border-slate-200 hover:border-violet-300 text-slate-600'
                      }`}
                    >
                      <span className="w-3.5 h-3.5 rounded-full border border-black/10 shrink-0" style={colorStyle(cp.nombre, cp.hex)} />
                      {cp.nombre}
                      {isSel && <span className="text-violet-500 font-bold">✓</span>}
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Panel de cantidad al seleccionar */}
            {paletaSeleccion.size > 0 && (
              <div className="rounded-xl border border-violet-200 bg-violet-50 p-3 space-y-2.5">
                <p className="text-xs font-semibold text-violet-700">
                  {paletaSeleccion.size} color{paletaSeleccion.size !== 1 ? 'es' : ''} seleccionado{paletaSeleccion.size !== 1 ? 's' : ''}
                </p>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-xs text-slate-500 block mb-1">
                      Stock inicial para todos
                      {form.piezas_por_caja && <span className="text-slate-400 ml-1">({form.unidad})</span>}
                    </label>
                    <input
                      type="number" min="0"
                      value={generalStock}
                      onChange={e => setGeneralStock(parseInt(e.target.value) || 0)}
                      className="w-full h-8 px-2 rounded-lg border border-violet-300 bg-white text-sm text-center focus:outline-none focus:ring-1 focus:ring-violet-500"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-slate-500 block mb-1">Stock mínimo para todos</label>
                    <input
                      type="number" min="0"
                      value={generalStockMinimo}
                      onChange={e => setGeneralStockMinimo(e.target.value)}
                      placeholder={form.stock_minimo || '5'}
                      className="w-full h-8 px-2 rounded-lg border border-violet-300 bg-white text-sm text-center focus:outline-none focus:ring-1 focus:ring-violet-500"
                    />
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    const stockMin = parseInt(generalStockMinimo) || parseInt(form.stock_minimo) || 5
                    const toAdd = Array.from(paletaSeleccion).map(nombre => {
                      const info = COLOR_PALETTE.find(p => p.nombre === nombre)!
                      return { nombre, hex: info.hex, stock: generalStock, stock_minimo: stockMin }
                    })
                    setColoresDraft(prev => [...prev, ...toAdd])
                    setPaletaSeleccion(new Set())
                    setGeneralStock(0)
                    setGeneralStockMinimo('')
                    setColorError('')
                  }}
                  className="w-full h-8 bg-violet-600 hover:bg-violet-700 text-white text-xs font-semibold rounded-lg transition-colors"
                >
                  Agregar {paletaSeleccion.size} color{paletaSeleccion.size !== 1 ? 'es' : ''}
                </button>
              </div>
            )}

            {/* Colores añadidos */}
            {coloresDraft.length > 0 && (
              <div className="space-y-2">
                {coloresDraft.map((c, i) => {
                  const ppc         = form.piezas_por_caja ? parseInt(form.piezas_por_caja) : 0
                  const unidadLabel = form.unidad
                  const piezasTotal = ppc > 0 ? c.stock * ppc : c.stock
                  return (
                    <div key={i} className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                      <div className="flex items-center justify-between mb-2.5">
                        <div className="flex items-center gap-2">
                          <span className="w-4 h-4 rounded-full border border-black/10 shrink-0" style={colorStyle(c.nombre, c.hex)} />
                          <span className="text-sm font-semibold text-slate-700">{c.nombre}</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => setColoresDraft(prev => prev.filter((_, j) => j !== i))}
                          className="p-1 text-slate-300 hover:text-red-400 transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="text-xs text-slate-400 block mb-1">
                            Stock inicial <span className="text-slate-300">({unidadLabel})</span>
                          </label>
                          <input
                            type="number" min="0"
                            value={c.stock}
                            onChange={e => setColoresDraft(prev => prev.map((x, j) =>
                              j === i ? { ...x, stock: parseInt(e.target.value) || 0 } : x
                            ))}
                            className="w-full h-8 px-2 rounded-lg border border-slate-300 bg-white text-sm text-center focus:outline-none focus:ring-1 focus:ring-violet-500"
                          />
                          {ppc > 0 && c.stock > 0 && (
                            <p className="text-[10px] text-slate-400 mt-0.5 text-right">
                              = {formatNum(piezasTotal)} {form.unidad}
                            </p>
                          )}
                        </div>
                        <div>
                          <label className="text-xs text-slate-400 block mb-1">Stock mínimo</label>
                          <input
                            type="number" min="0"
                            value={c.stock_minimo}
                            onChange={e => setColoresDraft(prev => prev.map((x, j) =>
                              j === i ? { ...x, stock_minimo: parseInt(e.target.value) || 0 } : x
                            ))}
                            className="w-full h-8 px-2 rounded-lg border border-slate-300 bg-white text-sm text-center focus:outline-none focus:ring-1 focus:ring-violet-500"
                          />
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}

            {/* Color personalizado */}
            <div className="space-y-2">
              <p className="text-xs text-slate-400">O agrega un color personalizado:</p>
              <div className="flex flex-wrap gap-1.5">
                {COLOR_PALETTE.map(cp => (
                  <button
                    key={cp.hex}
                    type="button"
                    onClick={() => { setNuevoColorHex(cp.hex); setNuevoColorNombre(cp.nombre); setColorError('') }}
                    className={`w-7 h-7 rounded-full border-2 transition-all ${nuevoColorHex === cp.hex ? 'border-violet-500 scale-110' : 'border-white shadow'}`}
                    style={colorStyle(cp.nombre, cp.hex)}
                    title={cp.nombre}
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
                <button
                  type="button"
                  onClick={() => {
                    if (!nuevoColorNombre.trim()) { setColorError('Escribe el nombre'); return }
                    if (coloresDraft.some(c => c.nombre.toLowerCase() === nuevoColorNombre.trim().toLowerCase())) {
                      setColorError('Ya existe ese color'); return
                    }
                    const stockMin = parseInt(form.stock_minimo) || 5
                    setColoresDraft(prev => [...prev, { nombre: nuevoColorNombre.trim(), hex: nuevoColorHex, stock: 0, stock_minimo: stockMin }])
                    setNuevoColorNombre('')
                    setColorError('')
                  }}
                  className="h-9 px-3 bg-violet-600 hover:bg-violet-700 text-white text-sm font-semibold rounded-lg flex items-center gap-1 transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Agregar
                </button>
              </div>
              {colorError && <p className="text-xs text-red-500">{colorError}</p>}
            </div>
          </div>

          {/* ── Datos de compra (opcional) — solo admin ────── */}
          {showCostos && <div className="border-t border-slate-100 pt-4 space-y-3">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
              Datos de compra <span className="normal-case font-normal text-slate-400">(opcional)</span>
            </p>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Proveedor</label>
              <select
                value={proveedorId}
                onChange={e => setProveedorId(e.target.value)}
                className="w-full h-11 px-3 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 bg-white"
              >
                <option value="">— Sin especificar —</option>
                {proveedores.map(p => <option key={p.id} value={p.id}>{p.nombre}</option>)}
                <option value="nuevo">+ Agregar nuevo proveedor</option>
              </select>
            </div>
            {proveedorId === 'nuevo' && (
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Nombre del proveedor *</label>
                <input
                  type="text" value={nuevoProvNombre}
                  onChange={e => setNuevoProvNombre(e.target.value)}
                  placeholder="Ej: Distribuidora Norte"
                  className="w-full h-11 px-3 rounded-lg border border-violet-300 bg-violet-50 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
                />
              </div>
            )}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">
                Precio de compra <span className="font-normal text-slate-400">(por {form.unidad || 'unidad'})</span>
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-slate-400">$</span>
                <input
                  type="number" min="0" step="0.01" value={precioUnitario}
                  onChange={e => setPrecioUnitario(e.target.value)}
                  placeholder="0.00"
                  className="w-full h-11 pl-7 pr-3 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
                />
              </div>
            </div>
          </div>}

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
              {loading ? 'Guardando...' : 'Agregar producto'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
