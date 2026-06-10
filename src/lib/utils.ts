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

// Muestra stock como "X [unidad] + Y pzas" cuando el producto tiene piezas_por_caja.
// Si piezasPorCaja es null/0, devuelve el formato normal con la unidad del producto.
export function formatStockConCajas(stock: number, piezasPorCaja: number | null, unidad: string): string {
  if (!piezasPorCaja) return `${formatNum(stock)} ${unidad}`
  const unidades = Math.floor(stock / piezasPorCaja)
  const piezas   = stock % piezasPorCaja
  const labelU   = pluralUnidad(unidad, unidades)
  if (unidades === 0) return `${formatNum(piezas)} pzas`
  if (piezas   === 0) return `${formatNum(unidades)} ${labelU}`
  return `${formatNum(unidades)} ${labelU} + ${formatNum(piezas)} pzas`
}

// Gradientes para colores "Surtido" — usados en cualquier componente que muestre bolitas de color
export const COLOR_GRADIENTS: Record<string, string> = {
  'Surtido color fuerte':     'conic-gradient(from 0deg, #FF0000, #FF6600, #FFCC00, #33CC33, #0066FF, #9900CC, #FF0000)',
  'Surtido color pastel':     'conic-gradient(from 0deg, #FFD1DC, #FFDAB9, #FFFACD, #B5EAD7, #B0C4DE, #E6B0FF, #FFD1DC)',
  'Surtido colores intensos': 'conic-gradient(from 0deg, #FF0000, #FF4500, #FF8800, #00BB00, #0000DD, #8800AA, #FF0000)',
  'Surtido':                  'conic-gradient(from 0deg, #FF0000, #FF8C00, #FFD500, #00A550, #4169E1, #8B008B, #FF0000)',
}

export function colorStyle(nombre: string, hex: string): { background?: string; backgroundColor?: string } {
  const g = COLOR_GRADIENTS[nombre]
  return g ? { background: g } : { backgroundColor: hex }
}

export function formatFechaCorta(dateStr: string): string {
  return new Intl.DateTimeFormat('es-MX', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(dateStr))
}
