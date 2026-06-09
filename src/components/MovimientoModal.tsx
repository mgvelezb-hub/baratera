'use client'

import { useState, useEffect } from 'react'
import { X, Loader2, Plus, Minus } from 'lucide-react'
import type { Producto, MovimientoTipo, Proveedor, ProductoColor } from '@/lib/types'
import { TIPOS_MOVIMIENTO } from '@/lib/types'
import { createClient } from '@/lib/supabase/client'
import { formatNum, formatStockConCajas } from '@/lib/utils'

interface CantColor { cajas: number; piezas: number }

const COLOR_PALETTE = [
  { nombre: 'Rojo',     hex: '#ef4444' }, { nombre: 'Naranja',  hex: '#f97316' },
  { nombre: 'Amarillo', hex: '#eab308' }, { nombre: 'Verde',    hex: '#22c55e' },
  { nombre: 'Azul',     hex: '#3b82f6' }, { nombre: 'Morado',   hex: '#a855f7' },
  { nombre: 'Rosa',     hex: '#ec4899' }, { nombre: 'Negro',    hex: '#1e293b' },
  { nombre: 'Blanco',   hex: '#f8fafc' }, { nombre: 'Gris',     hex: '#94a3b8' },
  { nombre: 'Café',     hex: '#92400e' }, { nombre: 'Turquesa', hex: '#06b6d4' },
]

interface Props {
  producto:     Producto
  colores?:     ProductoColor[]
  onClose:      () => void
  onSuccess:    () => void
  defaultTipo?: MovimientoTipo
  showCostos?:  boolean   // false → oculta proveedor y precio de compra (rol encargado)
}

const TIPOS_VISIBLES: MovimientoTipo[] = ['entrada_compra', 'ajuste_positivo', 'ajuste_negativo', 'devolucion']

// Stepper compacto para el modal de movimiento
function StepperInline({
  value, onChange, color = 'slate', label,
}: {
  value:    number
  onChange: (v: number) => void
  color?:   'amber' | 'slate'
  label?:   string
}) {
  const btn = color === 'amber'
    ? 'bg-amber-100 hover:bg-amber-200 text-amber-700'
    : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
  return (
    <div className="flex items-center gap-1">
      <button type="button" onClick={() => onChange(Math.max(0, value - 1))}
        className={`w-6 h-6 rounded-md flex items-center justify-center transition-colors ${btn}`}>
        <Minus className="w-3 h-3" />
      </button>
      <input
        type="number" min="0" value={value}
        onChange={e => onChange(Math.max(0, parseInt(e.target.value) || 0))}
        className="w-10 h-6 text-xs font-semibold text-center bg-white border border-slate-200 rounded-md focus:outline-none focus:border-violet-400"
      />
      <button type="button" onClick={() => onChange(value + 1)}
        className={`w-6 h-6 rounded-md flex items-center justify-center transition-colors ${btn}`}>
        <Plus className="w-3 h-3" />
      </button>
      {label && <span className="text-xs text-slate-500 ml-0.5">{label}</span>}
    </div>
  )
}

