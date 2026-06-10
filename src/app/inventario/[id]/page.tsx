export const dynamic = 'force-dynamic'

import { notFound } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Package } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import AppShell from '@/components/AppShell'
import { calcularSemaforo } from '@/lib/types'
import { formatMXN, formatFecha } from '@/lib/utils'
import SemaforoBadge from '@/components/Semaforobadge'
import ProductoDetailClient from './ProductoDetailClient'

export default async function ProductoDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()

  const [{ data: producto }, { data: ledger }] = await Promise.all([
    supabase.from('productos').select('*').eq('id', id).single(),
    supabase
      .from('stock_ledger')
      .select('*')
      .eq('producto_id', id)
      .order('created_at', { ascending: false })
      .limit(50),
  ])

  if (!producto) notFound()

  const semaforo = calcularSemaforo(producto.stock_fisico, producto.stock_minimo)

  return (
    <AppShell>
      <main className="max-w-3xl mx-auto px-4 py-6">
        {/* Back */}
        <Link href="/inventario" className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700 mb-5">
          <ArrowLeft className="w-4 h-4" />
          Volver al inventario
        </Link>

        {/* Product header */}
        <div className="bg-white rounded-2xl border border-slate-200 p-5 mb-5">
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap mb-1">
                {producto.categoria && (
                  <span className="text-xs bg-violet-50 text-violet-600 border border-violet-200 px-2 py-0.5 rounded-full">
                    {producto.categoria}
                  </span>
                )}
                {producto.sku && (
                  <span className="text-xs text-slate-400">{producto.sku}</span>
                )}
              </div>
              <h1 className="text-lg font-semibold text-slate-900">{producto.nombre}</h1>
              {producto.descripcion && (
                <p className="text-sm text-slate-500 mt-1">{producto.descripcion}</p>
              )}
            </div>
            <SemaforoBadge semaforo={semaforo} size="md" />
          </div>

          {/* Stats */}
          <div className="grid grid-cols-3 gap-4 mt-5 pt-5 border-t border-slate-100">
            <div>
              <p className="text-xs text-slate-400 mb-1">Stock actual</p>
              <p className={`text-2xl font-bold ${semaforo === 'rojo' ? 'text-red-600' : semaforo === 'amarillo' ? 'text-amber-600' : 'text-slate-900'}`}>
                {producto.stock_fisico}
                <span className="text-sm font-normal text-slate-400 ml-1">{producto.unidad}</span>
              </p>
            </div>
            <div>
              <p className="text-xs text-slate-400 mb-1">Mínimo</p>
              <p className="text-2xl font-bold text-slate-900">
                {producto.stock_minimo}
                <span className="text-sm font-normal text-slate-400 ml-1">{producto.unidad}</span>
              </p>
            </div>
            <div>
              <p className="text-xs text-slate-400 mb-1">Precio</p>
              <p className="text-lg font-bold text-slate-900">{formatMXN(producto.precio_menudeo)}</p>
              {producto.precio_mayoreo && (
                <p className="text-xs text-slate-400">{formatMXN(producto.precio_mayoreo)} mayoreo</p>
              )}
            </div>
          </div>
        </div>

        {/* Client component with actions */}
        <ProductoDetailClient producto={producto} />

        {/* Ledger */}
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden mt-5">
          <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-900">Historial de movimientos</h2>
            <span className="text-xs text-slate-400">{ledger?.length ?? 0} registros</span>
          </div>

          {!ledger || ledger.length === 0 ? (
            <div className="py-10 text-center">
              <Package className="w-8 h-8 text-slate-200 mx-auto mb-2" />
              <p className="text-sm text-slate-400">Sin movimientos registrados</p>
            </div>
          ) : (
            <ul className="divide-y divide-slate-100">
              {ledger.map(entry => {
                const esSalida = entry.diferencia < 0
                const esLevantamiento = entry.tipo === 'levantamiento_inventario'

                return (
                  <li key={entry.id} className="px-5 py-3 flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={`text-xs font-semibold ${
                          esLevantamiento ? 'text-blue-600' :
                          esSalida ? 'text-amber-600' :
                          'text-green-600'
                        }`}>
                          {entry.tipo.replace(/_/g, ' ')}
                        </span>
                        {entry.canal && entry.canal !== 'manual' && (
                          <span className="text-xs bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded">
                            {entry.canal}
                          </span>
                        )}
                      </div>
                      {entry.notas && (
                        <p className="text-xs text-slate-500 mt-0.5 line-clamp-1">{entry.notas}</p>
                      )}
                      <p className="text-xs text-slate-400 mt-0.5">{formatFecha(entry.created_at)}</p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className={`text-sm font-semibold ${
                        esLevantamiento ? 'text-blue-600' :
                        esSalida ? 'text-red-600' :
                        'text-green-600'
                      }`}>
                        {esLevantamiento ? `= ${entry.qty_despues}` :
                         esSalida ? `− ${Math.abs(entry.diferencia)}` :
                         `+ ${entry.diferencia}`}
                      </p>
                      <p className="text-xs text-slate-400">
                        {entry.qty_antes} → {entry.qty_despues}
                      </p>
                    </div>
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      </main>
    </AppShell>
  )
}
