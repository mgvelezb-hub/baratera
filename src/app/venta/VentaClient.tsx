'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import {
  Search, Plus, Minus, ShoppingCart, X, CheckCircle2,
  Package, Loader2, AlertTriangle, ChevronRight,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import type { Producto } from '@/lib/types'
import { formatMXN } from '@/lib/utils'
import { calcularSemaforo } from '@/lib/types'

// ── Types ─────────────────────────────────────────────────────
interface CartItem {
  producto: Producto
  cantidad: number
}

interface VentaExitosa {
  items: CartItem[]
  total: number
  hora: string
}

// ── Price helpers ─────────────────────────────────────────────
function precioUnitario(p: Producto, cantidad: number): number {
  if (p.precio_mayoreo && p.umbral_mayoreo && cantidad >= p.umbral_mayoreo) {
    return Number(p.precio_mayoreo)
  }
  return Number(p.precio_menudeo)
}

function subtotal(item: CartItem): number {
  return precioUnitario(item.producto, item.cantidad) * item.cantidad
}

function totalCarrito(items: CartItem[]): number {
  return items.reduce((acc, i) => acc + subtotal(i), 0)
}

// ── Product card (POS) ────────────────────────────────────────
function ProductoCardPOS({
  producto,
  cantidadEnCarrito,
  onAgregar,
}: {
  producto: Producto
  cantidadEnCarrito: number
  onAgregar: () => void
}) {
  const semaforo  = calcularSemaforo(producto.stock_fisico, producto.stock_minimo)
  const sinStock  = producto.stock_fisico <= 0
  const esMayoreo = cantidadEnCarrito > 0 &&
    producto.precio_mayoreo && producto.umbral_mayoreo &&
    cantidadEnCarrito >= producto.umbral_mayoreo

  return (
    <button
      onClick={onAgregar}
      disabled={sinStock}
      className={`
        w-full text-left p-3 rounded-xl border transition-all
        ${sinStock
          ? 'bg-slate-50 border-slate-200 opacity-50 cursor-not-allowed'
          : cantidadEnCarrito > 0
            ? 'bg-violet-50 border-violet-300 shadow-sm'
            : 'bg-white border-slate-200 hover:border-violet-300 hover:shadow-sm active:scale-[0.98]'
        }
      `}
    >
      <div className="flex items-start justify-between gap-2 mb-2">
        <p className="text-sm font-semibold text-slate-900 leading-tight line-clamp-2 flex-1">
          {producto.nombre}
        </p>
        {cantidadEnCarrito > 0 && (
          <span className="shrink-0 w-6 h-6 rounded-full bg-violet-600 text-white text-xs font-bold flex items-center justify-center">
            {cantidadEnCarrito}
          </span>
        )}
      </div>

      {producto.sku && (
        <p className="text-xs text-slate-400 mb-2">{producto.sku}</p>
      )}

      <div className="flex items-end justify-between gap-1">
        <div>
          <p className={`text-base font-bold ${esMayoreo ? 'text-green-700' : 'text-slate-900'}`}>
            {formatMXN(cantidadEnCarrito > 0
              ? precioUnitario(producto, cantidadEnCarrito)
              : producto.precio_menudeo
            )}
          </p>
          {esMayoreo && (
            <p className="text-xs text-green-600 font-medium">Mayoreo ✓</p>
          )}
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

// ── Cart panel ────────────────────────────────────────────────
function CarritoPanel({
  carrito,
  onCambiarCantidad,
  onEliminar,
  onConfirmar,
  confirmando,
}: {
  carrito: CartItem[]
  onCambiarCantidad: (id: string, delta: number) => void
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
    <div className="flex flex-col h-full">
      <ul className="flex-1 overflow-y-auto divide-y divide-slate-100 px-4">
        {carrito.map(item => {
          const precio     = precioUnitario(item.producto, item.cantidad)
          const esMayoreo  = item.producto.precio_mayoreo && item.producto.umbral_mayoreo &&
            item.cantidad >= item.producto.umbral_mayoreo

          return (
            <li key={item.producto.id} className="py-3">
              <div className="flex items-start justify-between gap-2 mb-2">
                <p className="text-sm font-semibold text-slate-900 leading-tight flex-1 line-clamp-2">
                  {item.producto.nombre}
                </p>
                <button
                  onClick={() => onEliminar(item.producto.id)}
                  className="shrink-0 p-1 rounded hover:bg-slate-100 text-slate-400"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>

              <div className="flex items-center justify-between gap-3">
                {/* Quantity controls */}
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => onCambiarCantidad(item.producto.id, -1)}
                    className="w-8 h-8 rounded-lg bg-slate-100 hover:bg-slate-200 flex items-center justify-center transition-colors"
                  >
                    <Minus className="w-3.5 h-3.5 text-slate-700" />
                  </button>
                  <span className="text-sm font-semibold text-slate-900 w-8 text-center">
                    {item.cantidad}
                  </span>
                  <button
                    onClick={() => onCambiarCantidad(item.producto.id, 1)}
                    disabled={item.cantidad >= item.producto.stock_fisico}
                    className="w-8 h-8 rounded-lg bg-slate-100 hover:bg-slate-200 disabled:opacity-40 flex items-center justify-center transition-colors"
                  >
                    <Plus className="w-3.5 h-3.5 text-slate-700" />
                  </button>
                </div>

                {/* Price */}
                <div className="text-right">
                  <p className="text-sm font-bold text-slate-900">{formatMXN(precio * item.cantidad)}</p>
                  <p className={`text-xs ${esMayoreo ? 'text-green-600' : 'text-slate-400'}`}>
                    {formatMXN(precio)} c/u{esMayoreo ? ' (mayoreo)' : ''}
                  </p>
                </div>
              </div>
            </li>
          )
        })}
      </ul>

      {/* Total + confirm */}
      <div className="border-t border-slate-200 p-4 bg-white">
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
            ? <><Loader2 className="w-4 h-4 animate-spin" /> Registrando venta...</>
            : <><CheckCircle2 className="w-4 h-4" /> Confirmar venta</>
          }
        </button>
      </div>
    </div>
  )
}

