import { createClient } from '@/lib/supabase/server'
import AppShell from '@/components/AppShell'
import SalesChart from './SalesChart'
import type { ChartDay } from './SalesChart'
import { calcularSemaforo } from '@/lib/types'
import {
  ShoppingCart, TrendingUp, AlertTriangle, Package,
  ArrowDownRight, ArrowUpRight, Settings2, RefreshCcw,
  RotateCcw,
} from 'lucide-react'
import Link from 'next/link'

// ── Helpers ────────────────────────────────────────────────────
const TIPO_META: Record<string, { label: string; color: string }> = {
  salida_venta_manual:      { label: 'Venta',         color: 'text-violet-600 bg-violet-50' },
  entrada_compra:           { label: 'Entrada',        color: 'text-green-600 bg-green-50'  },
  ajuste_positivo:          { label: 'Ajuste (+)',     color: 'text-blue-600 bg-blue-50'    },
  ajuste_negativo:          { label: 'Ajuste (−)',     color: 'text-amber-600 bg-amber-50'  },
  devolucion:               { label: 'Devolución',     color: 'text-purple-600 bg-purple-50'},
  levantamiento_inventario: { label: 'Levantamiento',  color: 'text-slate-600 bg-slate-100' },
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

// ── Page ───────────────────────────────────────────────────────
export const revalidate = 60

export default async function DashboardPage() {
  const supabase = await createClient()

  const now        = new Date()
  const todayStr   = now.toISOString().split('T')[0]
  const todayStart = `${todayStr}T00:00:00`
  const sevenAgo   = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString()

  const [
    { data: ventasHoy },
    { data: entradasHoy },
    { data: ventasSemana },
    { data: productos },
    { data: movimientos },
  ] = await Promise.all([
    supabase.from('stock_ledger').select('qty_antes, qty_despues').eq('tipo', 'salida_venta_manual').gte('created_at', todayStart),
    supabase.from('stock_ledger').select('id').eq('tipo', 'entrada_compra').gte('created_at', todayStart),
    supabase.from('stock_ledger').select('created_at, qty_antes, qty_despues').eq('tipo', 'salida_venta_manual').gte('created_at', sevenAgo),
    supabase.from('productos').select('id, nombre, stock_fisico, stock_minimo, unidad').eq('activo', true).order('stock_fisico', { ascending: true }),
    supabase.from('stock_ledger').select('id, tipo, qty_antes, qty_despues, notas, canal, created_at, productos(nombre, unidad)').order('created_at', { ascending: false }).limit(20),
  ])

  const transaccionesHoy  = ventasHoy?.length ?? 0
  const piezasHoy         = ventasHoy?.reduce((a, v) => a + (v.qty_antes - v.qty_despues), 0) ?? 0
  const entradasCount     = entradasHoy?.length ?? 0
  const productosAlerta   = (productos ?? []).filter(p => p.stock_fisico < p.stock_minimo)
  const totalActivos      = productos?.length ?? 0

  const chartData: ChartDay[] = Array.from({ length: 7 }, (_, i) => {
    const d          = new Date(now.getTime() - (6 - i) * 24 * 60 * 60 * 1000)
    const datePrefix = d.toISOString().split('T')[0]
    const dayVentas  = (ventasSemana ?? []).filter(v => v.created_at.startsWith(datePrefix))
    return {
      fecha:         d.toLocaleDateString('es-MX', { weekday: 'short', day: 'numeric' }),
      transacciones: dayVentas.length,
      piezas:        dayVentas.reduce((a, v) => a + (v.qty_antes - v.qty_despues), 0),
    }
  })

  const fechaLabel = now.toLocaleDateString('es-MX', {
    weekday: 'long', day: 'numeric', month: 'long',
  })

  return (
    <AppShell>
      <div className="px-4 py-5 max-w-5xl mx-auto space-y-5">

        {/* Header */}
        <div>
          <h1 className="text-xl font-bold text-slate-900">Dashboard</h1>
          <p className="text-sm text-slate-500 capitalize">{fechaLabel}</p>
        </div>

        {/* ── KPI cards ────────────────────────────────────── */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <KPICard
            label="Ventas hoy"
            value={transaccionesHoy}
            suffix="transacciones"
            icon={<ShoppingCart className="w-5 h-5" />}
            color="violet"
          />
          <KPICard
            label="Piezas vendidas"
            value={piezasHoy}
            suffix="unidades hoy"
            icon={<ArrowDownRight className="w-5 h-5" />}
            color="blue"
          />
          <KPICard
            label="Entradas hoy"
            value={entradasCount}
            suffix="compras a proveedor"
            icon={<TrendingUp className="w-5 h-5" />}
            color="green"
          />
          <KPICard
            label="Stock crítico"
            value={productosAlerta.length}
            suffix={`de ${totalActivos} activos`}
            icon={<AlertTriangle className="w-5 h-5" />}
            color={productosAlerta.length > 0 ? 'red' : 'slate'}
          />
        </div>

        {/* ── Sales chart ───────────────────────────────────── */}
        <div className="bg-white rounded-2xl border border-slate-200 p-5">
          <p className="text-sm font-semibold text-slate-700 mb-4">Ventas últimos 7 días</p>
          <SalesChart data={chartData} />
        </div>

        {/* ── Bottom grid ───────────────────────────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

          {/* Stock crítico */}
          <div className="bg-white rounded-2xl border border-slate-200">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
              <p className="text-sm font-semibold text-slate-700">Stock crítico</p>
              <Link href="/inventario" className="text-xs text-violet-600 hover:underline font-medium">
                Ver inventario →
              </Link>
            </div>

            {productosAlerta.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 px-4 text-center">
                <Package className="w-8 h-8 text-slate-200 mb-2" />
                <p className="text-sm text-slate-500 font-medium">¡Todo el stock está OK!</p>
              </div>
            ) : (
              <ul className="divide-y divide-slate-100">
                {productosAlerta.slice(0, 8).map(p => {
                  const sem = calcularSemaforo(p.stock_fisico, p.stock_minimo)
                  return (
                    <li key={p.id}>
                      <Link
                        href={`/inventario/${p.id}`}
                        className="flex items-center justify-between px-5 py-3 hover:bg-slate-50 transition-colors"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <span className={`w-2 h-2 rounded-full shrink-0 ${
                            sem === 'rojo' ? 'bg-red-500' : 'bg-amber-400'
                          }`} />
                          <p className="text-sm text-slate-800 font-medium truncate">{p.nombre}</p>
                        </div>
                        <div className="text-right shrink-0 ml-3">
                          <p className={`text-sm font-bold ${sem === 'rojo' ? 'text-red-600' : 'text-amber-600'}`}>
                            {p.stock_fisico}
                            <span className="text-xs font-normal text-slate-400 ml-1">{p.unidad}</span>
                          </p>
                          <p className="text-xs text-slate-400">mín {p.stock_minimo}</p>
                        </div>
                      </Link>
                    </li>
                  )
                })}
                {productosAlerta.length > 8 && (
                  <li className="px-5 py-3 text-xs text-slate-400 text-center">
                    +{productosAlerta.length - 8} más en inventario
                  </li>
                )}
              </ul>
            )}
          </div>

          {/* Actividad reciente */}
          <div className="bg-white rounded-2xl border border-slate-200">
            <div className="px-5 py-4 border-b border-slate-100">
              <p className="text-sm font-semibold text-slate-700">Actividad reciente</p>
            </div>

            {!movimientos || movimientos.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 px-4 text-center">
                <RefreshCcw className="w-8 h-8 text-slate-200 mb-2" />
                <p className="text-sm text-slate-500">Sin movimientos registrados</p>
              </div>
            ) : (
              <ul className="divide-y divide-slate-100">
                {movimientos.map(m => {
                  const meta  = TIPO_META[m.tipo] ?? TIPO_META.ajuste_positivo
                  const diff  = m.qty_antes - m.qty_despues
                  const signo = diff > 0 ? '−' : '+'
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  const prod  = m.productos as any
                  const quien = usuarioLabel(m.notas, m.canal)

                  return (
                    <li key={m.id} className="flex items-center gap-3 px-5 py-3">
                      <span className={`shrink-0 w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold ${meta.color}`}>
                        {meta.label.charAt(0)}
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-slate-800 font-medium truncate">
                          {prod?.nombre ?? '—'}
                        </p>
                        <p className="text-xs text-slate-400">
                          {meta.label} · {quien}
                        </p>
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
      </div>
    </AppShell>
  )
}

// ── KPI Card component ─────────────────────────────────────────
function KPICard({ label, value, suffix, icon, color }: {
  label: string
  value: number
  suffix: string
  icon: React.ReactNode
  color: 'violet' | 'blue' | 'green' | 'red' | 'slate'
}) {
  const palette = {
    violet: 'bg-violet-50 text-violet-600',
    blue:   'bg-blue-50 text-blue-600',
    green:  'bg-green-50 text-green-600',
    red:    'bg-red-50 text-red-600',
    slate:  'bg-slate-100 text-slate-500',
  }
  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-4">
      <div className={`w-9 h-9 rounded-xl flex items-center justify-center mb-3 ${palette[color]}`}>
        {icon}
      </div>
      <p className="text-2xl font-bold text-slate-900">{value}</p>
      <p className="text-sm font-medium text-slate-600 mt-0.5">{label}</p>
      <p className="text-xs text-slate-400">{suffix}</p>
    </div>
  )
}
