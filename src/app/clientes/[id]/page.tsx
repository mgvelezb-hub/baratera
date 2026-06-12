import { createAdminClient } from '@/lib/supabase/admin'
import { requirePermiso }    from '@/lib/permisos-server'
import AppShell              from '@/components/AppShell'
import Link                  from 'next/link'
import { notFound }          from 'next/navigation'
import { ArrowLeft, User, Phone, Mail, FileText, Tag } from 'lucide-react'
import type { Cliente }      from '@/lib/types'

export const dynamic = 'force-dynamic'

function formatMXN(n: number) {
  return new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 0 }).format(n)
}

function formatFecha(iso: string) {
  return new Date(iso).toLocaleDateString('es-MX', {
    timeZone: 'America/Mexico_City',
    day: 'numeric', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

const TIPO_BADGE: Record<string, string> = {
  frecuente: 'bg-blue-50 text-blue-700',
  mayorista: 'bg-amber-50 text-amber-700',
}

const METODO_LABEL: Record<string, string> = {
  efectivo:      'Efectivo',
  tarjeta:       'Tarjeta',
  transferencia: 'SPEI',
  mixto:         'Mixto',
}

export default async function ClienteDetallePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  await requirePermiso('clientes.ver')
  const admin = createAdminClient()

  const [{ data: cliente }, { data: tickets }] = await Promise.all([
    admin.from('clientes').select('*').eq('id', id).single(),
    admin.from('ventas')
      .select('id, total, cupon_pct, descuento, numero_ticket, metodo, created_at, venta_items(cantidad, precio_unitario, subtotal, productos(nombre))')
      .eq('cliente_id', id)
      .order('created_at', { ascending: false })
      .limit(100),
  ])

  if (!cliente) notFound()

  const c           = cliente as Cliente
  const totalGastado = (tickets ?? []).reduce((s: number, v: any) => s + Number(v.total), 0)

  return (
    <AppShell>
      <div className="p-4 md:p-6 max-w-3xl mx-auto">

        <Link href="/clientes" className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700 mb-5">
          <ArrowLeft size={15} /> Clientes
        </Link>

        {/* Card info cliente */}
        <div className="bg-white rounded-xl border border-slate-200 p-5 mb-6">
          <div className="flex items-start justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-violet-100 rounded-full flex items-center justify-center shrink-0">
                <User size={17} className="text-violet-600" />
              </div>
              <div>
                <h1 className="font-bold text-slate-800 text-lg leading-tight">{c.nombre}</h1>
                <span className="font-mono text-xs text-violet-600 font-semibold">{c.numero_cliente}</span>
              </div>
            </div>
            <span className={`text-xs px-2.5 py-1 rounded-full font-medium capitalize ${TIPO_BADGE[c.tipo] ?? ''}`}>
              {c.tipo}
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-sm text-slate-600">
            <div className="flex items-center gap-2">
              <Phone size={13} className="text-slate-400 shrink-0" />
              {c.telefono}
            </div>
            {c.correo && (
              <div className="flex items-center gap-2">
                <Mail size={13} className="text-slate-400 shrink-0" />
                {c.correo}
              </div>
            )}
            <div className="flex items-center gap-2">
              <Tag size={13} className="text-slate-400 shrink-0" />
              {c.recibe_promo ? 'Recibe promociones' : 'No recibe promociones'}
            </div>
            {c.notas && (
              <div className="flex items-start gap-2 col-span-full">
                <FileText size={13} className="text-slate-400 mt-0.5 shrink-0" />
                <span className="text-slate-500">{c.notas}</span>
              </div>
            )}
          </div>

          <div className="mt-4 pt-4 border-t border-slate-100 flex gap-6 text-sm">
            <div>
              <p className="text-slate-400 text-xs mb-0.5">Total compras</p>
              <p className="font-bold text-slate-800">{tickets?.length ?? 0} tickets</p>
            </div>
            <div>
              <p className="text-slate-400 text-xs mb-0.5">Total gastado</p>
              <p className="font-bold text-green-700">{formatMXN(totalGastado)}</p>
            </div>
          </div>
        </div>

        {/* Historial de tickets */}
        <h2 className="text-sm font-semibold text-slate-700 mb-3">Historial de tickets</h2>
        {!tickets?.length ? (
          <div className="text-center py-10 text-slate-400 text-sm bg-white rounded-xl border border-slate-200">
            Aún no hay compras registradas para este cliente
          </div>
        ) : (
          <div className="space-y-2">
            {(tickets as any[]).map(t => (
              <details key={t.id} className="bg-white rounded-xl border border-slate-200 group">
                <summary className="flex items-center justify-between px-4 py-3 cursor-pointer list-none hover:bg-slate-50 rounded-xl select-none">
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="font-mono text-xs text-violet-600 font-semibold shrink-0">
                      {t.numero_ticket ?? '—'}
                    </span>
                    <span className="text-xs text-slate-500 truncate">{formatFecha(t.created_at)}</span>
                    {t.cupon_pct && (
                      <span className="text-xs bg-green-50 text-green-700 px-1.5 py-0.5 rounded font-medium shrink-0">
                        -{t.cupon_pct}% Off
                      </span>
                    )}
                    <span className="text-xs text-slate-400 shrink-0">{METODO_LABEL[t.metodo] ?? t.metodo}</span>
                  </div>
                  <span className="font-bold text-slate-800 shrink-0 ml-3">{formatMXN(Number(t.total))}</span>
                </summary>
                <div className="px-4 pb-3 border-t border-slate-100 pt-2">
                  {t.cupon_pct && t.descuento && (
                    <p className="text-xs text-green-600 mb-2 font-medium">
                      Descuento {t.cupon_pct}% Off: −{formatMXN(Number(t.descuento))}
                    </p>
                  )}
                  <ul className="text-xs text-slate-600 space-y-1">
                    {(t.venta_items ?? []).map((item: any, i: number) => (
                      <li key={i} className="flex justify-between">
                        <span className="truncate mr-2">{item.productos?.nombre ?? '—'} × {item.cantidad}</span>
                        <span className="shrink-0 font-medium">{formatMXN(Number(item.subtotal))}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </details>
            ))}
          </div>
        )}

      </div>
    </AppShell>
  )
}