export default function MovimientoModal({
  producto, colores = [], onClose, onSuccess, defaultTipo = 'entrada_compra', showCostos = true,
}: Props) {
  const [tipo,            setTipo]            = useState<MovimientoTipo>(defaultTipo)
  const [cantidad,        setCantidad]        = useState('')
  const [notas,           setNotas]           = useState('')
  const [loading,         setLoading]         = useState(false)
  const [error,           setError]           = useState('')

  // Proveedor
  const [proveedores,     setProveedores]     = useState<Pick<Proveedor, 'id' | 'nombre'>[]>([])
  const [proveedorId,     setProveedorId]     = useState('')
  const [nuevoProvNombre, setNuevoProvNombre] = useState('')
  const [precioUnitario,  setPrecioUnitario]  = useState('')

  // Single-color (ajustes / modo no-multicolor)
  const [colorSeleccionado, setColorSeleccionado] = useState('')

  // Multi-color entrada
  const [coloresLocales, setColoresLocales] = useState<ProductoColor[]>(colores)
  const [cantColores, setCantColores] = useState<Record<string, CantColor>>(() =>
    Object.fromEntries(colores.map(c => [c.nombre, { cajas: 0, piezas: 0 }]))
  )
  const [bulkCajas,  setBulkCajas]  = useState(0)
  const [bulkPiezas, setBulkPiezas] = useState(0)

  // Agregar nuevo color desde el modal de entrada
  const [showNuevoColor,    setShowNuevoColor]    = useState(false)
  const [nuevoColorNombre,  setNuevoColorNombre]  = useState('')
  const [nuevoColorHex,     setNuevoColorHex]     = useState(COLOR_PALETTE[0].hex)
  const [addColorLoading,   setAddColorLoading]   = useState(false)

  const tieneColores     = coloresLocales.length > 0
  const esEntrada        = tipo === 'entrada_compra'
  const esModoMultiColor = esEntrada && tieneColores
  const ppc              = producto.piezas_por_caja ?? 0
  const tieneCajaEntrada = ppc > 0
  // Cuando la unidad del producto es 'caja', las piezas sueltas se etiquetan 'pza'
  const piezasLabel      = tieneCajaEntrada && producto.unidad === 'caja' ? 'pza' : producto.unidad
  const tipoConfig       = TIPOS_MOVIMIENTO[tipo]
  const cantidadNum      = parseInt(cantidad) || 0

  const totalPiezasMulti = esModoMultiColor
    ? coloresLocales.reduce((acc, c) => {
        const q = cantColores[c.nombre] ?? { cajas: 0, piezas: 0 }
        return acc + q.cajas * ppc + q.piezas
      }, 0)
    : 0

  const nuevoStockTotal = esModoMultiColor
    ? producto.stock_fisico + totalPiezasMulti
    : tipo === 'levantamiento_inventario'
      ? cantidadNum
      : producto.stock_fisico + (tipoConfig.signo * cantidadNum)

  useEffect(() => {
    if (!esEntrada) return
    createClient()
      .from('proveedores').select('id, nombre').eq('activo', true).order('nombre')
      .then(({ data }) => setProveedores(data ?? []))
  }, [esEntrada])

  function setCantColor(nombre: string, field: 'cajas' | 'piezas', val: number) {
    setCantColores(prev => ({
      ...prev,
      [nombre]: { ...(prev[nombre] ?? { cajas: 0, piezas: 0 }), [field]: Math.max(0, val) },
    }))
  }

  function aplicarATodos() {
    if (bulkCajas === 0 && bulkPiezas === 0) return
    setCantColores(Object.fromEntries(coloresLocales.map(c => [c.nombre, { cajas: bulkCajas, piezas: bulkPiezas }])))
  }

  async function handleAgregarNuevoColor() {
    if (!nuevoColorNombre.trim()) return
    if (coloresLocales.some(c => c.nombre.toLowerCase() === nuevoColorNombre.trim().toLowerCase())) return
    setAddColorLoading(true)
    const supabase = createClient()
    const { data, error: err } = await supabase
      .from('producto_colores')
      .insert({ producto_id: producto.id, nombre: nuevoColorNombre.trim(), hex: nuevoColorHex, stock: 0 })
      .select().single()
    if (!err && data) {
      setColoresLocales(prev => [...prev, data])
      setCantColores(prev => ({ ...prev, [data.nombre]: { cajas: 0, piezas: 0 } }))
      setNuevoColorNombre('')
      setShowNuevoColor(false)
    }
    setAddColorLoading(false)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')

    // Validación
    if (esModoMultiColor) {
      if (totalPiezasMulti === 0) {
        setError('Ingresa al menos una cantidad mayor a 0'); setLoading(false); return
      }
    } else {
      if (!cantidadNum || cantidadNum <= 0)    { setError('La cantidad debe ser mayor a 0'); setLoading(false); return }
      if (nuevoStockTotal < 0)                 { setError('No hay suficiente stock'); setLoading(false); return }
      if (tieneColores && !colorSeleccionado)  { setError('Selecciona el color'); setLoading(false); return }
    }
    if (esEntrada && proveedorId === 'nuevo' && !nuevoProvNombre.trim()) {
      setError('Escribe el nombre del nuevo proveedor'); setLoading(false); return
    }

    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()

    // Resolver proveedor
    let finalProveedorId: string | null = null
    if (esEntrada) {
      if (proveedorId === 'nuevo') {
        const { data: newProv } = await supabase.from('proveedores')
          .insert({ nombre: nuevoProvNombre.trim() }).select('id').single()
        finalProveedorId = newProv?.id ?? null
      } else if (proveedorId) {
        finalProveedorId = proveedorId
      }
    }

    // ── MULTI-COLOR ENTRADA ───────────────────────────────────
    if (esModoMultiColor) {
      let stockActual = producto.stock_fisico

      for (const color of coloresLocales) {
        const q = cantColores[color.nombre] ?? { cajas: 0, piezas: 0 }
        const piezasColor = q.cajas * ppc + q.piezas
        if (piezasColor === 0) continue

        const stockDespues = stockActual + piezasColor

        await supabase.from('stock_ledger').insert({
          producto_id:     producto.id,
          tipo:            'entrada_compra',
          qty_antes:       stockActual,
          qty_despues:     stockDespues,
          notas:           notas || null,
          canal:           'manual',
          usuario_id:      user?.id ?? null,
          color_variante:  color.nombre,
          proveedor_id:    finalProveedorId,
          precio_unitario: precioUnitario ? parseFloat(precioUnitario) : null,
        })

        await supabase.from('producto_colores')
          .update({ stock: color.stock + piezasColor })
          .eq('id', color.id)

        stockActual = stockDespues
      }

      await supabase.from('productos').update({ stock_fisico: stockActual }).eq('id', producto.id)
      onSuccess()
      return
    }

    // ── SINGLE (sin colores o ajuste/devolución) ───────────────
    const nuevoStockFinal = tipo === 'levantamiento_inventario'
      ? cantidadNum
      : producto.stock_fisico + (tipoConfig.signo * cantidadNum)

    const { error: ledgerError } = await supabase.from('stock_ledger').insert({
      producto_id:     producto.id,
      tipo,
      qty_antes:       producto.stock_fisico,
      qty_despues:     nuevoStockFinal,
      notas:           notas || null,
      canal:           'manual',
      usuario_id:      user?.id ?? null,
      color_variante:  colorSeleccionado || null,
      proveedor_id:    finalProveedorId,
      precio_unitario: esEntrada && precioUnitario ? parseFloat(precioUnitario) : null,
    })

    if (ledgerError) {
      setError('Error al registrar el movimiento. Intenta de nuevo.')
      setLoading(false)
      return
    }

    const { error: updateError } = await supabase.from('productos')
      .update({ stock_fisico: nuevoStockFinal }).eq('id', producto.id)

    if (updateError) {
      setError('Movimiento guardado pero error al actualizar stock. Recarga la página.')
      setLoading(false)
      return
    }

    if (colorSeleccionado) {
      const colorRow = colores.find(c => c.nombre === colorSeleccionado)
      if (colorRow) {
        // C8: re-consultar stock actual desde DB para evitar calcular sobre prop stale
        const { data: freshColor } = await supabase.from('producto_colores').select('stock').eq('id', colorRow.id).single()
        const stockBase = freshColor?.stock ?? colorRow.stock
        await supabase.from('producto_colores')
          .update({ stock: Math.max(0, stockBase + (tipoConfig.signo * cantidadNum)) })
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
            <h2 className="text-base font-semibold text-slate-900">
              {esModoMultiColor ? 'Entrada de inventario' : 'Registrar movimiento'}
            </h2>
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
                  key={key} type="button"
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

          {/* ── MODO MULTI-COLOR (entrada + colores) ──────────── */}
          {esModoMultiColor ? (
            <div className="space-y-3">

              {/* Bulk */}
              <div className="bg-slate-50 rounded-xl p-3 space-y-2.5">
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
                  Misma cantidad para todos
                </p>
                <div className="flex items-center gap-3 flex-wrap">
                  {tieneCajaEntrada && (
                    <StepperInline value={bulkCajas} onChange={setBulkCajas} color="amber" label="caja" />
                  )}
                  <StepperInline value={bulkPiezas} onChange={setBulkPiezas} color="slate" label={piezasLabel} />
                  <button
                    type="button"
                    onClick={aplicarATodos}
                    disabled={bulkCajas === 0 && bulkPiezas === 0}
                    className="h-7 px-3 rounded-lg text-xs font-semibold bg-violet-600 hover:bg-violet-700 disabled:bg-slate-200 disabled:text-slate-400 text-white transition-colors"
                  >
                    Aplicar a todos
                  </button>
                </div>
              </div>

              {/* Por color */}
              <div className="space-y-2">
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
                  Cantidad por color
                </p>
                {coloresLocales.map(c => {
                  const q           = cantColores[c.nombre] ?? { cajas: 0, piezas: 0 }
                  const piezasColor = q.cajas * ppc + q.piezas
                  return (
                    <div
                      key={c.id}
                      className={`rounded-xl border px-3 py-2.5 transition-colors ${
                        piezasColor > 0 ? 'border-violet-200 bg-violet-50' : 'border-slate-200 bg-white'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2 mb-2">
                        <div className="flex items-center gap-2">
                          <span className="w-3.5 h-3.5 rounded-full border border-black/10 shrink-0"
                            style={{ backgroundColor: c.hex }} />
                          <span className="text-sm font-medium text-slate-800">{c.nombre}</span>
                          <span className="text-xs text-slate-400">
                            stock: {formatStockConCajas(c.stock, ppc || null, producto.unidad)}
                          </span>
                        </div>
                        {piezasColor > 0 && (
                          <span className="text-xs font-semibold text-violet-700">
                            +{formatStockConCajas(piezasColor, ppc || null, producto.unidad)}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-3 flex-wrap">
                        {tieneCajaEntrada && (
                          <StepperInline
                            value={q.cajas}
                            onChange={v => setCantColor(c.nombre, 'cajas', v)}
                            color="amber"
                            label="caja"
                          />
                        )}
                        <StepperInline
                          value={q.piezas}
                          onChange={v => setCantColor(c.nombre, 'piezas', v)}
                          color="slate"
                          label={piezasLabel}
                        />
                      </div>
                    </div>
                  )
                })}

                {/* ── Agregar nuevo color desde la entrada ── */}
                {!showNuevoColor ? (
                  <button
                    type="button"
                    onClick={() => setShowNuevoColor(true)}
                    className="w-full h-8 rounded-xl border border-dashed border-slate-300 text-xs text-slate-500 hover:border-violet-400 hover:text-violet-600 transition-colors flex items-center justify-center gap-1.5"
                  >
                    <Plus className="w-3.5 h-3.5" /> Agregar nuevo color
                  </button>
                ) : (
                  <div className="rounded-xl border border-violet-200 bg-violet-50 p-3 space-y-2">
                    <p className="text-xs font-semibold text-violet-700">Nuevo color</p>
                    <div className="flex flex-wrap gap-1">
                      {COLOR_PALETTE.map(cp => (
                        <button
                          key={cp.hex}
                          type="button"
                          onClick={() => setNuevoColorHex(cp.hex)}
                          className={`w-6 h-6 rounded-full border-2 transition-all ${
                            nuevoColorHex === cp.hex ? 'border-violet-500 scale-110' : 'border-white shadow-sm'
                          }`}
                          style={{ backgroundColor: cp.hex }}
                          title={cp.nombre}
                        />
                      ))}
                    </div>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={nuevoColorNombre}
                        onChange={e => setNuevoColorNombre(e.target.value)}
                        placeholder="Nombre del color"
                        className="flex-1 h-8 px-2 rounded-lg border border-violet-300 bg-white text-sm focus:outline-none focus:ring-1 focus:ring-violet-500"
                      />
                      <button
                        type="button"
                        onClick={handleAgregarNuevoColor}
                        disabled={addColorLoading || !nuevoColorNombre.trim()}
                        className="h-8 px-3 bg-violet-600 hover:bg-violet-700 disabled:bg-violet-300 text-white text-xs font-semibold rounded-lg transition-colors flex items-center gap-1"
                      >
                        {addColorLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Plus className="w-3 h-3" />}
                        Agregar
                      </button>
                      <button
                        type="button"
                        onClick={() => { setShowNuevoColor(false); setNuevoColorNombre('') }}
                        className="h-8 px-2 rounded-lg border border-slate-200 text-xs text-slate-500 hover:bg-slate-50"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>

          ) : (
            <>
              {/* ── MODO SINGLE — Color si aplica ─────────────── */}
              {tieneColores && (
                <div className="space-y-3">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">Color *</label>
                    <div className="flex flex-wrap gap-2">
                      {colores.map(c => (
                        <button
                          key={c.id} type="button"
                          onClick={() => { setColorSeleccionado(c.nombre); setError('') }}
                          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-sm font-medium transition-colors ${
                            colorSeleccionado === c.nombre
                              ? 'border-violet-400 bg-violet-50 text-violet-700'
                              : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                          }`}
                        >
                          <span className="w-3 h-3 rounded-full shrink-0 border border-black/10"
                            style={{ backgroundColor: c.hex }} />
                          {c.nombre}
                          <span className="text-xs text-slate-400 ml-0.5">({c.stock})</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  {colorSeleccionado && (() => {
                    const colorActual = colores.find(c => c.nombre === colorSeleccionado)
                    if (!colorActual) return null
                    return (
                      <div className="rounded-xl border border-violet-200 bg-violet-50 px-4 py-3 space-y-2">
                        <p className="text-xs font-semibold text-violet-700 uppercase tracking-wide flex items-center gap-1.5">
                          <span className="w-3 h-3 rounded-full border border-black/10 shrink-0"
                            style={{ backgroundColor: colorActual.hex }} />
                          {colorActual.nombre}
                        </p>
                        <div className="grid grid-cols-3 gap-2">
                          <div className="bg-white rounded-lg px-3 py-2 border border-violet-100">
                            <p className="text-xs text-slate-400 mb-0.5">Stock actual</p>
                            <p className="text-sm font-bold text-slate-900">{formatNum(colorActual.stock)}</p>
                          </div>
                          <div className="bg-white rounded-lg px-3 py-2 border border-violet-100">
                            <p className="text-xs text-slate-400 mb-0.5">Stock mínimo</p>
                            <p className="text-sm font-bold text-slate-900">{formatNum(producto.stock_minimo)}</p>
                          </div>
                          <div className="bg-white rounded-lg px-3 py-2 border border-violet-100">
                            <p className="text-xs text-slate-400 mb-0.5">Unidad</p>
                            <p className="text-sm font-bold text-slate-900">{producto.unidad}</p>
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
            </>
          )}

          {/* Preview stock */}
          <div className="bg-slate-50 rounded-xl p-3 space-y-1">
            <div className="flex items-center justify-between text-sm">
              <span className="text-slate-500">
                Stock actual: <span className="font-semibold text-slate-900">
                  {formatStockConCajas(producto.stock_fisico, ppc || null, producto.unidad)}
                </span>
              </span>
              <span className="text-slate-500">
                Quedará: <span className={`font-semibold ${nuevoStockTotal < producto.stock_minimo ? 'text-red-600' : 'text-slate-900'}`}>
                  {formatStockConCajas(nuevoStockTotal, ppc || null, producto.unidad)}
                </span>
              </span>
            </div>
            {esModoMultiColor && totalPiezasMulti > 0 && (
              <p className="text-xs text-violet-700 font-semibold text-right">
                +{formatStockConCajas(totalPiezasMulti, ppc || null, producto.unidad)} en total
              </p>
            )}
          </div>

          {/* Datos de compra — solo admin (showCostos). Encargado puede entrar stock sin ver costos */}
          {esEntrada && showCostos && (
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
                  Precio de compra <span className="font-normal text-slate-400">(por {producto.unidad})</span>
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
            <button
              type="submit"
              disabled={loading || (esModoMultiColor ? totalPiezasMulti === 0 : !cantidadNum)}
              className="flex-1 h-11 bg-violet-600 hover:bg-violet-700 disabled:bg-violet-300 text-white text-sm font-semibold rounded-xl flex items-center justify-center gap-2"
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