// ── Success screen ────────────────────────────────────────────
function VentaExitosaScreen({ venta, onNuevaVenta }: { venta: VentaExitosa; onNuevaVenta: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center h-full py-16 px-8 text-center">
      <div className="w-20 h-20 rounded-full bg-green-100 flex items-center justify-center mb-5">
        <CheckCircle2 className="w-10 h-10 text-green-600" />
      </div>
      <h2 className="text-xl font-bold text-slate-900 mb-1">¡Venta registrada!</h2>
      <p className="text-sm text-slate-500 mb-6">{venta.hora}</p>

      <div className="w-full max-w-xs bg-white border border-slate-200 rounded-2xl divide-y divide-slate-100 mb-6 text-left overflow-hidden">
        {venta.items.map(item => (
          <div key={item.producto.id} className="flex items-center justify-between px-4 py-3">
            <div>
              <p className="text-sm font-medium text-slate-900 line-clamp-1">{item.producto.nombre}</p>
              <p className="text-xs text-slate-400">× {item.cantidad} {item.producto.unidad}</p>
            </div>
            <p className="text-sm font-semibold text-slate-900">
              {formatMXN(subtotal(item))}
            </p>
          </div>
        ))}
        <div className="flex items-center justify-between px-4 py-3 bg-slate-50">
          <span className="text-sm font-semibold text-slate-700">Total</span>
          <span className="text-base font-bold text-slate-900">{formatMXN(venta.total)}</span>
        </div>
      </div>

      <button
        onClick={onNuevaVenta}
        className="h-12 px-8 bg-violet-600 hover:bg-violet-700 text-white text-sm font-bold rounded-xl transition-colors"
      >
        Nueva venta
      </button>
    </div>
  )
}

