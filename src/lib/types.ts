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
  categoria: string | null
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

export function calcularSemaforo(stockFisico: number, stockMinimo: number): StockSemaforo {
  if (stockFisico < stockMinimo) return 'rojo'
  if (stockFisico < stockMinimo * 1.5) return 'amarillo'
  return 'verde'
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

export interface Adeudo {
  id:                string
  proveedor_id:      string
  descripcion:       string
  monto:             number
  fecha_vencimiento: string   // 'YYYY-MM-DD'
  estado:            'pendiente' | 'pagado'
  fecha_pago:        string | null
  notas:             string | null
  created_at:        string
  proveedores?:      { nombre: string }
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

// ── Ventas ────────────────────────────────────────────────────
export interface Venta {
  id:             string
  total:          number
  metodo:         'efectivo' | 'tarjeta' | 'mixto'
  monto_efectivo: number
  monto_tarjeta:  number
  cambio:         number
  cajero_id:      string | null
  created_at:     string
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
