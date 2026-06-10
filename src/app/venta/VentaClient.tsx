'use client'

import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import {
  Search, Plus, Minus, ShoppingCart, X, CheckCircle2,
  Package, Loader2, AlertTriangle, ChevronRight, Monitor,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import type { Producto, ProductoColor } from '@/lib/types'
import { formatMXN, formatNum, formatStockConCajas } from '@/lib/utils'
import { calcularSemaforo } from '@/lib/types'
import PaymentModal, { type PaymentData } from './PaymentModal'
import TicketPrint, { type TicketItem } from './TicketPrint'

// ── Types ──────────────────────────────────────────────────────
interface CartItem {
  producto:      Producto
  cantidadCajas: number
  cantidadPiezas: number
  colorNombre?:  string | null   // null = sin variante de color
  colorStock?:   number          // stock disponible del color seleccionado
}

function cartKey(item: CartItem): string {
  return `${item.producto.id}-${item.colorNombre ?? ''}`
}

interface VentaExitosa {
  items:   CartItem[]
  total:   number
  hora:    string
  payment: PaymentData
}

// ── Helpers ────────────────────────────────────────────────────
function piezasReales(item: CartItem): number {
  return item.cantidadCajas * (item.producto.piezas_por_caja ?? 0) + item.cantidadPiezas
}

function subtotalItem(item: CartItem): number {
  const p = item.producto
  const piezasTotal = piezasReales(item)
  // Modo caja: si hay cajas Y precio_caja → tarifa por pieza (precio_caja/ppc) para TODAS las piezas
  if (item.cantidadCajas > 0 && p.precio_caja && p.piezas_por_caja) {
    return piezasTotal * (Number(p.precio_caja) / Number(p.piezas_por_caja))
  }
  // Solo piezas sueltas: menudeo o mayoreo
  if (item.cantidadPiezas > 0) {
    const esMayoreo = p.precio_mayoreo && p.umbral_mayoreo && item.cantidadPiezas >= Number(p.umbral_mayoreo)
    return item.cantidadPiezas * (esMayoreo ? Number(p.precio_mayoreo) : Number(p.precio_menudeo))
  }
  return 0
}

function totalCarrito(items: CartItem[]): number {
  return items.reduce((acc, i) => acc + subtotalItem(i), 0)
}

// Usa el stock del color cuando aplica, no el total del producto
function maxCajasItem(item: CartItem): number {
  const stock = item.colorStock ?? item.producto.stock_fisico
  return item.producto.piezas_por_caja ? Math.floor(stock / item.producto.piezas_por_caja) : 0
}

function maxPiezas(item: CartItem): number {
  const stock = item.colorStock ?? item.producto.stock_fisico
  return stock - item.cantidadCajas * (item.producto.piezas_por_caja ?? 0)
}

function ahorroDesglose(item: CartItem): { caja: number; mayoreo: number } {
  const p = item.producto
  const piezasTotal = piezasReales(item)
  // Modo caja: ahorro = lo que costarían a precio menudeo vs. precio caja prorrateado
  if (item.cantidadCajas > 0 && p.precio_caja && p.piezas_por_caja) {
    const caja = Math.max(0,
      piezasTotal * Number(p.precio_menudeo) -
      piezasTotal * (Number(p.precio_caja) / Number(p.piezas_por_caja))
    )
    return { caja, mayoreo: 0 }
  }
  // Solo mayoreo en piezas sueltas
  let mayoreo = 0
  if (p.precio_mayoreo && p.umbral_mayoreo && item.cantidadPiezas >= Number(p.umbral_mayoreo)) {
    mayoreo = item.cantidadPiezas * (Number(p.precio_menudeo) - Number(p.precio_mayoreo))
  }
  return { caja: 0, mayoreo }
}

function ahorroItem(item: CartItem): number {
  const { caja, mayoreo } = ahorroDesglose(item)
  return caja + mayoreo
}

function toTicketItems(items: CartItem[]): TicketItem[] {
  return items.map(item => {
    const { caja, mayoreo } = ahorroDesglose(item)
    return {
      nombre:         item.producto.nombre,
      cantidadCajas:  item.cantidadCajas,
      cantidadPiezas: item.cantidadPiezas,
      unidad:         item.producto.unidad,
      subtotal:       subtotalItem(item),
      colorNombre:    item.colorNombre ?? null,
      ahorro:         caja + mayoreo,
      ahorroCaja:     caja,
      ahorroMayoreo:  mayoreo,
    }
  })
}

// ── Product card ───────────────────────────────────────────────
function ProductoCardPOS({
  producto,
  colores,
  itemsEnCarrito,
  onAgregar,
  onAgregarConColor,
}: {
  producto:         Producto
  colores:          ProductoColor[]
  itemsEnCarrito:   CartItem[]
  onAgregar:        () => void
  onAgregarConColor:(c: ProductoColor) => void
}) {
  const semaforo     = calcularSemaforo(producto.stock_fisico, producto.stock_minimo)
  const sinStock     = producto.stock_fisico <= 0
  const tieneColores = colores.length > 0
  const totalEnCarrito = itemsEnCarrito.reduce((acc, i) => acc + piezasReales(i), 0)
  const enCarrito    = totalEnCarrito > 0

  return (
    <div className={`rounded-xl border overflow-hidden transition-all ${
      sinStock
        ? 'bg-slate-50 border-slate-200 opacity-50'
        : enCarrito
          ? 'bg-violet-50 border-violet-300 shadow-sm'
          : 'bg-white border-slate-200 hover:border-violet-300 hover:shadow-sm'
    }`}>

      {/* Área principal — toca para abrir modal sin color pre-seleccionado */}
      <button
        onClick={onAgregar}
        disabled={sinStock}
        className="w-full text-left p-3 active:scale-[0.98] transition-transform"
      >
        <div className="flex items-start justify-between gap-2 mb-2">
          <p className="text-sm font-semibold text-slate-900 leading-tight line-clamp-2 flex-1">
            {producto.nombre}
          </p>
          {enCarrito && (
            <span className="shrink-0 min-w-[1.5rem] px-1 h-6 rounded-full bg-violet-600 text-white text-xs font-bold flex items-center justify-center">
              {formatNum(totalEnCarrito)}
            </span>
          )}
        </div>

        <div className="flex items-end justify-between gap-1">
          <div>
            <p className="text-base font-bold text-slate-900">
              {formatMXN(Number(producto.precio_menudeo))}
            </p>
            <div className="flex gap-1.5 mt-0.5">
              {producto.precio_mayoreo && (
                <span className="text-xs text-green-600 font-medium">Mayoreo</span>
              )}
              {producto.precio_caja && (
                <span className="text-xs text-amber-600 font-medium">Caja disp.</span>
              )}
            </div>
          </div>
          <div className="flex flex-col items-end gap-1">
            <div className={`text-xs font-medium px-1.5 py-0.5 rounded-full ${
              semaforo === 'rojo' ? 'bg-red-100 text-red-700' :
              semaforo === 'amarillo' ? 'bg-amber-100 text-amber-700' :
              'bg-green-100 text-green-700'
            }`}>
              {formatStockConCajas(producto.stock_fisico, producto.piezas_por_caja, producto.unidad)}
            </div>
            {/* Pzas totales cuando hay conversión y sin colores */}
            {!tieneColores && producto.piezas_por_caja && (
              <span className="text-[10px] text-slate-400">
                {formatNum(producto.stock_fisico)} pzas
              </span>
            )}
          </div>
        </div>
      </button>

      {/* Swatches de color — cada uno abre el modal pre-seleccionado */}
      {tieneColores && (
        <div className="border-t border-slate-100 px-2 py-2 space-y-1">
          {colores.map(c => {
            const itemColor     = itemsEnCarrito.find(i => i.colorNombre === c.nombre)
            const pzsEnCarrito  = itemColor ? piezasReales(itemColor) : 0
            const agotado       = c.stock <= 0
            return (
              <button
                key={c.id}
                onClick={() => { if (!agotado) onAgregarConColor(c) }}
                disabled={agotado}
                className={`w-full flex items-center justify-between px-2 py-1 rounded-lg transition-all text-left ${
                  pzsEnCarrito > 0
                    ? 'bg-violet-100'
                    : agotado
                      ? 'opacity-30 cursor-not-allowed'
                      : 'hover:bg-slate-50 active:bg-slate-100'
                }`}
              >
                <div className="flex items-center gap-1.5">
                  <span
                    className="w-3 h-3 rounded-full border border-black/10 shrink-0"
                    style={{ backgroundColor: c.hex }}
                  />
                  <span className="text-xs text-slate-600 font-medium">{c.nombre}</span>
                </div>
                <div className="flex items-center gap-2">
                  {pzsEnCarrito > 0 && (
                    <span className="text-xs font-bold text-violet-600">
                      ×{formatNum(pzsEnCarrito)}
                    </span>
                  )}
                  <span className="text-[10px] text-slate-400">
                    {agotado
                      ? 'sin stock'
                      : formatStockConCajas(c.stock, producto.piezas_por_caja, producto.unidad)
                    }
                  </span>
                </div>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ── Modal de cantidad — se muestra SIEMPRE al tocar un producto.
//    El usuario elige color (si aplica), cajas y piezas antes de agregar.
function AgregarProductoModal({
  producto,
  colores,
  colorPresel = null,
  onClose,
  onConfirm,
}: {
  producto:     Producto
  colores:      ProductoColor[]
  colorPresel?: ProductoColor | null
  onClose:      () => void
  onConfirm:    (cajas: number, piezas: number, colors: ProductoColor[]) => void
}) {
  const tieneColores = colores.length > 0
  const tieneCaja    = !!producto.piezas_por_caja

  // Multi-select: arranca con el color pre-seleccionado si viene de un swatch
  const [coloresSel, setColoresSel] = useState<Set<string>>(
    colorPresel ? new Set([colorPresel.id]) : new Set()
  )
  const [cajas,  setCajas]  = useState(0)
  const [piezas, setPiezas] = useState(0)

  const selectedColores = colores.filter(c => coloresSel.has(c.id))
  const colorPendiente  = tieneColores && coloresSel.size === 0
  const stockDisp       = selectedColores.length > 0
    ? Math.min(...selectedColores.map(c => c.stock))
    : tieneColores ? 0 : producto.stock_fisico
  const maxCajasN  = tieneCaja && stockDisp > 0 ? Math.floor(stockDisp / producto.piezas_por_caja!) : 0
  const maxPiezasN = Math.max(0, stockDisp - cajas * (producto.piezas_por_caja ?? 0))
  const puedeAceptar = !colorPendiente && (cajas > 0 || piezas > 0)
  const piezasLabel  = tieneCaja && producto.unidad === 'caja' ? 'pza' : producto.unidad

  function handleToggleColor(c: ProductoColor) {
    if (c.stock <= 0) return
    setColoresSel(prev => {
      const n = new Set(prev)
      n.has(c.id) ? n.delete(c.id) : n.add(c.id)
      return n
    })
    setCajas(0)
    setPiezas(0)
  }

  function handleSetCajas(v: number) {
    setCajas(v)
    const newMax = Math.max(0, stockDisp - v * (producto.piezas_por_caja ?? 0))
    if (piezas > newMax) setPiezas(newMax)
  }

  function handleSetPiezas(v: number) {
    const ppc = producto.piezas_por_caja
    if (ppc && v >= ppc) {
      const cajaExtra = Math.floor(v / ppc)
      const newCajas  = cajas + cajaExtra
      const maxCajas  = tieneCaja ? Math.floor(stockDisp / ppc) : 0
      if (newCajas <= maxCajas) {
        setCajas(newCajas)
        setPiezas(v % ppc)
        return
      }
    }
    setPiezas(Math.max(0, Math.min(v, maxPiezasN)))
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/50">
      <div className="w-full max-w-sm bg-white rounded-2xl shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between p-5 pb-4 border-b border-slate-100">
          <div>
            <h2 className="text-base font-semibold text-slate-900">Agregar al carrito</h2>
            <p className="text-xs text-slate-400 mt-0.5 line-clamp-2">{producto.nombre}</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 space-y-5">
          {/* Color selector */}
          {tieneColores && (
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2.5">
                Color
                {coloresSel.size === 0
                  ? <span className="text-red-500 normal-case font-medium ml-1">· elige uno o más</span>
                  : coloresSel.size === 1
                    ? <span className="text-violet-600 normal-case font-medium ml-1">· {selectedColores[0]?.nombre}</span>
                    : <span className="text-violet-600 normal-case font-medium ml-1">· {coloresSel.size} colores</span>
                }
              </p>
              <div className="grid grid-cols-2 gap-2">
                {colores.map(c => {
                  const isSel = coloresSel.has(c.id)
                  return (
                    <button
                      key={c.id}
                      onClick={() => handleToggleColor(c)}
                      disabled={c.stock <= 0}
                      className={`flex items-center gap-3 px-3 py-2.5 rounded-xl border-2 transition-all text-left ${
                        isSel
                          ? 'border-violet-500 bg-violet-50'
                          : c.stock <= 0
                            ? 'border-slate-100 bg-slate-50 opacity-40 cursor-not-allowed'
                            : 'border-slate-200 hover:border-violet-300 active:scale-[0.97]'
                      }`}
                    >
                      <span className="w-5 h-5 rounded-full border border-black/10 shrink-0 relative" style={{ backgroundColor: c.hex }}>
                        {isSel && (
                          <span className="absolute inset-0 flex items-center justify-center">
                            <svg className="w-3 h-3 text-white drop-shadow" fill="none" viewBox="0 0 12 12">
                              <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                            </svg>
                          </span>
                        )}
                      </span>
                      <div>
                        <p className="text-sm font-semibold text-slate-800">{c.nombre}</p>
                        <p className="text-xs text-slate-400">{formatNum(c.stock)} disp.</p>
                      </div>
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          {/* Steppers de cantidad — visibles solo cuando el color ya está resuelto */}
          {!colorPendiente && (
            <div className="space-y-3">
              {tieneCaja && (
                <div className="flex items-center justify-between">
                  <span className="text-sm text-slate-600">Cajas</span>
                  <Stepper value={cajas} max={maxCajasN} onChange={handleSetCajas} color="amber" label="caja" />
                </div>
              )}
              <div className="flex items-center justify-between">
                <span className="text-sm text-slate-600">{tieneCaja ? 'Piezas' : 'Cantidad'}</span>
                <Stepper value={piezas} max={maxPiezasN} onChange={handleSetPiezas} color="slate" label={piezasLabel} />
              </div>
              <div className="flex items-center justify-between">
                {tieneCaja && producto.piezas_por_caja ? (
                  <span className="text-xs text-slate-400 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full">
                    1 caja = {formatNum(producto.piezas_por_caja)} pzas
                  </span>
                ) : <span />}
                <p className="text-xs text-slate-400 text-right">
                  {formatStockConCajas(stockDisp, producto.piezas_por_caja, producto.unidad)} disponibles
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex gap-3 px-5 pb-5">
          <button
            onClick={onClose}
            className="flex-1 h-11 rounded-xl border border-slate-200 text-sm text-slate-600 hover:bg-slate-50 transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={() => onConfirm(cajas, piezas, selectedColores)}
            disabled={!puedeAceptar}
            className="flex-1 h-11 rounded-xl bg-violet-600 hover:bg-violet-700 disabled:bg-slate-200 disabled:text-slate-400 text-white text-sm font-semibold transition-colors"
          >
            {coloresSel.size > 1 ? `Agregar (×${coloresSel.size})` : 'Agregar'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Stepper with editable input ────────────────────────────────
function Stepper({
  value,
  max,
  onChange,
  color,
  label,
}: {
  value: number
  max: number
  onChange: (v: number) => void
  color: 'amber' | 'slate'
  label: string
}) {
  const btnBase = color === 'amber'
    ? 'bg-amber-100 hover:bg-amber-200 text-amber-700'
    : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
  const labelClass = color === 'amber'
    ? 'text-xs text-amber-700 font-medium'
    : 'text-xs text-slate-500'

  return (
    <div className="flex items-center gap-1.5">
      <button
        onClick={() => onChange(Math.max(0, value - 1))}
        className={`w-7 h-7 rounded-lg flex items-center justify-center transition-colors ${btnBase}`}
      >
        <Minus className="w-3 h-3" />
      </button>
      <input
        type="number"
        min="0"
        max={max}
        value={value}
        onChange={e => {
          const v = Math.max(0, Math.min(max, parseInt(e.target.value) || 0))
          onChange(v)
        }}
        className="w-10 h-7 text-sm font-semibold text-slate-900 text-center bg-white border border-slate-200 rounded-lg focus:outline-none focus:border-violet-400 focus:ring-1 focus:ring-violet-300"
      />
      <button
        onClick={() => onChange(Math.min(max, value + 1))}
        disabled={value >= max}
        className={`w-7 h-7 rounded-lg flex items-center justify-center transition-colors disabled:opacity-40 ${btnBase}`}
      >
        <Plus className="w-3 h-3" />
      </button>
      <span className={labelClass}>{label}</span>
    </div>
  )
}

// ── Cart item row ──────────────────────────────────────────────
function CartItemRow({
  item,
  onSetCajas,
  onSetPiezas,
  onEliminar,
}: {
  item: CartItem
  onSetCajas: (id: string, valor: number) => void
  onSetPiezas: (id: string, valor: number) => void
  onEliminar: (id: string) => void
}) {
  const p                = item.producto
  const tieneCaja        = !!p.piezas_por_caja
  const esMayoreoPiezas  = !!(p.precio_mayoreo && p.umbral_mayoreo && item.cantidadPiezas >= p.umbral_mayoreo)
  const esMayoreo        = !tieneCaja && esMayoreoPiezas

  const key = cartKey(item)

  return (
    <li className="py-3">
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-slate-900 leading-tight line-clamp-2">{p.nombre}</p>
          {item.colorNombre && (
            <p className="text-xs text-violet-600 mt-0.5">● {item.colorNombre}</p>
          )}
        </div>
        <button
          onClick={() => onEliminar(key)}
          className="shrink-0 p-1 rounded hover:bg-slate-100 text-slate-400"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      {tieneCaja ? (
        /* ── Product with box pricing: two independent steppers ── */
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <Stepper
              value={item.cantidadCajas}
              max={maxCajasItem(item)}
              onChange={v => onSetCajas(key, v)}
              color="amber"
              label="caja"
            />
            {item.cantidadCajas > 0 && p.precio_caja && (
              <span className="text-xs text-slate-500">
                {formatMXN(item.cantidadCajas * Number(p.precio_caja))}
              </span>
            )}
          </div>

          <div className="flex items-center justify-between">
            <Stepper
              value={item.cantidadPiezas}
              max={maxPiezas(item)}
              onChange={v => onSetPiezas(key, v)}
              color="slate"
              label={p.unidad === 'caja' ? 'pza' : p.unidad}
            />
            {item.cantidadPiezas > 0 && (
              <span className={`text-xs ${esMayoreoPiezas ? 'text-green-600 font-medium' : 'text-slate-500'}`}>
                {formatMXN(item.cantidadPiezas * (esMayoreoPiezas ? Number(p.precio_mayoreo!) : Number(p.precio_menudeo)))}
                {esMayoreoPiezas ? ' · mayoreo' : ''}
              </span>
            )}
          </div>

          <div className="flex items-center justify-between pt-1 border-t border-slate-100">
            <span className="text-xs text-slate-400">Subtotal</span>
            <span className="text-sm font-bold text-slate-900">{formatMXN(subtotalItem(item))}</span>
          </div>
        </div>
      ) : (
        /* ── Product without box pricing: single stepper ── */
        <div className="flex items-center justify-between gap-3">
          <Stepper
            value={item.cantidadPiezas}
            max={item.colorStock ?? p.stock_fisico}
            onChange={v => onSetPiezas(key, v)}
            color="slate"
            label={p.unidad}
          />
          <div className="text-right">
            <p className="text-sm font-bold text-slate-900">{formatMXN(subtotalItem(item))}</p>
            <p className={`text-xs ${esMayoreo ? 'text-green-600' : 'text-slate-400'}`}>
              {formatMXN(esMayoreo ? Number(p.precio_mayoreo) : Number(p.precio_menudeo))} c/{p.unidad}
              {esMayoreo ? ' · mayoreo' : ''}
            </p>
          </div>
        </div>
      )}
    </li>
  )
}

// ── Cart panel ─────────────────────────────────────────────────
function CarritoPanel({
  carrito,
  onSetCajas,
  onSetPiezas,
  onEliminar,
  onConfirmar,
  confirmando,
}: {
  carrito: CartItem[]
  onSetCajas: (id: string, valor: number) => void
  onSetPiezas: (id: string, valor: number) => void
  onEliminar: (id: string) => void
  onConfirmar: () => void
  confirmando: boolean
}) {
  const total = totalCarrito(carrito)

  if (carrito.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full py-16 text-center px-6">
        <ShoppingCart className="w-10 h-10 text-slate-200 mb-3" />
        <p className="text-sm font-medium text-slate-500">Carrito vacío</p>
        <p className="text-xs text-slate-400 mt-1">Toca un producto para agregarlo</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full min-h-0">
      <ul className="flex-1 overflow-y-auto divide-y divide-slate-100 px-4">
        {carrito.map(item => (
          <CartItemRow
            key={cartKey(item)}
            item={item}
            onSetCajas={onSetCajas}
            onSetPiezas={onSetPiezas}
            onEliminar={onEliminar}
          />
        ))}
      </ul>

      <div className="border-t border-slate-200 p-4 bg-white shrink-0">
        <div className="flex items-center justify-between mb-4">
          <span className="text-sm font-medium text-slate-500">Total</span>
          <span className="text-xl font-bold text-slate-900">{formatMXN(total)}</span>
        </div>
        <button
          onClick={onConfirmar}
          disabled={confirmando}
          className="w-full h-12 bg-violet-600 hover:bg-violet-700 disabled:bg-violet-400 text-white text-sm font-bold rounded-xl transition-colors flex items-center justify-center gap-2"
        >
          {confirmando
            ? <><Loader2 className="w-4 h-4 animate-spin" />Registrando venta...</>
            : <><CheckCircle2 className="w-4 h-4" />Confirmar venta</>
          }
        </button>
      </div>
    </div>
  )
}

// ── Main ───────────────────────────────────────────────────────
export default function VentaClient() {
  const [productos,      setProductos]      = useState<Producto[]>([])
  const [coloresMap,     setColoresMap]     = useState<Map<string, ProductoColor[]>>(new Map())
  const [loading,        setLoading]        = useState(true)
  const [search,         setSearch]         = useState('')
  const [catFiltro,      setCatFiltro]      = useState('')
  const [subcatFiltro,   setSubcatFiltro]   = useState('')
  const [carrito,        setCarrito]        = useState<CartItem[]>([])
  const [agregarModalProd,setAgregarModalProd] = useState<Producto | null>(null)
  const [colorPresel,     setColorPresel]      = useState<ProductoColor | null>(null)
  const [showCarrito,    setShowCarrito]    = useState(false)
  const [showCartPanel,  setShowCartPanel]  = useState(true)
  const [showPayment,    setShowPayment]    = useState(false)
  const [confirmando,    setConfirmando]    = useState(false)
  const [ventaExitosa,   setVentaExitosa]   = useState<VentaExitosa | null>(null)
  const [error,          setError]          = useState('')
  const channelRef      = useRef<BroadcastChannel | null>(null)
  // Prevents the cart-empty effect from overwriting the 'complete'
  // screen on the customer display right after a sale is confirmed.
  const saleJustDoneRef = useRef(false)

  // Open/close BroadcastChannel for customer display
  useEffect(() => {
    channelRef.current = new BroadcastChannel('baratera-pos')
    return () => channelRef.current?.close()
  }, [])

  // Sync cart to customer display on every change
  useEffect(() => {
    const ch = channelRef.current
    if (!ch) return
    // Hold the 'complete' screen until the cashier explicitly
    // starts a new sale (saleJustDoneRef is cleared in resetDisplay)
    if (saleJustDoneRef.current) return
    if (carrito.length === 0) {
      ch.postMessage({ screen: 'idle' })
    } else {
      ch.postMessage({
        screen: 'cart',
        items:  toTicketItems(carrito),
        total:  totalCarrito(carrito),
      })
    }
  }, [carrito])

  const fetchProductos = useCallback(async () => {
    const supabase = createClient()
    const [{ data: prods }, { data: cols }] = await Promise.all([
      supabase.from('productos').select('*').eq('activo', true).order('nombre'),
      supabase.from('producto_colores').select('*').order('nombre'),
    ])
    setProductos(prods ?? [])
    const map = new Map<string, ProductoColor[]>()
    for (const c of (cols ?? [])) {
      const arr = map.get(c.producto_id) ?? []
      arr.push(c)
      map.set(c.producto_id, arr)
    }
    setColoresMap(map)
    setLoading(false)
  }, [])

  useEffect(() => { fetchProductos() }, [fetchProductos])

  const categorias = useMemo(() => {
    const cats = new Set(productos.map(p => p.categoria).filter(Boolean) as string[])
    return Array.from(cats).sort()
  }, [productos])

  const subcategorias = useMemo(() => {
    if (!catFiltro) return []
    const subs = new Set(
      productos
        .filter(p => p.categoria === catFiltro && p.subcategoria)
        .map(p => p.subcategoria as string)
    )
    return Array.from(subs).sort()
  }, [productos, catFiltro])

  const productosFiltrados = useMemo(() =>
    productos.filter(p => {
      if (catFiltro && p.categoria !== catFiltro) return false
      if (subcatFiltro && p.subcategoria !== subcatFiltro) return false
      if (!search) return true
      const q = search.toLowerCase()
      return (
        p.nombre.toLowerCase().includes(q) ||
        p.sku?.toLowerCase().includes(q) ||
        p.categoria?.toLowerCase().includes(q)
      )
    }),
  [productos, search, catFiltro, subcatFiltro])

  function itemEnCarrito(productoId: string, colorNombre?: string | null): CartItem | undefined {
    return carrito.find(i =>
      i.producto.id === productoId &&
      (i.colorNombre ?? null) === (colorNombre ?? null)
    )
  }

  function agregarAlCarrito(producto: Producto) {
    if (producto.stock_fisico <= 0) return
    setColorPresel(null)
    setAgregarModalProd(producto)
  }

  // Abre el modal con un color ya pre-seleccionado (tap en swatch de la card)
  function agregarAlCarritoConColor(producto: Producto, color: ProductoColor) {
    if (color.stock <= 0) return
    setColorPresel(color)
    setAgregarModalProd(producto)
  }

  function confirmarAgregarAlCarrito(cajas: number, piezas: number, colors: ProductoColor[]) {
    const producto = agregarModalProd!
    setAgregarModalProd(null)
    setColorPresel(null)
    if (cajas === 0 && piezas === 0) return

    // Genera una entrada por color (o una sin color si no hay colores)
    const entries = colors.length > 0
      ? colors.map(c => ({ colorNombre: c.nombre as string | null, colorStock: c.stock as number | undefined }))
      : [{ colorNombre: null as string | null, colorStock: undefined as number | undefined }]

    setCarrito(prev => {
      let next = [...prev]
      for (const { colorNombre, colorStock } of entries) {
        const key = `${producto.id}-${colorNombre ?? ''}`
        const idx = next.findIndex(i => cartKey(i) === key)

        if (idx >= 0) {
          const existing  = next[idx]
          const stockLim  = colorStock ?? producto.stock_fisico
          const maxC      = producto.piezas_por_caja ? Math.floor(stockLim / producto.piezas_por_caja) : 0
          const newCajas  = Math.min(existing.cantidadCajas + cajas, maxC)
          const cajasPzs  = newCajas * (producto.piezas_por_caja ?? 0)
          const newPiezas = Math.min(existing.cantidadPiezas + piezas, Math.max(0, stockLim - cajasPzs))
          next = next.map((item, i) => i === idx ? { ...item, cantidadCajas: newCajas, cantidadPiezas: newPiezas } : item)
        } else {
          next = [...next, {
            producto,
            cantidadCajas:  cajas,
            cantidadPiezas: piezas,
            colorNombre,
            ...(colorStock !== undefined ? { colorStock } : {}),
          }]
        }
      }
      return next
    })
  }

  function setCantidadCajas(key: string, valor: number) {
    setCarrito(prev =>
      prev
        .map(i => {
          if (cartKey(i) !== key) return i
          const nueva      = Math.max(0, Math.min(valor, maxCajasItem(i)))
          const stockMax   = i.colorStock ?? i.producto.stock_fisico
          const piezasDisp = stockMax - nueva * (i.producto.piezas_por_caja ?? 0)
          const piezas     = Math.min(i.cantidadPiezas, Math.max(0, piezasDisp))
          if (nueva === 0 && piezas === 0) return null
          return { ...i, cantidadCajas: nueva, cantidadPiezas: piezas }
        })
        .filter(Boolean) as CartItem[]
    )
  }

  function setCantidadPiezas(key: string, valor: number) {
    setCarrito(prev =>
      prev.map(i => {
        if (cartKey(i) !== key) return i
        const ppc   = i.producto.piezas_por_caja
        const stock = i.colorStock ?? i.producto.stock_fisico
        let nuevasCajas  = i.cantidadCajas
        let nuevasPiezas = Math.max(0, Math.min(valor, stock - nuevasCajas * (ppc ?? 0)))
        // Auto-caja: si piezas acumuladas alcanzan una caja completa → convertir
        if (ppc && nuevasPiezas >= ppc) {
          const cajaExtra = Math.floor(nuevasPiezas / ppc)
          const maxCajas  = Math.floor(stock / ppc)
          if (nuevasCajas + cajaExtra <= maxCajas) {
            nuevasCajas  += cajaExtra
            nuevasPiezas  = nuevasPiezas % ppc
          }
        }
        if (nuevasCajas === 0 && nuevasPiezas === 0) return null
        return { ...i, cantidadCajas: nuevasCajas, cantidadPiezas: nuevasPiezas }
      }).filter(Boolean) as CartItem[]
    )
  }

  function eliminarDelCarrito(key: string) {
    setCarrito(prev => prev.filter(i => cartKey(i) !== key))
  }

  async function confirmarVenta(payment: PaymentData) {
    if (carrito.length === 0) return
    setConfirmando(true)
    setError('')

    const supabase           = createClient()
    const { data: { user } } = await supabase.auth.getUser()

    // Modo mantenimiento: bloquear ventas (consulta fresca, sin caché)
    const { data: mantRow } = await supabase
      .from('configuracion')
      .select('valor')
      .eq('clave', 'mantenimiento')
      .maybeSingle()
    const mant = mantRow?.valor as { activo?: boolean; mensaje?: string } | null
    if (mant?.activo === true) {
      setError(mant.mensaje || 'Sistema en mantenimiento. Las ventas están pausadas.')
      setConfirmando(false)
      return
    }

    const productoIds = [...new Set(carrito.map(i => i.producto.id))]
    const [{ data: actuales, error: errActuales }, { data: coloresActuales, error: errColores }] = await Promise.all([
      supabase.from('productos').select('id, stock_fisico, nombre').in('id', productoIds),
      supabase.from('producto_colores').select('id, producto_id, nombre, stock').in('producto_id', productoIds),
    ])
    if (errActuales || errColores) {
      setError('Error de conexión al validar stock. Intenta de nuevo.')
      setConfirmando(false)
      return
    }

    // C3: Validar que el total de piezas por producto no excede stock_fisico
    const totalPiezasPorProducto = new Map<string, number>()
    for (const item of carrito) {
      const id = item.producto.id
      totalPiezasPorProducto.set(id, (totalPiezasPorProducto.get(id) ?? 0) + piezasReales(item))
    }
    for (const [productoId, totalPiezas] of totalPiezasPorProducto) {
      const actual = actuales?.find(p => p.id === productoId)
      if (actual && actual.stock_fisico < totalPiezas) {
        setError(`Sin stock suficiente: ${actual.nombre} (necesitas ${totalPiezas} pzas, hay ${actual.stock_fisico})`)
        setConfirmando(false)
        return
      }
    }

    // Stock validation — colores: validar contra producto_colores fresco (no el colorStock stale del carrito)
    for (const item of carrito) {
      const actual = actuales?.find(p => p.id === item.producto.id)
      const piezas = piezasReales(item)

      if (item.colorNombre) {
        // C6: producto padre pudo eliminarse después de armar el carrito
        if (!actual) {
          setError(`Producto no disponible: ${item.producto.nombre}`)
          setConfirmando(false)
          return
        }
        // Producto con variante de color: checa el stock del color específico desde la DB
        const colorActual = coloresActuales?.find(
          c => c.producto_id === item.producto.id && c.nombre === item.colorNombre
        )
        if (!colorActual || colorActual.stock < piezas) {
          setError(`Sin stock del color "${item.colorNombre}" para: ${item.producto.nombre}`)
          setConfirmando(false)
          return
        }
      } else {
        // Producto sin variantes: checa stock_fisico total
        if (!actual || actual.stock_fisico < piezas) {
          setError(`Sin stock suficiente: ${actual?.nombre ?? item.producto.nombre}`)
          setConfirmando(false)
          return
        }
      }
    }

    // Insert venta header
    const { data: ventaData, error: ventaError } = await supabase
      .from('ventas')
      .insert({
        total:               totalCarrito(carrito),
        metodo:              payment.metodo,
        monto_efectivo:      payment.montoEfectivo,
        monto_tarjeta:       payment.montoTarjeta,
        monto_transferencia: payment.montoTransferencia,
        cambio:              payment.cambio,
        cajero_id:      user?.id ?? null,
      })
      .select('id')
      .single()

    if (ventaError || !ventaData) {
      setError('Error al registrar la venta. Intenta de nuevo.')
      setConfirmando(false)
      return
    }

    // Insert venta items
    const ventaItems = carrito.map(item => {
      const piezas   = piezasReales(item)
      const subtotal = subtotalItem(item)
      return {
        venta_id:        ventaData.id,
        producto_id:     item.producto.id,
        cantidad:        piezas > 0 ? piezas : 1,
        precio_unitario: piezas > 0 ? subtotal / piezas : Number(item.producto.precio_menudeo),
        subtotal,
      }
    })
    await supabase.from('venta_items').insert(ventaItems)

    // Write ledger + update stock
    for (const item of carrito) {
      const actual     = actuales!.find(p => p.id === item.producto.id)!
      const piezas     = piezasReales(item)
      const nuevoStock = actual.stock_fisico - piezas

      const parts: string[] = []
      if (item.cantidadCajas  > 0) parts.push(`${item.cantidadCajas} caja(s)`)
      if (item.cantidadPiezas > 0) parts.push(`${item.cantidadPiezas} ${item.producto.unidad}`)

      await supabase.from('stock_ledger').insert({
        producto_id:    item.producto.id,
        tipo:           'salida_venta_manual',
        qty_antes:      actual.stock_fisico,
        qty_despues:    nuevoStock,
        notas:          `[pos] ${parts.join(' + ')} · ${payment.metodo} · ${user?.email ?? 'desconocido'}`,
        canal:          'pos',
        usuario_id:     user?.id ?? null,
        color_variante: item.colorNombre ?? null,
      })

      await supabase.from('productos').update({ stock_fisico: nuevoStock }).eq('id', item.producto.id)
      actual.stock_fisico = nuevoStock  // C2: evitar lectura stale en siguiente iteración del mismo producto

      // Actualizar stock de la variante de color
      if (item.colorNombre) {
        const colorRow = coloresActuales?.find(c => c.producto_id === item.producto.id && c.nombre === item.colorNombre)
        if (colorRow) {
          await supabase
            .from('producto_colores')
            .update({ stock: Math.max(0, colorRow.stock - piezas) })
            .eq('id', colorRow.id)
        }
      }
    }

    const ventaTotal = totalCarrito(carrito)
    const hora       = new Date().toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })

    // Tell display: sale complete
    channelRef.current?.postMessage({
      screen: 'complete',
      items:  toTicketItems(carrito),
      total:  ventaTotal,
      metodo: payment.metodo,
      cambio: payment.cambio,
    })

    // Block the cart effect from sending 'idle' while the
    // customer display shows the 'complete' screen.
    saleJustDoneRef.current = true
    setVentaExitosa({ items: [...carrito], total: ventaTotal, hora, payment })
    setCarrito([])
    setShowPayment(false)
    setConfirmando(false)
    fetchProductos()
  }

  // Called by both "Nueva venta" and "Cerrar" in TicketPrint —
  // releases the display back to idle.
  function resetDisplay() {
    saleJustDoneRef.current = false
    channelRef.current?.postMessage({ screen: 'idle' })
    setVentaExitosa(null)
    setShowCarrito(false)
  }

  const totalProductos = carrito.length
  const total          = totalCarrito(carrito)

  return (
    <>
    <div className="flex flex-col lg:flex-row lg:h-full">

      {/* ── Product area ────────────────────────────────────── */}
      <div className="flex-1 flex flex-col min-h-0">
        <div className="px-4 pt-4 pb-3 border-b border-slate-200">
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Buscar por nombre, SKU o categoría..."
                className="w-full h-11 pl-9 pr-4 rounded-xl border border-slate-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
              />
            </div>
            {/* Toggle carrito desktop */}
            <button
              onClick={() => setShowCartPanel(v => !v)}
              title={showCartPanel ? 'Ocultar carrito' : 'Mostrar carrito'}
              className="hidden lg:flex items-center justify-center w-11 h-11 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-500 hover:text-violet-600 transition-colors shrink-0 relative"
            >
              <ShoppingCart className="w-4 h-4" />
              {carrito.length > 0 && (
                <span className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-violet-600 text-white text-[10px] font-bold flex items-center justify-center">
                  {carrito.length}
                </span>
              )}
            </button>
          </div>
        </div>

        {/* ── Filtros de categoría y subcategoría ── */}
        {categorias.length > 0 && (
          <div className="px-4 pb-2 border-b border-slate-100 space-y-1.5">
            <div className="flex flex-wrap gap-1.5 pt-2">
              <button
                onClick={() => { setCatFiltro(''); setSubcatFiltro('') }}
                className={`h-7 px-3 rounded-full text-xs font-medium transition-colors ${
                  !catFiltro ? 'bg-violet-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                Todos
              </button>
              {categorias.map(cat => (
                <button
                  key={cat}
                  onClick={() => { setCatFiltro(cat === catFiltro ? '' : cat); setSubcatFiltro('') }}
                  className={`h-7 px-3 rounded-full text-xs font-medium transition-colors ${
                    catFiltro === cat ? 'bg-violet-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
            {subcategorias.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {subcategorias.map(sub => (
                  <button
                    key={sub}
                    onClick={() => setSubcatFiltro(sub === subcatFiltro ? '' : sub)}
                    className={`h-6 px-2.5 rounded-full text-xs transition-colors ${
                      subcatFiltro === sub
                        ? 'bg-amber-500 text-white font-medium'
                        : 'bg-amber-50 text-amber-700 border border-amber-200 hover:bg-amber-100'
                    }`}
                  >
                    {sub}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        <div className="flex-1 overflow-y-auto px-4 py-4">
          {loading ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-3">
              {[...Array(8)].map((_, i) => (
                <div key={i} className="h-28 bg-slate-100 rounded-xl animate-pulse" />
              ))}
            </div>
          ) : productosFiltrados.length === 0 ? (
            <div className="text-center py-16">
              <Package className="w-10 h-10 text-slate-300 mx-auto mb-3" />
              <p className="text-sm text-slate-500">
                {productos.length === 0 ? 'Sin productos en inventario' : 'Sin resultados'}
              </p>
            </div>
          ) : (
            <div className={`grid gap-3 pb-24 lg:pb-4 ${showCartPanel ? 'grid-cols-2 sm:grid-cols-3 xl:grid-cols-4' : 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6'}`}>
              {productosFiltrados.map(p => (
                <ProductoCardPOS
                  key={p.id}
                  producto={p}
                  colores={coloresMap.get(p.id) ?? []}
                  itemsEnCarrito={carrito.filter(i => i.producto.id === p.id)}
                  onAgregar={() => agregarAlCarrito(p)}
                  onAgregarConColor={(color) => agregarAlCarritoConColor(p, color)}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── Desktop cart ────────────────────────────────────── */}
      {showCartPanel && <div className="hidden lg:flex flex-col w-80 xl:w-96 shrink-0 border-l border-slate-200 bg-white">
        <div className="flex items-center justify-between h-14 px-4 border-b border-slate-200 shrink-0">
          <div className="flex items-center gap-2">
            <ShoppingCart className="w-4 h-4 text-slate-600" />
            <span className="text-sm font-semibold text-slate-900">Carrito</span>
            {totalProductos > 0 && (
              <span className="w-5 h-5 rounded-full bg-violet-600 text-white text-xs font-bold flex items-center justify-center">
                {totalProductos}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {carrito.length > 0 && (
              <button onClick={() => setCarrito([])} className="text-xs text-slate-400 hover:text-slate-600">
                Limpiar
              </button>
            )}
            <button
              onClick={() => window.open('/venta/display', '_blank')}
              title="Abrir pantalla cliente"
              className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors"
            >
              <Monitor className="w-4 h-4" />
            </button>
          </div>
        </div>

        {error && (
          <div className="mx-4 mt-3 p-3 bg-red-50 border border-red-200 rounded-xl flex items-center gap-2 text-sm text-red-700">
            <AlertTriangle className="w-4 h-4 shrink-0" />{error}
          </div>
        )}

        <CarritoPanel
          carrito={carrito}
          onSetCajas={setCantidadCajas}
          onSetPiezas={setCantidadPiezas}
          onEliminar={eliminarDelCarrito}
          onConfirmar={() => setShowPayment(true)}
          confirmando={confirmando}
        />
      </div>}

      {/* ── Mobile floating button ───────────────────────────── */}
      {totalProductos > 0 && !showCarrito && (
        <button
          onClick={() => setShowCarrito(true)}
          className="lg:hidden fixed bottom-6 left-4 right-4 z-30 h-14 bg-violet-600 text-white rounded-2xl shadow-lg flex items-center justify-between px-5"
        >
          <div className="flex items-center gap-3">
            <div className="relative">
              <ShoppingCart className="w-5 h-5" />
              <span className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-white text-violet-600 text-xs font-bold flex items-center justify-center">
                {totalProductos}
              </span>
            </div>
            <span className="text-sm font-semibold">{totalProductos} producto{totalProductos !== 1 ? 's' : ''}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm font-bold">{formatMXN(total)}</span>
            <ChevronRight className="w-4 h-4" />
          </div>
        </button>
      )}

      {/* ── Mobile bottom sheet ──────────────────────────────── */}
      {showCarrito && (
        <>
          <div className="lg:hidden fixed inset-0 z-40 bg-black/50" onClick={() => setShowCarrito(false)} />
          <div className="lg:hidden fixed bottom-0 left-0 right-0 z-50 bg-white rounded-t-2xl shadow-xl flex flex-col max-h-[85vh]">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 shrink-0">
              <div className="flex items-center gap-2">
                <ShoppingCart className="w-4 h-4 text-slate-700" />
                <span className="text-sm font-semibold text-slate-900">Carrito</span>
                <span className="w-5 h-5 rounded-full bg-violet-600 text-white text-xs font-bold flex items-center justify-center">
                  {totalProductos}
                </span>
              </div>
              <div className="flex items-center gap-3">
                {carrito.length > 0 && (
                  <button onClick={() => setCarrito([])} className="text-xs text-slate-400">Limpiar</button>
                )}
                <button onClick={() => setShowCarrito(false)} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400">
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {error && (
              <div className="mx-4 mt-3 p-3 bg-red-50 border border-red-200 rounded-xl flex items-center gap-2 text-sm text-red-700">
                <AlertTriangle className="w-4 h-4 shrink-0" />{error}
              </div>
            )}

            <CarritoPanel
              carrito={carrito}
              onSetCajas={setCantidadCajas}
              onSetPiezas={setCantidadPiezas}
              onEliminar={eliminarDelCarrito}
              onConfirmar={() => { setShowPayment(true); setShowCarrito(false) }}
              confirmando={confirmando}
            />
          </div>
        </>
      )}
    </div>

    {/* ── Modal de cantidad al agregar ────────────────────── */}
    {agregarModalProd && (
      <AgregarProductoModal
        producto={agregarModalProd}
        colores={coloresMap.get(agregarModalProd.id) ?? []}
        colorPresel={colorPresel}
        onClose={() => { setAgregarModalProd(null); setColorPresel(null) }}
        onConfirm={confirmarAgregarAlCarrito}
      />
    )}

    {/* ── Payment modal ────────────────────────────────────── */}
    {showPayment && (
      <PaymentModal
        total={total}
        confirmando={confirmando}
        onCancel={() => setShowPayment(false)}
        onConfirmar={confirmarVenta}
      />
    )}

    {/* ── Ticket after sale ────────────────────────────────── */}
    {ventaExitosa && (
      <TicketPrint
        items={toTicketItems(ventaExitosa.items)}
        total={ventaExitosa.total}
        payment={ventaExitosa.payment}
        hora={ventaExitosa.hora}
        onClose={resetDisplay}
        onNuevaVenta={resetDisplay}
      />
    )}
    </>
  )
}