// ── Main component ────────────────────────────────────────────
export default function VentaClient() {
  const [productos, setProductos]   = useState<Producto[]>([])
  const [loading, setLoading]       = useState(true)
  const [search, setSearch]         = useState('')
  const [carrito, setCarrito]       = useState<CartItem[]>([])
  const [showCarrito, setShowCarrito] = useState(false)
  const [confirmando, setConfirmando] = useState(false)
  const [ventaExitosa, setVentaExitosa] = useState<VentaExitosa | null>(null)
  const [error, setError]           = useState('')

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

  function cantidadEnCarrito(productoId: string): number {
    return carrito.find(i => i.producto.id === productoId)?.cantidad ?? 0
  }

  function agregarAlCarrito(producto: Producto) {
    if (producto.stock_fisico <= 0) return
    setCarrito(prev => {
      const idx = prev.findIndex(i => i.producto.id === producto.id)
      if (idx >= 0) {
        const updated = [...prev]
        if (updated[idx].cantidad >= producto.stock_fisico) return prev
        updated[idx] = { ...updated[idx], cantidad: updated[idx].cantidad + 1 }
        return updated
      }
      return [...prev, { producto, cantidad: 1 }]
    })
  }

  function cambiarCantidad(productoId: string, delta: number) {
    setCarrito(prev =>
      prev
        .map(i => {
          if (i.producto.id !== productoId) return i
          const nueva = i.cantidad + delta
          if (nueva <= 0) return null
          if (nueva > i.producto.stock_fisico) return i
          return { ...i, cantidad: nueva }
        })
        .filter(Boolean) as CartItem[]
    )
  }

  function eliminarDelCarrito(productoId: string) {
    setCarrito(prev => prev.filter(i => i.producto.id !== productoId))
  }

  async function confirmarVenta() {
    if (carrito.length === 0) return
    setConfirmando(true)
    setError('')

    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()

    // Fetch current stock to validate
    const ids = carrito.map(i => i.producto.id)
    const { data: actuales } = await supabase
      .from('productos')
      .select('id, stock_fisico, nombre')
      .in('id', ids)

    // Stock validation
    for (const item of carrito) {
      const actual = actuales?.find(p => p.id === item.producto.id)
      if (!actual || actual.stock_fisico < item.cantidad) {
        setError(`Sin stock suficiente: ${actual?.nombre ?? item.producto.nombre}`)
        setConfirmando(false)
        return
      }
    }

    // Register each sale item
    for (const item of carrito) {
      const actual = actuales!.find(p => p.id === item.producto.id)!
      const nuevoStock = actual.stock_fisico - item.cantidad

      await supabase.from('stock_ledger').insert({
        producto_id: item.producto.id,
        tipo:        'salida_venta_manual',
        qty_antes:   actual.stock_fisico,
        qty_despues: nuevoStock,
        notas:       `[pos] ${user?.email ?? 'desconocido'}`,
        canal:       'pos',
        usuario_id:  user?.id ?? null,
      })

      await supabase
        .from('productos')
        .update({ stock_fisico: nuevoStock })
        .eq('id', item.producto.id)
    }

    const exitosa: VentaExitosa = {
      items: [...carrito],
      total: totalCarrito(carrito),
      hora: new Date().toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' }),
    }

    setCarrito([])
    setConfirmando(false)
    setVentaExitosa(exitosa)
    // Refresh product stock counts
    fetchProductos()
  }

  const totalItems = carrito.reduce((a, i) => a + i.cantidad, 0)
  const total      = totalCarrito(carrito)

  // ── Success screen ─────────────────────────────────────────
  if (ventaExitosa) {
    return (
      <div className="flex-1 lg:h-full">
        <VentaExitosaScreen
          venta={ventaExitosa}
          onNuevaVenta={() => setVentaExitosa(null)}
        />
      </div>
    )
  }

  return (
    <div className="flex flex-col lg:flex-row lg:h-full">

      {/* ── Left: search + product grid ─────────────────────── */}
      <div className="flex-1 flex flex-col min-h-0">
        {/* Search */}
        <div className="px-4 pt-4 pb-3 bg-slate-50 border-b border-slate-200 lg:bg-transparent lg:border-b-0">
          <div className="flex items-center gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Buscar producto por nombre, SKU o categoría..."
                className="w-full h-11 pl-9 pr-4 rounded-xl border border-slate-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
              />
            </div>
          </div>
        </div>

        {/* Product grid */}
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
                  cantidadEnCarrito={cantidadEnCarrito(p.id)}
                  onAgregar={() => agregarAlCarrito(p)}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── Desktop: right cart panel ───────────────────────── */}
      <div className="hidden lg:flex flex-col w-80 xl:w-96 shrink-0 border-l border-slate-200 bg-white">
        <div className="flex items-center justify-between h-14 px-4 border-b border-slate-200">
          <div className="flex items-center gap-2">
            <ShoppingCart className="w-4 h-4 text-slate-600" />
            <span className="text-sm font-semibold text-slate-900">Carrito</span>
            {totalItems > 0 && (
              <span className="w-5 h-5 rounded-full bg-violet-600 text-white text-xs font-bold flex items-center justify-center">
                {totalItems}
              </span>
            )}
          </div>
          {carrito.length > 0 && (
            <button
              onClick={() => setCarrito([])}
              className="text-xs text-slate-400 hover:text-slate-600"
            >
              Limpiar
            </button>
          )}
        </div>

        {error && (
          <div className="mx-4 mt-3 p-3 bg-red-50 border border-red-200 rounded-xl flex items-center gap-2 text-sm text-red-700">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            {error}
          </div>
        )}

        <CarritoPanel
          carrito={carrito}
          onCambiarCantidad={cambiarCantidad}
          onEliminar={eliminarDelCarrito}
          onConfirmar={confirmarVenta}
          confirmando={confirmando}
        />
      </div>

      {/* ── Mobile: floating cart button ────────────────────── */}
      {totalItems > 0 && !showCarrito && (
        <button
          onClick={() => setShowCarrito(true)}
          className="lg:hidden fixed bottom-6 left-4 right-4 z-30 h-14 bg-violet-600 hover:bg-violet-700 text-white rounded-2xl shadow-lg flex items-center justify-between px-5 transition-colors"
        >
          <div className="flex items-center gap-3">
            <div className="relative">
              <ShoppingCart className="w-5 h-5" />
              <span className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-white text-violet-600 text-xs font-bold flex items-center justify-center">
                {totalItems}
              </span>
            </div>
            <span className="text-sm font-semibold">{totalItems} producto{totalItems !== 1 ? 's' : ''}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm font-bold">{formatMXN(total)}</span>
            <ChevronRight className="w-4 h-4" />
          </div>
        </button>
      )}

      {/* ── Mobile: cart bottom sheet ───────────────────────── */}
      {showCarrito && (
        <>
          <div
            className="lg:hidden fixed inset-0 z-40 bg-black/50"
            onClick={() => setShowCarrito(false)}
          />
          <div className="lg:hidden fixed bottom-0 left-0 right-0 z-50 bg-white rounded-t-2xl shadow-xl flex flex-col max-h-[85vh]">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200">
              <div className="flex items-center gap-2">
                <ShoppingCart className="w-4 h-4 text-slate-700" />
                <span className="text-sm font-semibold text-slate-900">Carrito</span>
                <span className="w-5 h-5 rounded-full bg-violet-600 text-white text-xs font-bold flex items-center justify-center">
                  {totalItems}
                </span>
              </div>
              <div className="flex items-center gap-3">
                {carrito.length > 0 && (
                  <button onClick={() => setCarrito([])} className="text-xs text-slate-400">
                    Limpiar
                  </button>
                )}
                <button
                  onClick={() => setShowCarrito(false)}
                  className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {error && (
              <div className="mx-4 mt-3 p-3 bg-red-50 border border-red-200 rounded-xl flex items-center gap-2 text-sm text-red-700">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                {error}
              </div>
            )}

            <CarritoPanel
              carrito={carrito}
              onCambiarCantidad={cambiarCantidad}
              onEliminar={eliminarDelCarrito}
              onConfirmar={async () => { await confirmarVenta(); setShowCarrito(false) }}
              confirmando={confirmando}
            />
          </div>
        </>
      )}
    </div>
  )
}
