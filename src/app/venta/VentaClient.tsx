'use client'

import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import {
  Search, Plus, Minus, ShoppingCart, X, CheckCircle2,
  Package, Loader2, AlertTriangle, ChevronRight, Monitor,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import type { Producto } from '@/lib/types'
import { formatMXN } from '@/lib/utils'
import { calcularSemaforo } from '@/lib/types'
import PaymentModal, { type PaymentData } from './PaymentModal'
import TicketPrint, { type TicketItem } from './TicketPrint'

// ── Types ──────────────────────────────────────────────────────
interface CartItem {
  producto: Producto
  cantidadCajas: number
  cantidadPiezas: number
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
  let total = 0
  const p = item.producto

  if (item.cantidadCajas > 0 && p.precio_caja) {
    total += item.cantidadCajas * Number(p.precio_caja)
  }
  if (item.cantidadPiezas > 0) {
    const esMayoreo = item.cantidadCajas === 0 &&
      p.precio_mayoreo && p.umbral_mayoreo &&
      item.cantidadPiezas >= p.umbral_mayoreo
    total += item.cantidadPiezas * (esMayoreo ? Number(p.precio_mayoreo) : Number(p.precio_menudeo))
  }
  return total
}

function totalCarrito(items: CartItem[]): number {
  return items.reduce((acc, i) => acc + subtotalItem(i), 0)
}

function maxCajas(p: Producto): number {
  return p.piezas_por_caja ? Math.floor(p.stock_fisico / p.piezas_por_caja) : 0
}

function maxPiezas(item: CartItem): number {
  return item.producto.stock_fisico - item.cantidadCajas * (item.producto.piezas_por_caja ?? 0)
}

function toTicketItems(items: CartItem[]): TicketItem[] {
  return items.map(item => ({
    nombre:         item.producto.nombre,
    cantidadCajas:  item.cantidadCajas,
    cantidadPiezas: item.cantidadPiezas,
    unidad:         item.producto.unidad,
    subtotal:       subtotalItem(item),
  }))
}

// ── Product card ───────────────────────────────────────────────
function ProductoCardPOS({
  producto,
  itemEnCarrito,
  onAgregar,
}: {
  producto: Producto
  itemEnCarrito: CartItem | undefined
  onAgregar: () => void
}) {
  const semaforo  = calcularSemaforo(producto.stock_fisico, producto.stock_minimo)
  const sinStock  = producto.stock_fisico <= 0
  const enCarrito = itemEnCarrito ? piezasReales(itemEnCarrito) > 0 : false
  const tieneCaja = !!(producto.precio_caja && producto.piezas_por_caja)
  const totalPzs  = itemEnCarrito ? piezasReales(itemEnCarrito) : 0

  return (
    <button
      onClick={onAgregar}
      disabled={sinStock}
      className={`
        w-full text-left p-3 rounded-xl border transition-all
        ${sinStock
          ? 'bg-slate-50 border-slate-200 opacity-50 cursor-not-allowed'
          : enCarrito
            ? 'bg-violet-50 border-violet-300 shadow-sm'
            : 'bg-white border-slate-200 hover:border-violet-300 hover:shadow-sm active:scale-[0.98]'
        }
      `}
    >
      <div className="flex items-start justify-between gap-2 mb-2">
        <p className="text-sm font-semibold text-slate-900 leading-tight line-clamp-2 flex-1">
          {producto.nombre}
        </p>
        {enCarrito && (
          <span className="shrink-0 w-6 h-6 rounded-full bg-violet-600 text-white text-xs font-bold flex items-center justify-center">
            {totalPzs}
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
              <span className="text-xs text-green-600 font-medium">Mayoreo disp.</span>
            )}
            {tieneCaja && (
              <span className="text-xs text-amber-600 font-medium">Caja disp.</span>
            )}
          </div>
        </div>
        <div className={`text-xs font-medium px-1.5 py-0.5 rounded-full ${
          semaforo === 'rojo' ? 'bg-red-100 text-red-700' :
          semaforo === 'amarillo' ? 'bg-amber-100 text-amber-700' :
          'bg-green-100 text-green-700'
        }`}>
          {producto.stock_fisico} {producto.unidad}
        </div>
      </div>
    </button>
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
  const p         = item.producto
  const tieneCaja = !!(p.precio_caja && p.piezas_por_caja)
  const esMayoreo = !tieneCaja &&
    p.precio_mayoreo && p.umbral_mayoreo &&
    item.cantidadPiezas >= p.umbral_mayoreo

  return (
    <li className="py-3">
      <div className="flex items-start justify-between gap-2 mb-2">
        <p className="text-sm font-semibold text-slate-900 leading-tight flex-1 line-clamp-2">
          {p.nombre}
        </p>
        <button
          onClick={() => onEliminar(p.id)}
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
              max={maxCajas(p)}
              onChange={v => onSetCajas(p.id, v)}
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
              onChange={v => onSetPiezas(p.id, v)}
              color="slate"
              label="pza"
            />
            {item.cantidadPiezas > 0 && (
              <span className="text-xs text-slate-500">
                {formatMXN(item.cantidadPiezas * Number(p.precio_menudeo))}
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
            max={p.stock_fisico}
            onChange={v => onSetPiezas(p.id, v)}
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
            key={item.producto.id}
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
  const [productos,    setProductos]    = useState<Producto[]>([])
  const [loading,      setLoading]      = useState(true)
  const [search,       setSearch]       = useState('')
  const [carrito,      setCarrito]      = useState<CartItem[]>([])
  const [showCarrito,  setShowCarrito]  = useState(false)
  const [showPayment,  setShowPayment]  = useState(false)
  const [confirmando,  setConfirmando]  = useState(false)
  const [ventaExitosa, setVentaExitosa] = useState<VentaExitosa | null>(null)
  const [error,        setError]        = useState('')
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
    const { data } = await createClient()
      .from('productos')
      .select('*')
      .eq('activo', true)
      .order('nombre')
    setProductos(data ?? [])
    setLoading(false)
  }, [])

  useEffect(() => { fetchProductos() }, [fetchProductos])

  const productosFiltrados = useMemo(() =>
    productos.filter(p => {
      if (!search) return true
      const q = search.toLowerCase()
      return (
        p.nombre.toLowerCase().includes(q) ||
        p.sku?.toLowerCase().includes(q) ||
        p.categoria?.toLowerCase().includes(q)
      )
    }),
  [productos, search])

  function itemEnCarrito(productoId: string): CartItem | undefined {
    return carrito.find(i => i.producto.id === productoId)
  }

  function agregarAlCarrito(producto: Producto) {
    if (producto.stock_fisico <= 0) return
    setCarrito(prev => {
      const idx = prev.findIndex(i => i.producto.id === producto.id)
      if (idx >= 0) {
        const item = prev[idx]
        if (item.cantidadPiezas >= maxPiezas(item)) return prev
        const updated = [...prev]
        updated[idx] = { ...item, cantidadPiezas: item.cantidadPiezas + 1 }
        return updated
      }
      return [...prev, { producto, cantidadCajas: 0, cantidadPiezas: 1 }]
    })
  }

  function setCantidadCajas(productoId: string, valor: number) {
    setCarrito(prev =>
      prev
        .map(i => {
          if (i.producto.id !== productoId) return i
          const nueva = Math.max(0, Math.min(valor, maxCajas(i.producto)))
          const piezasDisp = i.producto.stock_fisico - nueva * (i.producto.piezas_por_caja ?? 0)
          const piezas = Math.min(i.cantidadPiezas, Math.max(0, piezasDisp))
          if (nueva === 0 && piezas === 0) return null
          return { ...i, cantidadCajas: nueva, cantidadPiezas: piezas }
        })
        .filter(Boolean) as CartItem[]
    )
  }

  function setCantidadPiezas(productoId: string, valor: number) {
    setCarrito(prev =>
      prev
        .map(i => {
          if (i.producto.id !== productoId) return i
          const nueva = Math.max(0, Math.min(valor, maxPiezas(i)))
          if (nueva === 0 && i.cantidadCajas === 0) return null
          return { ...i, cantidadPiezas: nueva }
        })
        .filter(Boolean) as CartItem[]
    )
  }

  function eliminarDelCarrito(productoId: string) {
    setCarrito(prev => prev.filter(i => i.producto.id !== productoId))
  }

  async function confirmarVenta(payment: PaymentData) {
    if (carrito.length === 0) return
    setConfirmando(true)
    setError('')

    const supabase           = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    const { data: actuales } = await supabase
      .from('productos')
      .select('id, stock_fisico, nombre')
      .in('id', carrito.map(i => i.producto.id))

    // Stock validation
    for (const item of carrito) {
      const actual = actuales?.find(p => p.id === item.producto.id)
      const piezas = piezasReales(item)
      if (!actual || actual.stock_fisico < piezas) {
        setError(`Sin stock suficiente: ${actual?.nombre ?? item.producto.nombre}`)
        setConfirmando(false)
        return
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
        producto_id: item.producto.id,
        tipo:        'salida_venta_manual',
        qty_antes:   actual.stock_fisico,
        qty_despues: nuevoStock,
        notas:       `[pos] ${parts.join(' + ')} · ${payment.metodo} · ${user?.email ?? 'desconocido'}`,
        canal:       'pos',
        usuario_id:  user?.id ?? null,
      })

      await supabase.from('productos').update({ stock_fisico: nuevoStock }).eq('id', item.producto.id)
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
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Buscar por nombre, SKU o categoría..."
              className="w-full h-11 pl-9 pr-4 rounded-xl border border-slate-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
            />
          </div>
        </div>

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
            <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-3 pb-24 lg:pb-4">
              {productosFiltrados.map(p => (
                <ProductoCardPOS
                  key={p.id}
                  producto={p}
                  itemEnCarrito={itemEnCarrito(p.id)}
                  onAgregar={() => agregarAlCarrito(p)}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── Desktop cart ────────────────────────────────────── */}
      <div className="hidden lg:flex flex-col w-80 xl:w-96 shrink-0 border-l border-slate-200 bg-white">
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
      </div>

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
