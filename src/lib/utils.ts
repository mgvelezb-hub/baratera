import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatMXN(amount: number): string {
  return new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(amount)
}

export function formatNum(n: number): string {
  return new Intl.NumberFormat('es-MX').format(n)
}

export function formatFecha(dateStr: string): string {
  return new Intl.DateTimeFormat('es-MX', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(dateStr))
}

// Pluraliza unidades de medida para el ticket y pantalla cliente.
// Unidades abreviadas (kg, lt) no cambian.
export function pluralUnidad(unidad: string, cantidad: number): string {
  if (cantidad === 1) return unidad
  const map: Record<string, string> = {
    caja:     'cajas',
    pza:      'pzas',
    paquete:  'paquetes',
    rollo:    'rollos',
    resma:    'resmas',
    par:      'pares',
    juego:    'juegos',
  }
  return map[unidad] ?? unidad   // kg, lt y desconocidos no cambian
}

// Muestra stock como "X cajas + Y pzas" cuando el producto tiene piezas_por_caja.
// Si piezasPorCaja es null/0, devuelve el formato normal con la unidad del producto.
export function formatStockConCajas(stock: number, piezasPorCaja: number | null, unidad: string): string {
  if (!piezasPorCaja) return `${formatNum(stock)} ${unidad}`
  const cajas  = Math.floor(stock / piezasPorCaja)
  const piezas = stock % piezasPorCaja
  if (cajas  === 0) return `${formatNum(piezas)} pzas`
  if (piezas === 0) return `${formatNum(cajas)} ${cajas === 1 ? 'caja' : 'cajas'}`
  return `${formatNum(cajas)} ${cajas === 1 ? 'caja' : 'cajas'} + ${formatNum(piezas)} pzas`
}

export function formatFechaCorta(dateStr: string): string {
  return new Intl.DateTimeFormat('es-MX', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(dateStr))
}
