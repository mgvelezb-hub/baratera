export type StockSemaforo = 'verde' | 'amarillo' | 'rojo'

export interface Producto {
  id: string
  nombre: string
  descripcion: string | null
  sku: string | null
  precio_menudeo: number
  precio_mayoreo: number | null
  umbral_mayoreo: number | null
  precio_caja: number | null
  piezas_por_caja: number | null
  stock_fisico: number
  stock_minimo: number
  unidad: string
  categoria:    string | null
  subcategoria: string | null
  activo: boolean
  created_at: string
  updated_at: string
}

export interface StockLedgerEntry {
  id: string
  producto_id: string
  tipo: MovimientoTipo
  qty_antes: number
  qty_despues: number
  diferencia: number
  notas: string | null
  canal: string | null
  usuario_id: string | null
  created_at: string
  productos?: { nombre: string; unidad: string }
}

export type MovimientoTipo =
  | 'levantamiento_inventario'
  | 'entrada_compra'
  | 'salida_venta_manual'
  | 'ajuste_positivo'
  | 'ajuste_negativo'
  | 'devolucion'

// Factor del umbral amarillo — configurable desde /configuraciones
// (clave inventario.semaforo_factor). Lo propagan useConfig (cliente)
// y las páginas server que leen la tabla configuracion.
let SEMAFORO_FACTOR = 1.5

export function setSemaforoFactor(factor: number) {
  if (Number.isFinite(factor) && factor >= 1) SEMAFORO_FACTOR = factor
}

export function calcularSemaforo(stockFisico: number, stockMinimo: number): StockSemaforo {
  if (stockFisico < stockMinimo) return 'rojo'
  if (stockFisico < stockMinimo * SEMAFORO_FACTOR) return 'amarillo'
  return 'verde'
}

const SEMAFORO_ORDEN: Record<StockSemaforo, number> = { verde: 0, amarillo: 1, rojo: 2 }

// Devuelve el peor semáforo entre el producto y cada color individual.
// Si un color está crítico, el producto se considera crítico aunque el total esté bien.
export function calcularSemaforoEfectivo(
  producto: Pick<Producto, 'stock_fisico' | 'stock_minimo'>,
  colores:   Pick<ProductoColor, 'stock' | 'stock_minimo'>[]
): StockSemaforo {
  let peor = calcularSemaforo(producto.stock_fisico, producto.stock_minimo)
  for (const c of colores) {
    const semColor = calcularSemaforo(c.stock, c.stock_minimo ?? producto.stock_minimo)
    if (SEMAFORO_ORDEN[semColor] > SEMAFORO_ORDEN[peor]) peor = semColor
  }
  return peor
}

export function calcularStockDisponible(stockFisico: number): number {
  // Por ahora sin reservas activas — se ajusta cuando OMS esté activo
  return stockFisico
}

// ── Proveedores ───────────────────────────────────────────────
export interface Proveedor {
  id:              string
  nombre:          string
  contacto_nombre: string | null
  contacto_tel:    string | null
  notas:           string | null
  activo:          boolean
  created_at:      string
}

export interface PagoProveedor {
  id:                  string
  adeudo_id:           string
  monto:               number
  metodo:              'efectivo' | 'tarjeta' | 'transferencia' | 'mixto'
  monto_efectivo:      number
  monto_tarjeta:       number
  monto_transferencia: number
  notas:               string | null
  created_by:          string | null
  created_at:          string
}

export interface Adeudo {
  id:                string
  proveedor_id:      string
  descripcion:       string
  monto:             number
  monto_pagado:      number          // suma de pagos_proveedor
  fecha_vencimiento: string          // 'YYYY-MM-DD'
  estado:            'pendiente' | 'parcial' | 'pagado'
  fecha_pago:        string | null
  notas:             string | null
  created_at:        string
  proveedores?:      { nombre: string }
  pagos_proveedor?:  PagoProveedor[]
}

// ── Costos fijos ──────────────────────────────────────────────
export type CostoCategoria = 'personal' | 'renta' | 'servicios' | 'marketing' | 'otros'
export type CostoPeriodo   = 'mensual' | 'quincenal' | 'semanal' | 'anual' | 'unico'

export interface CostoFijo {
  id:         string
  categoria:  CostoCategoria
  nombre:     string
  monto:      number
  periodo:    CostoPeriodo
  activo:     boolean
  notas:      string | null
  created_at: string
}

export function costoMensual(costo: CostoFijo): number {
  const m: Record<CostoPeriodo, number> = {
    mensual:    1,
    quincenal:  2,
    semanal:    4.33,
    anual:      1 / 12,
    unico:      1 / 12,
  }
  return Number(costo.monto) * m[costo.periodo]
}

export const CATEGORIA_META: Record<CostoCategoria, { label: string; color: string; bg: string }> = {
  personal:  { label: 'Personal',  color: '#8b5cf6', bg: 'bg-purple-50 text-purple-700' },
  renta:     { label: 'Renta',     color: '#3b82f6', bg: 'bg-blue-50 text-blue-700'    },
  servicios: { label: 'Servicios', color: '#f59e0b', bg: 'bg-amber-50 text-amber-700'  },
  marketing: { label: 'Marketing', color: '#ec4899', bg: 'bg-pink-50 text-pink-700'    },
  otros:     { label: 'Otros',     color: '#94a3b8', bg: 'bg-slate-100 text-slate-600' },
}

export const TIPOS_MOVIMIENTO: Record<MovimientoTipo, { label: string; signo: 1 | -1; color: string }> = {
  levantamiento_inventario: { label: 'Levantamiento', signo: 1, color: 'text-blue-600' },
  entrada_compra: { label: 'Entrada (compra)', signo: 1, color: 'text-green-600' },
  salida_venta_manual: { label: 'Venta manual', signo: -1, color: 'text-amber-600' },
  ajuste_positivo: { label: 'Ajuste (+)', signo: 1, color: 'text-green-600' },
  ajuste_negativo: { label: 'Ajuste (−)', signo: -1, color: 'text-red-600' },
  devolucion: { label: 'Devolución', signo: 1, color: 'text-purple-600' },
}

// ── Colores por producto ──────────────────────────────────────
export interface ProductoColor {
  id:           string
  producto_id:  string
  nombre:       string
  hex:          string
  stock:        number
  stock_minimo: number | null   // null → usa el stock_minimo del producto padre
  created_at:   string
}

// ── Ventas ────────────────────────────────────────────────────
export interface Venta {
  id:                  string
  total:               number
  metodo:              'efectivo' | 'tarjeta' | 'transferencia' | 'mixto'
  monto_efectivo:      number
  monto_tarjeta:       number
  monto_transferencia: number
  cambio:              number
  cajero_id:           string | null
  created_at:          string
}

// ── Corte de caja ─────────────────────────────────────────────
export interface CorteCaja {
  id:                   string
  cajero_id:            string | null
  efectivo_esperado:    number
  efectivo_contado:     number
  diferencia:           number
  total_ventas:         number
  total_efectivo:       number
  total_tarjeta:        number
  total_transferencia:  number
  num_transacciones:    number
  notas:                string | null
  created_at:           string
}

export interface VentaItem {
  id:              string
  venta_id:        string
  producto_id:     string
  cantidad:        number
  precio_unitario: number
  subtotal:        number
  created_at:      string
  productos?:      { nombre: string; unidad: string }
}
