import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import AppShell from '@/components/AppShell'
import SalesChart from './SalesChart'
import type { ChartDay } from './SalesChart'
import { calcularSemaforo, calcularSemaforoEfectivo, costoMensual, CATEGORIA_META } from '@/lib/types'
import type { CostoFijo, CostoCategoria, ProductoColor } from '@/lib/types'
import {
  TrendingUp, AlertTriangle, Package, ArrowUpRight, ArrowDownRight,
  ShoppingCart, Zap, Monitor, Globe, RefreshCcw, Receipt,
} from 'lucide-react'
import Link from 'next/link'

// ── Helpers ────────────────────────────────────────────────────
const TIPO_META: Record<string, { label: string; color: string }> = {
  salida_venta_manual:      { label: 'Venta',        color: 'text-violet-600 bg-violet-50' },
  entrada_compra:           { label: 'Entrada',       color: 'text-green-600 bg-green-50'  },
  ajuste_positivo:          { label: 'Ajuste (+)',    color: 'text-blue-600 bg-blue-50'    },
  ajuste_negativo:          { label: 'Ajuste (−)',    color: 'text-amber-600 bg-amber-50'  },
  devolucion:               { label: 'Devolución',    color: 'text-purple-600 bg-purple-50'},
  levantamiento_inventario: { label: 'Inventario',   color: 'text-slate-600 bg-slate-100' },
}

function formatCorteDate(iso: string, now: Date): string {
  const d       = new Date(iso)
  const todayStr = now.toISOString().split('T')[0]
  const yestStr  = new Date(now.getTime() - 86_400_000).toISOString().split('T')[0]
  const dStr     = iso.split('T')[0]
  const hora     = d.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })
  if (dStr === todayStr) return `Hoy ${hora}`
  if (dStr === yestStr)  return `Ayer ${hora}`
  return d.toLocaleDateString('es-MX', { day: 'numeric', month: 'short' }) + ` ${hora}`
}

function tiempoRelativo(dateStr: string): string {
  const diff = (Date.now() - new Date(dateStr).getTime()) / 1000
  if (diff < 60)    return 'hace un momento'
  if (diff < 3600)  return `hace ${Math.floor(diff / 60)} min`
  if (diff < 86400) return `hace ${Math.floor(diff / 3600)} h`
  return `hace ${Math.floor(diff / 86400)} d`
}

function usuarioLabel(notas: string | null, canal: string | null): string {
  if (canal === 'pos' && notas) {
    const partes = notas.split(' · ')
    if (partes.length > 1) return partes[partes.length - 1].trim().split('@')[0]
  }
  return canal === 'manual' ? 'Manual' : canal ?? '—'
}

function formatMXN(n: number) {
  if (n >= 1000) return `$${(n / 1000).toFixed(1)}k`
  return new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 0 }).format(n)
}

function formatMXNFull(n: number) {
  return new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 0 }).format(n)
}

function sumTotal(rows: { total: number }[] | null): number {
  return (rows ?? []).reduce((s, v) => s + Number(v.total), 0)
}

// ── Page ───────────────────────────────────────────────────────
export const revalidate = 60

