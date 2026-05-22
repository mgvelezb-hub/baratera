export type StockSemaforo = 'verde' | 'amarillo' | 'rojo'

export interface Producto {
  id: string
  nombre: string
  descripcion: string | null
  sku: string | null
  precio_menudeo: number
  precio_mayoreo: number | null
  umbral_mayoreo: number | null
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

export const TIPOS_MOVIMIENTO: Record<MovimientoTipo, { label: string; signo: 1 | -1; color: string }> = {
  levantamiento_inventario: { label: 'Levantamiento', signo: 1, color: 'text-blue-600' },
  entrada_compra: { label: 'Entrada (compra)', signo: 1, color: 'text-green-600' },
  salida_venta_manual: { label: 'Venta manual', signo: -1, color: 'text-amber-600' },
  ajuste_positivo: { label: 'Ajuste (+)', signo: 1, color: 'text-green-600' },
  ajuste_negativo: { label: 'Ajuste (−)', signo: -1, color: 'text-red-600' },
  devolucion: { label: 'Devolución', signo: 1, color: 'text-purple-600' },
}
