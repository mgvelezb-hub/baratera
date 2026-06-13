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

// Muestra stock como "X cajas + Y {unidad}" — caja es siempre el agrupador mayor.
// Si piezasPorCaja es null/0, devuelve el formato normal con la unidad del producto.
export function formatStockConCajas(stock: number, piezasPorCaja: number | null, unidad: string): string {
  if (!piezasPorCaja) return `${formatNum(stock)} ${pluralUnidad(unidad, stock)}`
  const cajas = Math.floor(stock / piezasPorCaja)
  const resto  = stock % piezasPorCaja
  if (cajas === 0) return `${formatNum(resto)} ${pluralUnidad(unidad, resto)}`
  if (resto  === 0) return `${formatNum(cajas)} ${pluralUnidad('caja', cajas)}`
  return `${formatNum(cajas)} ${pluralUnidad('caja', cajas)} + ${formatNum(resto)} ${pluralUnidad(unidad, resto)}`
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

// ── Número a letras (español MX) — para el total escrito del ticket.
//    Soporta hasta cientos de millones. Devuelve solo el entero en
//    mayúsculas; el formato "PESOS XX/100 M.N." lo arma montoALetras.
const NAL_UNIDADES = [
  '', 'UNO', 'DOS', 'TRES', 'CUATRO', 'CINCO', 'SEIS', 'SIETE', 'OCHO', 'NUEVE',
  'DIEZ', 'ONCE', 'DOCE', 'TRECE', 'CATORCE', 'QUINCE', 'DIECISÉIS', 'DIECISIETE',
  'DIECIOCHO', 'DIECINUEVE', 'VEINTE', 'VEINTIUNO', 'VEINTIDÓS', 'VEINTITRÉS',
  'VEINTICUATRO', 'VEINTICINCO', 'VEINTISÉIS', 'VEINTISIETE', 'VEINTIOCHO', 'VEINTINUEVE',
]
const NAL_DECENAS  = ['', '', '', 'TREINTA', 'CUARENTA', 'CINCUENTA', 'SESENTA', 'SETENTA', 'OCHENTA', 'NOVENTA']
const NAL_CENTENAS = ['', 'CIENTO', 'DOSCIENTOS', 'TRESCIENTOS', 'CUATROCIENTOS', 'QUINIENTOS', 'SEISCIENTOS', 'SETECIENTOS', 'OCHOCIENTOS', 'NOVECIENTOS']

function nalSeccion(num: number): string {
  if (num === 100) return 'CIEN'
  let s = ''
  const c     = Math.floor(num / 100)
  const resto = num % 100
  if (c > 0) s += NAL_CENTENAS[c] + ' '
  if (resto < 30) {
    s += NAL_UNIDADES[resto]
  } else {
    const d = Math.floor(resto / 10)
    const u = resto % 10
    s += NAL_DECENAS[d]
    if (u > 0) s += ' Y ' + NAL_UNIDADES[u]
  }
  return s.trim()
}

function enteroALetras(n: number): string {
  if (n === 0) return 'CERO'
  const millones = Math.floor(n / 1_000_000)
  const miles    = Math.floor((n % 1_000_000) / 1000)
  const resto    = n % 1000
  let r = ''
  if (millones > 0) r += (millones === 1 ? 'UN MILLÓN' : nalSeccion(millones) + ' MILLONES') + ' '
  if (miles > 0)    r += (miles === 1 ? 'MIL' : nalSeccion(miles) + ' MIL') + ' '
  if (resto > 0)    r += nalSeccion(resto)
  // Apócope: "uno" → "un" antes de sustantivo masculino (MIL/MILLONES/PESOS)
  return r.trim().replace(/\bVEINTIUNO\b/g, 'VEINTIÚN').replace(/\bUNO\b/g, 'UN')
}

// "DIECIOCHO MIL OCHOCIENTOS PESOS 00/100 M.N."
export function montoALetras(monto: number): string {
  const entero   = Math.floor(monto)
  const centavos = Math.round((monto - entero) * 100)
  const pesoLbl  = entero === 1 ? 'PESO' : 'PESOS'
  const cent     = String(centavos).padStart(2, '0')
  return `${enteroALetras(entero)} ${pesoLbl} ${cent}/100 M.N.`
}