export default async function DashboardPage() {
  const supabase    = await createClient()
  const now         = new Date()
  const todayStr    = now.toISOString().split('T')[0]
  const todayStart  = `${todayStr}T00:00:00`
  const sevenAgo    = new Date(now.getTime() -  7 * 86_400_000).toISOString()
  const fourteenAgo = new Date(now.getTime() - 14 * 86_400_000).toISOString()

  const mesInicio = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()

  const [
    { data: ventasHoy },
    { data: entradasHoy },
    { data: ventasSemana },
    { data: ventasAnterior },
    { data: productos },
    { data: coloresDB },
    { data: movimientos },
    { data: adeudosPendientes },
    { data: costosFijos },
    { data: comprasMes },
    { data: ledgerSemana },
    { data: cortesDB },
    { data: entradasConCosto },
  ] = await Promise.all([
    supabase.from('ventas').select('total').gte('created_at', todayStart),
    supabase.from('stock_ledger').select('id')
      .eq('tipo', 'entrada_compra').gte('created_at', todayStart),
    supabase.from('ventas').select('total, created_at').gte('created_at', sevenAgo),
    supabase.from('ventas').select('total')
      .gte('created_at', fourteenAgo).lt('created_at', sevenAgo),
    supabase.from('productos').select('*').eq('activo', true).order('nombre'),
    supabase.from('producto_colores').select('id, producto_id, nombre, stock, stock_minimo'),
    supabase.from('stock_ledger')
      .select('id, tipo, qty_antes, qty_despues, notas, canal, created_at, productos(nombre, unidad)')
      .order('created_at', { ascending: false }).limit(12),
    supabase.from('adeudos')
      .select('id, monto, monto_pagado, fecha_vencimiento, estado, descripcion, proveedores(nombre)')
      .in('estado', ['pendiente', 'parcial'])
      .order('fecha_vencimiento', { ascending: true })
      .limit(4),
    supabase.from('costos_fijos').select('*').eq('activo', true),
    supabase.from('stock_ledger')
      .select('qty_antes, qty_despues, productos(precio_menudeo)')
      .eq('tipo', 'entrada_compra')
      .gte('created_at', mesInicio),
    supabase.from('stock_ledger')
      .select('qty_antes, qty_despues, productos(nombre, precio_menudeo, unidad, stock_minimo)')
      .eq('tipo', 'salida_venta_manual').gte('created_at', sevenAgo),
    supabase.from('stock_ledger')
      .select('producto_id, precio_unitario, proveedor_id, qty_antes, qty_despues, created_at, proveedores(nombre), productos(nombre, precio_menudeo, precio_caja, piezas_por_caja, unidad)')
      .in('tipo', ['entrada_compra', 'levantamiento_inventario'])
      .not('precio_unitario', 'is', null)
      .order('created_at', { ascending: false })
      .limit(100),
    supabase.from('cortes_caja')
      .select('id, cajero_id, total_ventas, total_efectivo, total_tarjeta, total_transferencia, diferencia, num_transacciones, notas, created_at')
      .order('created_at', { ascending: false })
      .limit(8),
  ])

  // ── KPI calculations ──────────────────────────────────────
  const ingresosHoy      = sumTotal(ventasHoy)
  const ingresosSemana   = sumTotal(ventasSemana)
  const ingresosAnterior = sumTotal(ventasAnterior)
  const deltaIngresos    = ingresosAnterior > 0
    ? ((ingresosSemana - ingresosAnterior) / ingresosAnterior * 100)
    : null

  const transaccionesHoy = ventasHoy?.length ?? 0
  const ticketPromedio   = transaccionesHoy > 0 ? ingresosHoy / transaccionesHoy : 0
  const entradasCount    = entradasHoy?.length ?? 0

  const coloresMapDB = new Map<string, ProductoColor[]>()
  for (const c of (coloresDB ?? []) as ProductoColor[]) {
    const arr = coloresMapDB.get(c.producto_id) ?? []
    arr.push(c)
    coloresMapDB.set(c.producto_id, arr)
  }

  // ── Margen estimado por producto ─────────────────────────────
  // precio_unitario = costo por unidad del producto (caja si ppc>0, pieza si no).
  // Para comparar correctamente, usamos el precio de venta de la MISMA unidad.
  type MargenItem = { nombre: string; costoUnit: number; precioVenta: number; margen: number; proveedor: string | null; unidad: string; etiqueta: string }
  const margenMap = new Map<string, MargenItem>()
  for (const e of (entradasConCosto ?? []) as any[]) {
    if (margenMap.has(e.producto_id)) continue
    const prod = e.productos
    if (!prod) continue
    const ppc      = prod.piezas_por_caja ?? 0
    const costoUnit = Number(e.precio_unitario)
    // Precio de venta en la misma unidad que el costo:
    // - Si tiene precio_caja y ppc > 0 → comparar caja vs caja
    // - Si tiene ppc pero no precio_caja → ppc × precio_menudeo = precio implícito por caja
    // - Sin ppc → comparar pieza vs pieza
    const ventaUnit = ppc > 0
      ? (prod.precio_caja ? Number(prod.precio_caja) : ppc * Number(prod.precio_menudeo))
      : Number(prod.precio_menudeo)
    const etiqueta  = ppc > 0 ? 'por caja' : `por ${prod.unidad}`
    const margen    = ventaUnit > 0 ? Math.round((1 - costoUnit / ventaUnit) * 100) : 0
    margenMap.set(e.producto_id, {
      nombre:      prod.nombre,
      costoUnit,
      precioVenta: ventaUnit,
      margen,
      proveedor:   e.proveedores?.nombre ?? null,
      unidad:      prod.unidad,
      etiqueta,
    })
  }
  const margenItems = [...margenMap.values()].sort((a, b) => b.margen - a.margen)

  // Mapa cajero_id → nombre (parte local del email)
  const cajeroMap = new Map<string, string>()
  try {
    const { data: { users } } = await createAdminClient().auth.admin.listUsers({ perPage: 100 })
    for (const u of users) {
      cajeroMap.set(u.id, (u.email ?? u.id).split('@')[0])
    }
  } catch (_) { /* service role no disponible — se mostrará id truncado */ }

  const productosAlerta  = (productos ?? []).filter(p =>
    calcularSemaforoEfectivo(p, coloresMapDB.get(p.id) ?? []) !== 'verde'
  )
  const productosRojo    = productosAlerta.filter(p =>
    calcularSemaforoEfectivo(p, coloresMapDB.get(p.id) ?? []) === 'rojo'
  )
  const totalActivos     = productos?.length ?? 0

  // ── Chart data ────────────────────────────────────────────
  const chartData: ChartDay[] = Array.from({ length: 7 }, (_, i) => {
    const d          = new Date(now.getTime() - (6 - i) * 86_400_000)
    const datePrefix = d.toISOString().split('T')[0]
    const dayVentas  = (ventasSemana ?? []).filter(v => v.created_at.startsWith(datePrefix))
    return {
      fecha:         d.toLocaleDateString('es-MX', { weekday: 'short', day: 'numeric' }),
      ingresos:      dayVentas.reduce((s, v) => s + Number(v.total), 0),
      transacciones: dayVentas.length,
    }
  })

  // ── Top movers (from ledger — tracks product-level movement) ──
  const movsByProd = new Map<string, { nombre: string; piezas: number; stock: number; minimo: number; unidad: string }>()
  for (const v of (ledgerSemana ?? [])) {
    const p = (v as any).productos
    if (!p) continue
    const cur = movsByProd.get(p.nombre) ?? { nombre: p.nombre, piezas: 0, stock: 0, minimo: Number(p.stock_minimo ?? 0), unidad: p.unidad }
    cur.piezas += (v.qty_antes - v.qty_despues)
    movsByProd.set(p.nombre, cur)
  }
  for (const p of (productos ?? [])) {
    if (movsByProd.has(p.nombre)) {
      movsByProd.get(p.nombre)!.stock  = p.stock_fisico
      movsByProd.get(p.nombre)!.minimo = p.stock_minimo
    }
  }
  const topMovers = [...movsByProd.values()].sort((a, b) => b.piezas - a.piezas).slice(0, 6)

  // ── Adeudos calculations ──────────────────────────────────
  function diasParaVencer(fecha: string): number {
    const hoy  = new Date(); hoy.setHours(0, 0, 0, 0)
    const venc = new Date(fecha + 'T00:00:00')
    return Math.ceil((venc.getTime() - hoy.getTime()) / 86_400_000)
  }

  const totalAdeudado   = (adeudosPendientes ?? []).reduce((s, a) => s + Math.max(0, Number(a.monto) - Number((a as any).monto_pagado ?? 0)), 0)
  const adeudosVencidos = (adeudosPendientes ?? []).filter(a => diasParaVencer(a.fecha_vencimiento) < 0)
  const adeudosUrgentes = (adeudosPendientes ?? []).filter(a => { const d = diasParaVencer(a.fecha_vencimiento); return d >= 0 && d <= 3 })

  // ── Score de Salud Financiera (0–100) ────────────────────────
  const productosVerde = totalActivos - productosAlerta.length
  const stockScore  = totalActivos > 0 ? Math.round((productosVerde / totalActivos) * 35) : 35
  const deudaScore  = adeudosVencidos.length === 0 ? 25 : Math.max(0, 25 - adeudosVencidos.length * 8)
  const tendScore   = deltaIngresos === null ? 10
    : Math.max(0, Math.min(20, Math.round(10 + deltaIngresos * 0.3)))
  const margenScore = totalActivos > 0 ? Math.min(20, Math.round((margenItems.length / totalActivos) * 20)) : 0
  const saludScore  = Math.min(100, stockScore + deudaScore + tendScore + margenScore)
  const saludLabel  = saludScore >= 70 ? 'Salud Buena' : saludScore >= 40 ? 'Salud Regular' : 'Atención Requerida'
  const saludColor  = saludScore >= 70 ? 'text-green-600' : saludScore >= 40 ? 'text-amber-600' : 'text-red-600'
  const saludMsg    = (() => {
    const parts: string[] = []
    if (margenItems.length === 0)         parts.push('registra precios de compra')
    if ((costosFijos?.length ?? 0) === 0) parts.push('agrega costos fijos')
    if (adeudosVencidos.length > 0)       parts.push(`${adeudosVencidos.length} adeudo${adeudosVencidos.length > 1 ? 's' : ''} vencido${adeudosVencidos.length > 1 ? 's' : ''}`)
    return parts.length === 0 ? 'Todos los módulos conectados ✓' : parts.join(' · ')
  })()
  const needleAngle = (1 - saludScore / 100) * Math.PI
  const needleX     = +(60 + 37 * Math.cos(needleAngle)).toFixed(1)
  const needleY     = +(65 - 37 * Math.sin(needleAngle)).toFixed(1)
  const arcX        = +(60 + 44 * Math.cos(needleAngle)).toFixed(1)
  const arcY        = +(65 - 44 * Math.sin(needleAngle)).toFixed(1)
  const arcLarge    = saludScore >= 50 ? 1 : 0

  // ── Costos donut ──────────────────────────────────────────
  const costoMercancia = (comprasMes ?? []).reduce((s: number, r: any) => {
    return s + Math.max(0, r.qty_despues - r.qty_antes) * Number(r.productos?.precio_menudeo ?? 0)
  }, 0)

  const totalPorCat: Partial<Record<CostoCategoria, number>> = {}
  for (const c of (costosFijos ?? []) as CostoFijo[]) {
    totalPorCat[c.categoria] = (totalPorCat[c.categoria] ?? 0) + costoMensual(c)
  }
  const totalFijos   = Object.values(totalPorCat).reduce((s, v) => s + v, 0)
  const totalCostos  = totalFijos + costoMercancia
  const CIRCUM       = 2 * Math.PI * 38

  const donutSegs = (() => {
    const base = [
      { label: 'Mercancía', value: costoMercancia,  color: '#7c3aed' },
      ...Object.entries(totalPorCat)
        .filter(([, v]) => (v ?? 0) > 0)
        .map(([cat, val]) => ({
          label: CATEGORIA_META[cat as CostoCategoria].label,
          value: val ?? 0,
          color: CATEGORIA_META[cat as CostoCategoria].color,
        })),
    ].filter(s => s.value > 0)
    let offset = 0
    return base.map(s => {
      const pct  = totalCostos > 0 ? s.value / totalCostos : 0
      const dash = pct * CIRCUM
      const seg  = { ...s, pct: Math.round(pct * 100), dash, offset: -offset }
      offset += dash
      return seg
    })
  })()

  // ── Alerts ────────────────────────────────────────────────
  type AlertItem = { level: 'danger' | 'warn' | 'info'; title: string; body: string }
  const alerts: AlertItem[] = []

  for (const p of productosRojo.slice(0, 3)) {
    const colores  = coloresMapDB.get(p.id) ?? []
    const peor     = colores.find(c => calcularSemaforo(c.stock, c.stock_minimo ?? p.stock_minimo) === 'rojo')
    const stockStr = peor ? `${peor.nombre}: ${peor.stock} pzas` : `${p.stock_fisico} ${p.unidad}`
    const minStr   = peor ? `mín ${peor.stock_minimo ?? p.stock_minimo} pzas` : `mín ${p.stock_minimo} ${p.unidad}`
    alerts.push({ level: 'danger', title: `Stock crítico: ${p.nombre}`, body: `${stockStr} · ${minStr}` })
  }
  for (const p of productosAlerta.filter(p => calcularSemaforoEfectivo(p, coloresMapDB.get(p.id) ?? []) === 'amarillo').slice(0, 2)) {
    const colores  = coloresMapDB.get(p.id) ?? []
    const peor     = colores.find(c => calcularSemaforo(c.stock, c.stock_minimo ?? p.stock_minimo) !== 'verde')
    const stockStr = peor ? `${peor.nombre}: ${peor.stock} pzas` : `${p.stock_fisico} ${p.unidad}`
    const minStr   = peor ? `mín ${peor.stock_minimo ?? p.stock_minimo} pzas` : `mín ${p.stock_minimo} ${p.unidad}`
    alerts.push({ level: 'warn', title: `Stock bajo: ${p.nombre}`, body: `${stockStr} · ${minStr}` })
  }
  if (alerts.length === 0) {
    alerts.push({ level: 'info', title: 'Stock en orden', body: 'Ningún producto bajo stock mínimo.' })
  }
  // Alertas de adeudos
  for (const a of adeudosVencidos.slice(0, 2)) {
    const prov = (a as any).proveedores?.nombre ?? 'Proveedor'
    const restante = Math.max(0, Number(a.monto) - Number((a as any).monto_pagado ?? 0))
    alerts.push({ level: 'danger', title: `Adeudo vencido: ${prov}`, body: `${formatMXNFull(restante)} · ${a.descripcion}` })
  }
  for (const a of adeudosUrgentes.slice(0, 2)) {
    const prov = (a as any).proveedores?.nombre ?? 'Proveedor'
    const dias = diasParaVencer(a.fecha_vencimiento)
    const restante = Math.max(0, Number(a.monto) - Number((a as any).monto_pagado ?? 0))
    alerts.push({ level: 'warn', title: `Pago en ${dias} días: ${prov}`, body: `${formatMXNFull(restante)} · ${a.descripcion}` })
  }

  const fechaLabel = now.toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'long' })

  return (
    <AppShell>
      <div className="px-4 py-5 max-w-6xl mx-auto space-y-5">

        {/* ── Header ────────────────────────────────────────── */}
        <div className="flex items-end justify-between">
          <div>
            <h1 className="text-xl font-bold text-slate-900">Resumen General</h1>
            <p className="text-sm text-slate-500 capitalize">{fechaLabel} · Solo canal POS activo</p>
          </div>
          <div className="flex gap-2 items-center">
            <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-violet-50 border border-violet-200 text-violet-700 text-xs font-semibold">
              <span className="w-2 h-2 rounded-full bg-violet-500 animate-pulse" />
              Punto de Venta
            </span>
            <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-slate-100 border border-slate-200 text-slate-400 text-xs font-medium">
              Online / Redes
              <span className="text-[10px] bg-slate-200 text-slate-500 px-1.5 py-0.5 rounded font-semibold">Próximo</span>
            </span>
          </div>
        </div>

        {/* ── KPI strip (5) ────────────────────────────────── */}
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
          <KPI
            label="Ingresos 7 días"
            value={formatMXN(ingresosSemana)}
            delta={deltaIngresos !== null ? { pct: deltaIngresos, label: 'vs semana anterior' } : null}
            accent="violet"
            sub="canal POS · aprox."
          />
          <KPI
            label="Ingresos hoy"
            value={formatMXN(ingresosHoy)}
            delta={null}
            accent="blue"
            sub={`${transaccionesHoy} movimientos`}
          />
          <KPI
            label="Ticket promedio"
            value={transaccionesHoy > 0 ? formatMXNFull(ticketPromedio) : '—'}
            delta={null}
            accent="purple"
            sub="hoy · aprox."
          />
          <KPI
            label="Stock crítico"
            value={String(productosAlerta.length)}
            delta={null}
            accent={productosAlerta.length > 0 ? 'red' : 'green'}
            sub={`de ${totalActivos} activos`}
          />
          <KPI
            label="Entradas hoy"
            value={String(entradasCount)}
            delta={null}
            accent="green"
            sub="compras a proveedor"
          />
        </div>

        {/* ── Row 2: Revenue chart + Alerts ─────────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

          {/* Revenue chart */}
          <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
              <div>
                <p className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                  Ingresos por día
                  <span className="text-[10px] bg-violet-50 text-violet-500 border border-violet-200 px-2 py-0.5 rounded font-semibold">+ Online próximo</span>
                </p>
                <p className="text-xs text-slate-400 mt-0.5">POS únicamente · estimado por precio menudeo</p>
              </div>
              <div className="flex items-center gap-3 text-xs text-slate-400">
                <span className="flex items-center gap-1.5">
                  <span className="w-3 h-0.5 rounded bg-violet-500" />POS
                </span>
                <span className="flex items-center gap-1.5 opacity-40">
                  <span className="w-3 h-0.5 rounded bg-violet-300 border-dashed" />Online
                </span>
              </div>
            </div>
            <div className="p-5 pb-3">
              <SalesChart data={chartData} />
            </div>
          </div>

          {/* Alerts */}
          <div className="bg-white rounded-2xl border border-slate-200">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
              <p className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                <Zap className="w-3.5 h-3.5 text-amber-500" />Alertas
              </p>
              <Link href="/inventario" className="text-xs text-violet-600 font-medium hover:underline">Ver inventario →</Link>
            </div>
            <div className="p-3 space-y-2">
              {alerts.map((a, i) => (
                <AlertRow key={i} level={a.level} title={a.title} body={a.body} />
              ))}
            </div>
          </div>

        </div>

        {/* ── Row 3: Inventory + Cost donut + Health score ──── */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

          {/* Top movers */}
          <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
              <div>
                <p className="text-sm font-semibold text-slate-700">Top Productos</p>
                <p className="text-xs text-slate-400 mt-0.5">Por movimiento · últimos 7 días</p>
              </div>
              <Link href="/inventario" className="text-xs text-violet-600 font-medium hover:underline">Ver todo →</Link>
            </div>
            {topMovers.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 text-center px-4">
                <Package className="w-8 h-8 text-slate-200 mb-2" />
                <p className="text-sm text-slate-400">Sin ventas esta semana</p>
              </div>
            ) : (
              <table className="w-full">
                <thead>
                  <tr className="border-b border-slate-100">
                    <th className="px-4 py-2 text-left text-[10px] font-semibold uppercase tracking-wide text-slate-400">Producto</th>
                    <th className="px-4 py-2 text-center text-[10px] font-semibold uppercase tracking-wide text-slate-400">Stock</th>
                    <th className="px-4 py-2 text-right text-[10px] font-semibold uppercase tracking-wide text-slate-400">Mov.</th>
                  </tr>
                </thead>
                <tbody>
                  {topMovers.map((item, i) => {
                    const sem     = calcularSemaforo(item.stock, item.minimo)
                    const pct     = item.minimo > 0 ? Math.min(100, Math.round(item.stock / (item.minimo * 3) * 100)) : 50
                    const barClr  = sem === 'rojo' ? '#ef4444' : sem === 'amarillo' ? '#f59e0b' : '#7c3aed'
                    return (
                      <tr key={i} className="border-b border-slate-50 hover:bg-slate-50 transition-colors">
                        <td className="px-4 py-2.5">
                          <p className="text-xs font-semibold text-slate-800 truncate max-w-[120px]">{item.nombre}</p>
                        </td>
                        <td className="px-4 py-2.5">
                          <div className="flex flex-col items-center gap-1">
                            <div className="w-12 h-1 bg-slate-100 rounded-full overflow-hidden">
                              <div className="h-full rounded-full" style={{ width: `${pct}%`, background: barClr }} />
                            </div>
                            <span className="text-[10px] text-slate-500">{item.stock} {item.unidad}</span>
                          </div>
                        </td>
                        <td className="px-4 py-2.5 text-right">
                          <span className="text-xs font-bold text-slate-700">{item.piezas}</span>
                          <span className="text-[10px] text-slate-400 ml-0.5">pzs</span>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            )}
          </div>

          {/* Cost structure donut — datos reales */}
          <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-slate-700">Estructura de Costos</p>
                <p className="text-xs text-slate-400 mt-0.5">Este mes</p>
              </div>
              <Link href="/costos" className="text-xs text-violet-600 font-medium hover:underline">Gestionar →</Link>
            </div>
            {totalCostos === 0 ? (
              <div className="flex flex-col items-center py-10 text-center px-4">
                <p className="text-sm text-slate-400">Sin costos registrados</p>
                <Link href="/costos" className="mt-2 text-xs text-violet-600 font-semibold hover:underline">+ Agregar costos</Link>
              </div>
            ) : (
              <div className="p-5 flex items-center gap-4">
                <svg viewBox="0 0 110 110" width={100} height={100} className="shrink-0">
                  <circle cx="55" cy="55" r="38" fill="none" stroke="#f1f5f9" strokeWidth="18" />
                  {donutSegs.map((s, i) => (
                    <circle key={i} cx="55" cy="55" r="38" fill="none"
                      stroke={s.color} strokeWidth="18"
                      strokeDasharray={`${s.dash} ${CIRCUM - s.dash}`}
                      strokeDashoffset={s.offset}
                      strokeLinecap="butt"
                      transform="rotate(-90 55 55)"
                    />
                  ))}
                  <text x="55" y="50" textAnchor="middle" fill="#475569" fontSize="8" fontWeight="600">Total</text>
                  <text x="55" y="63" textAnchor="middle" fill="#7c3aed" fontSize="8" fontWeight="700">
                    {formatMXN(totalCostos)}/mes
                  </text>
                </svg>
                <div className="flex flex-col gap-2 flex-1 min-w-0">
                  {donutSegs.map((s, i) => (
                    <div key={i} className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <div className="w-2 h-2 rounded-sm shrink-0" style={{ background: s.color }} />
                        <span className="text-xs text-slate-600 truncate">{s.label}</span>
                      </div>
                      <span className="text-xs font-bold text-slate-600 font-mono shrink-0">{s.pct}%</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Financial health score — datos reales */}
          <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100">
              <p className="text-sm font-semibold text-slate-700">Salud Financiera</p>
            </div>
            <div className="flex flex-col items-center px-5 pt-4 pb-2">
              <svg viewBox="0 0 120 70" width="160">
                {/* Pista completa */}
                <path d="M15 65 A45 45 0 0 1 105 65" fill="none" stroke="#f1f5f9" strokeWidth="10" strokeLinecap="round" />
                {/* Arco de score */}
                {saludScore > 0 && saludScore < 100 && (
                  <path
                    d={`M15 65 A45 45 0 ${arcLarge} 1 ${arcX} ${arcY}`}
                    fill="none"
                    stroke={saludScore >= 70 ? '#22c55e' : saludScore >= 40 ? '#f59e0b' : '#ef4444'}
                    strokeWidth="10" strokeLinecap="round"
                  />
                )}
                {saludScore === 100 && (
                  <path d="M15 65 A45 45 0 0 1 105 65" fill="none" stroke="#22c55e" strokeWidth="10" strokeLinecap="round" />
                )}
                {/* Aguja */}
                <line x1="60" y1="65" x2={needleX} y2={needleY} stroke="#1e293b" strokeWidth="2" strokeLinecap="round" />
                <circle cx="60" cy="65" r="5" fill="#fff" stroke="#1e293b" strokeWidth="1.5" />
                <text x="10"  y="72" fill="#94a3b8" fontSize="8" fontFamily="monospace">0</text>
                <text x="55"  y="18" fill="#94a3b8" fontSize="8" fontFamily="monospace">50</text>
                <text x="102" y="72" fill="#94a3b8" fontSize="8" fontFamily="monospace">100</text>
              </svg>
              <p className={`text-4xl font-bold -mt-1 ${saludColor}`}>{saludScore}</p>
              <p className={`text-xs font-semibold mt-0.5 ${saludColor}`}>{saludLabel}</p>
            </div>
            <div className="border-t border-slate-100">
              {[
                {
                  label: 'Stock saludable',
                  value: `${productosVerde} / ${totalActivos}`,
                  score: stockScore,
                  max: 35,
                  color: stockScore >= 28 ? 'text-green-600' : stockScore >= 14 ? 'text-amber-600' : 'text-red-500',
                },
                {
                  label: 'Sin adeudos vencidos',
                  value: adeudosVencidos.length === 0 ? '✓ Al día' : `${adeudosVencidos.length} vencido${adeudosVencidos.length > 1 ? 's' : ''}`,
                  score: deudaScore,
                  max: 25,
                  color: deudaScore === 25 ? 'text-green-600' : deudaScore >= 12 ? 'text-amber-600' : 'text-red-500',
                },
                {
                  label: 'Tendencia ingresos',
                  value: deltaIngresos !== null ? `${deltaIngresos >= 0 ? '+' : ''}${deltaIngresos.toFixed(1)}% 7d` : 'Sin datos aún',
                  score: tendScore,
                  max: 20,
                  color: tendScore >= 15 ? 'text-green-600' : 'text-amber-600',
                },
                {
                  label: 'Márgenes conocidos',
                  value: `${margenItems.length} / ${totalActivos} productos`,
                  score: margenScore,
                  max: 20,
                  color: margenScore >= 15 ? 'text-green-600' : margenScore >= 8 ? 'text-amber-600' : 'text-red-500',
                },
              ].map(({ label, value, score, max, color }) => (
                <div key={label} className="flex items-center justify-between px-5 py-2.5 border-b border-slate-50">
                  <div className="flex-1 min-w-0">
                    <p className="text-[11px] text-slate-500">{label}</p>
                    <p className={`text-sm font-bold ${color}`}>{value}</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <div className="w-10 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                      <div className="h-full rounded-full bg-current" style={{ width: `${Math.round(score/max*100)}%`, color: color.replace('text-', '') === 'green-600' ? '#22c55e' : color.includes('amber') ? '#f59e0b' : '#ef4444' }} />
                    </div>
                    <span className={`text-xs font-bold tabular-nums ${color}`}>{score}/{max}</span>
                  </div>
                </div>
              ))}
            </div>
            <div className={`px-4 py-2 border-t ${saludMsg.includes('✓') ? 'bg-green-50 border-green-100' : 'bg-amber-50 border-amber-100'}`}>
              <span className={`text-[10px] font-medium ${saludMsg.includes('✓') ? 'text-green-700' : 'text-amber-700'}`}>
                {saludMsg}
              </span>
            </div>
          </div>

        </div>

        {/* ── Row 4: Suppliers + Channel sources ─────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

          {/* Adeudos a Proveedores — datos reales */}
          <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
              <div>
                <p className="text-sm font-semibold text-slate-700">Adeudos a Proveedores</p>
                <p className="text-xs text-slate-400 mt-0.5">Ordenado por urgencia</p>
              </div>
              <Link href="/proveedores" className="text-xs text-violet-600 font-medium hover:underline">Ver todos →</Link>
            </div>

            {(adeudosPendientes ?? []).length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 px-6 text-center">
                <div className="w-12 h-12 rounded-2xl bg-green-50 border border-green-200 flex items-center justify-center mb-3">
                  <TrendingUp className="w-5 h-5 text-green-500" />
                </div>
                <p className="text-sm font-semibold text-slate-600 mb-1">Sin adeudos pendientes</p>
                <Link href="/proveedores" className="text-xs text-violet-600 font-semibold hover:underline">+ Registrar proveedor</Link>
              </div>
            ) : (
              <ul className="divide-y divide-slate-100">
                {(adeudosPendientes ?? []).map(a => {
                  const dias = diasParaVencer(a.fecha_vencimiento)
                  const prov = (a as any).proveedores?.nombre ?? '—'
                  const vencido = dias < 0
                  const urgente = dias >= 0 && dias <= 3

                  return (
                    <li key={a.id} className="flex items-center gap-3 px-5 py-3">
                      <div className={`w-9 h-9 rounded-xl flex items-center justify-center text-xs font-bold shrink-0 border ${
                        vencido ? 'bg-red-50 border-red-200 text-red-600' :
                        urgente ? 'bg-amber-50 border-amber-200 text-amber-600' :
                        'bg-slate-50 border-slate-200 text-slate-600'
                      }`}>
                        {prov.charAt(0).toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-slate-900 truncate">{prov}</p>
                        <p className="text-xs text-slate-400 mt-0.5">
                          {vencido ? `Venció hace ${Math.abs(dias)} días` :
                           dias === 0 ? '⚠ Vence hoy' :
                           `Vence en ${dias} días`}
                        </p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className={`text-sm font-bold ${vencido ? 'text-red-600' : urgente ? 'text-amber-600' : 'text-slate-900'}`}>
                          {formatMXNFull(Math.max(0, Number(a.monto) - Number((a as any).monto_pagado ?? 0)))}
                        </p>
                        {(a as any).estado === 'parcial' && (
                          <p className="text-[10px] text-amber-600 font-medium">Pago parcial</p>
                        )}
                      </div>
                    </li>
                  )
                })}
              </ul>
            )}

            <div className="px-5 py-3 border-t border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-3 text-xs text-slate-400">
                {adeudosVencidos.length > 0 && (
                  <span className="text-red-600 font-semibold">{adeudosVencidos.length} vencido{adeudosVencidos.length !== 1 ? 's' : ''}</span>
                )}
                {adeudosUrgentes.length > 0 && (
                  <span className="text-amber-600 font-semibold">{adeudosUrgentes.length} urgente{adeudosUrgentes.length !== 1 ? 's' : ''}</span>
                )}
              </div>
              <span className="text-base font-bold text-slate-900">{formatMXNFull(totalAdeudado)}</span>
            </div>
          </div>

          {/* Channel sources */}
          <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100">
              <p className="text-sm font-semibold text-slate-700">Fuentes de Ingreso</p>
              <p className="text-xs text-slate-400 mt-0.5">Conecta más canales para vista completa</p>
            </div>
            <div className="grid grid-cols-2 gap-3 p-4">

              {/* POS — live */}
              <div className="rounded-xl border border-violet-200 bg-violet-50 p-4 flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-700">
                    <Monitor className="w-3.5 h-3.5 text-violet-600" />POS Local
                  </div>
                  <span className="text-[10px] bg-violet-100 text-violet-600 border border-violet-200 px-2 py-0.5 rounded-full font-bold">EN VIVO</span>
                </div>
                <p className="text-xl font-bold text-slate-900 font-mono">{formatMXN(ingresosSemana)}</p>
                <div className="h-1 bg-violet-100 rounded-full overflow-hidden">
                  <div className="h-full bg-violet-500 rounded-full w-full" />
                </div>
                <p className="text-[10px] text-slate-500">{(ventasSemana ?? []).length} movimientos · 7 días</p>
              </div>

              {/* Tienda online — soon */}
              <ChannelSoon icon={<Globe className="w-3.5 h-3.5" />} name="Tienda Online" hint="Conecta tu tienda para ver ventas unificadas" />

              {/* Instagram — soon */}
              <ChannelSoon icon={<span className="text-sm">📱</span>} name="Instagram" hint="Ventas por DM y catálogo aquí" />

              {/* Marketplace — soon */}
              <ChannelSoon icon={<span className="text-sm">🛒</span>} name="Marketplace" hint="MercadoLibre u otros canales" />

            </div>
          </div>

        </div>

        {/* ── Margen por producto ───────────────────────────── */}
        {margenItems.length > 0 && (
          <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
              <div>
                <p className="text-sm font-semibold text-slate-700">Margen estimado por producto</p>
                <p className="text-xs text-slate-400 mt-0.5">Basado en el último precio de compra registrado</p>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-slate-100">
                    <th className="px-4 py-2.5 text-left text-[10px] font-semibold uppercase tracking-wide text-slate-400">Producto</th>
                    <th className="px-4 py-2.5 text-right text-[10px] font-semibold uppercase tracking-wide text-slate-400">Costo</th>
                    <th className="px-4 py-2.5 text-right text-[10px] font-semibold uppercase tracking-wide text-slate-400">Venta</th>
                    <th className="px-4 py-2.5 text-left text-[10px] font-semibold uppercase tracking-wide text-slate-400">Margen</th>
                    <th className="px-4 py-2.5 text-left text-[10px] font-semibold uppercase tracking-wide text-slate-400">Proveedor</th>
                  </tr>
                </thead>
                <tbody>
                  {margenItems.slice(0, 8).map((item, i) => {
                    const margenColor = item.margen >= 40 ? 'text-green-600'
                      : item.margen >= 20               ? 'text-amber-600'
                      : item.margen >= 0                ? 'text-red-500'
                      : 'text-red-700'
                    const barW = Math.max(0, Math.min(100, item.margen))
                    const barColor = item.margen >= 40 ? '#22c55e' : item.margen >= 20 ? '#f59e0b' : '#ef4444'
                    return (
                      <tr key={i} className="border-b border-slate-50 hover:bg-slate-50 transition-colors">
                        <td className="px-4 py-2.5">
                          <p className="text-xs font-semibold text-slate-800 truncate max-w-[180px]">{item.nombre}</p>
                          <p className="text-[10px] text-slate-400">{item.etiqueta}</p>
                        </td>
                        <td className="px-4 py-2.5 text-right text-xs text-slate-600 tabular-nums">
                          {formatMXNFull(item.costoUnit)}
                        </td>
                        <td className="px-4 py-2.5 text-right text-xs text-slate-600 tabular-nums">
                          {formatMXNFull(item.precioVenta)}
                        </td>
                        <td className="px-4 py-2.5">
                          <div className="flex items-center gap-2">
                            <div className="w-16 h-1.5 bg-slate-100 rounded-full overflow-hidden shrink-0">
                              <div className="h-full rounded-full" style={{ width: `${barW}%`, background: barColor }} />
                            </div>
                            <span className={`text-xs font-bold tabular-nums ${margenColor}`}>
                              {item.margen}%
                            </span>
                          </div>
                        </td>
                        <td className="px-4 py-2.5 text-xs text-slate-500 truncate max-w-[120px]">
                          {item.proveedor ?? <span className="text-slate-300">—</span>}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
            {margenItems.length === 0 && (
              <p className="px-5 py-8 text-sm text-slate-400 text-center">
                Registra precios de compra en las entradas de inventario para ver el margen.
              </p>
            )}
          </div>
        )}

        {/* ── Cortes de caja ────────────────────────────────── */}
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
            <div>
              <p className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                <Receipt className="w-3.5 h-3.5 text-violet-500" />
                Cortes de caja
              </p>
              <p className="text-xs text-slate-400 mt-0.5">
                {(cortesDB ?? []).length} corte{(cortesDB ?? []).length !== 1 ? 's' : ''} recientes
              </p>
            </div>
            <Link href="/corte" className="text-xs text-violet-600 font-medium hover:underline">
              Nuevo corte →
            </Link>
          </div>
          {!cortesDB || cortesDB.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-center px-6">
              <Receipt className="w-8 h-8 text-slate-200 mb-2" />
              <p className="text-sm text-slate-400">Sin cortes registrados aún</p>
              <Link href="/corte" className="mt-2 text-xs text-violet-600 font-semibold hover:underline">
                Hacer primer corte →
              </Link>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-slate-100">
                    <th className="px-4 py-2.5 text-left text-[10px] font-semibold uppercase tracking-wide text-slate-400">Fecha / Hora</th>
                    <th className="px-4 py-2.5 text-left text-[10px] font-semibold uppercase tracking-wide text-slate-400">Cajero</th>
                    <th className="px-4 py-2.5 text-center text-[10px] font-semibold uppercase tracking-wide text-slate-400">Ventas</th>
                    <th className="px-4 py-2.5 text-right text-[10px] font-semibold uppercase tracking-wide text-slate-400">Pagos</th>
                    <th className="px-4 py-2.5 text-right text-[10px] font-semibold uppercase tracking-wide text-slate-400">Total</th>
                    <th className="px-4 py-2.5 text-right text-[10px] font-semibold uppercase tracking-wide text-slate-400">Diferencia</th>
                  </tr>
                </thead>
                <tbody>
                  {(cortesDB ?? []).map((c: any) => {
                    const dif      = Number(c.diferencia)
                    const difColor = dif === 0       ? 'text-green-600'
                      : Math.abs(dif) <= 50          ? 'text-amber-600'
                      : dif > 0                      ? 'text-blue-600'
                      : 'text-red-600'
                    const difLabel = dif === 0
                      ? '✓ Cuadra'
                      : dif > 0 ? `+${formatMXNFull(dif)}` : formatMXNFull(dif)
                    const cajero   = c.cajero_id
                      ? (cajeroMap.get(c.cajero_id) ?? c.cajero_id.slice(0, 8))
                      : '—'
                    return (
                      <tr key={c.id} className="border-b border-slate-50 hover:bg-slate-50 transition-colors">
                        <td className="px-4 py-2.5 text-xs text-slate-600 tabular-nums whitespace-nowrap">
                          {formatCorteDate(c.created_at, now)}
                        </td>
                        <td className="px-4 py-2.5">
                          <span className="text-xs font-semibold text-slate-700 bg-slate-100 px-2 py-0.5 rounded-full">
                            {cajero}
                          </span>
                        </td>
                        <td className="px-4 py-2.5 text-center">
                          <span className="text-xs font-medium text-slate-700">
                            {c.num_transacciones}
                          </span>
                        </td>
                        <td className="px-4 py-2.5 text-right">
                          <div className="flex flex-col items-end gap-0.5">
                            {Number(c.total_efectivo) > 0 && (
                              <span className="text-xs tabular-nums">
                                <span className="text-[10px] text-green-600 font-medium mr-1">Ef.</span>
                                <span className="text-slate-700">{formatMXNFull(Number(c.total_efectivo))}</span>
                              </span>
                            )}
                            {Number(c.total_tarjeta) > 0 && (
                              <span className="text-xs tabular-nums">
                                <span className="text-[10px] text-blue-600 font-medium mr-1">Tarj.</span>
                                <span className="text-slate-700">{formatMXNFull(Number(c.total_tarjeta))}</span>
                              </span>
                            )}
                            {Number(c.total_transferencia) > 0 && (
                              <span className="text-xs tabular-nums">
                                <span className="text-[10px] text-violet-600 font-medium mr-1">Transf.</span>
                                <span className="text-slate-700">{formatMXNFull(Number(c.total_transferencia))}</span>
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-2.5 text-right text-xs font-semibold text-slate-800 tabular-nums whitespace-nowrap">
                          {formatMXNFull(Number(c.total_ventas))}
                        </td>
                        <td className={`px-4 py-2.5 text-right text-xs font-semibold tabular-nums whitespace-nowrap ${difColor}`}>
                          {difLabel}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* ── Activity log ──────────────────────────────────── */}
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100">
            <p className="text-sm font-semibold text-slate-700">Actividad reciente</p>
          </div>
          {!movimientos || movimientos.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-center">
              <RefreshCcw className="w-8 h-8 text-slate-200 mb-2" />
              <p className="text-sm text-slate-400">Sin movimientos registrados</p>
            </div>
          ) : (
            <ul className="divide-y divide-slate-50">
              {movimientos.map(m => {
                const meta  = TIPO_META[m.tipo] ?? TIPO_META.ajuste_positivo
                const diff  = m.qty_antes - m.qty_despues
                const signo = diff > 0 ? '−' : '+'
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const prod  = m.productos as any
                const quien = usuarioLabel(m.notas, m.canal)
                return (
                  <li key={m.id} className="flex items-center gap-3 px-5 py-3 hover:bg-slate-50 transition-colors">
                    <span className={`shrink-0 w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold ${meta.color}`}>
                      {meta.label.charAt(0)}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-slate-800 font-medium truncate">{prod?.nombre ?? '—'}</p>
                      <p className="text-xs text-slate-400">{meta.label} · {quien}</p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className={`text-sm font-semibold ${diff > 0 ? 'text-red-600' : 'text-green-600'}`}>
                        {signo}{Math.abs(diff)} {prod?.unidad ?? ''}
                      </p>
                      <p className="text-xs text-slate-400">{tiempoRelativo(m.created_at)}</p>
                    </div>
                  </li>
                )
              })}
            </ul>
          )}
        </div>

      </div>
    </AppShell>
  )
}

// ── Sub-components ─────────────────────────────────────────────

function KPI({ label, value, delta, accent, sub }: {
  label:  string
  value:  string
  delta:  { pct: number; label: string } | null
  accent: 'violet' | 'blue' | 'purple' | 'green' | 'red'
  sub:    string
}) {
  const bar = {
    violet: 'bg-violet-500',
    blue:   'bg-blue-500',
    purple: 'bg-purple-500',
    green:  'bg-green-500',
    red:    'bg-red-500',
  }[accent]

  const up   = delta && delta.pct >= 0
  const down = delta && delta.pct < 0

  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-4 relative overflow-hidden">
      <div className={`absolute top-0 left-0 right-0 h-0.5 ${bar} opacity-60`} />
      <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400 mb-2">{label}</p>
      <p className="text-2xl font-bold text-slate-900 font-mono leading-none mb-2">{value}</p>
      {delta !== null ? (
        <span className={`inline-flex items-center gap-1 text-[11px] font-semibold px-1.5 py-0.5 rounded ${
          up ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-600'
        }`}>
          {up ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
          {up ? '+' : ''}{delta.pct.toFixed(1)}%
        </span>
      ) : null}
      <p className="text-[10px] text-slate-400 mt-1">{sub}</p>
    </div>
  )
}

function AlertRow({ level, title, body }: { level: 'danger' | 'warn' | 'info'; title: string; body: string }) {
  const styles = {
    danger: { wrap: 'bg-red-50 border-red-200',    icon: '🔴', titleCls: 'text-red-800',    bodyCls: 'text-red-600'    },
    warn:   { wrap: 'bg-amber-50 border-amber-200', icon: '🟡', titleCls: 'text-amber-800',  bodyCls: 'text-amber-600'  },
    info:   { wrap: 'bg-blue-50 border-blue-200',   icon: '🔵', titleCls: 'text-blue-800',   bodyCls: 'text-blue-600'   },
  }[level]

  return (
    <div className={`flex items-start gap-2.5 p-2.5 rounded-xl border ${styles.wrap}`}>
      <span className="text-sm mt-0.5 shrink-0">{styles.icon}</span>
      <div>
        <p className={`text-xs font-semibold ${styles.titleCls}`}>{title}</p>
        <p className={`text-[11px] ${styles.bodyCls} mt-0.5`}>{body}</p>
      </div>
    </div>
  )
}

function ChannelSoon({ icon, name, hint }: { icon: React.ReactNode; name: string; hint: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 flex flex-col gap-2 opacity-60">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-600">
          {icon}{name}
        </div>
        <span className="text-[10px] bg-slate-200 text-slate-500 px-2 py-0.5 rounded-full font-semibold">Próximo</span>
      </div>
      <div className="flex flex-col items-center justify-center py-3 text-center gap-1">
        <Globe className="w-5 h-5 text-slate-300" />
        <p className="text-[10px] text-slate-400">{hint}</p>
      </div>
    </div>
  )
}
