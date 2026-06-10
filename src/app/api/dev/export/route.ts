import { NextRequest, NextResponse } from 'next/server'
import { createClient }      from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { logAudit } from '@/lib/audit'

async function verifyDeveloper() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || user.app_metadata?.role !== 'developer') return null
  return user
}

const TABLAS_EXPORTABLES = [
  'productos', 'producto_colores', 'stock_ledger',
  'ventas', 'venta_items', 'cortes_caja',
  'proveedores', 'adeudos', 'pagos_proveedor', 'costos_fijos',
  'roles', 'configuracion', 'auditoria',
]

const PAGE_SIZE = 1000
const MAX_ROWS  = 50_000

function toCsv(rows: Record<string, unknown>[]): string {
  if (rows.length === 0) return ''
  const cols = Object.keys(rows[0])
  const escape = (v: unknown): string => {
    if (v === null || v === undefined) return ''
    const s = typeof v === 'object' ? JSON.stringify(v) : String(v)
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
  }
  const lines = [cols.join(',')]
  for (const row of rows) {
    lines.push(cols.map(c => escape(row[c])).join(','))
  }
  return lines.join('\n')
}

export async function GET(req: NextRequest) {
  const caller = await verifyDeveloper()
  if (!caller) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const table  = req.nextUrl.searchParams.get('table') ?? ''
  const format = req.nextUrl.searchParams.get('format') ?? 'csv'

  if (!TABLAS_EXPORTABLES.includes(table)) {
    return NextResponse.json({ error: 'Tabla inválida' }, { status: 400 })
  }
  if (!['csv', 'json'].includes(format)) {
    return NextResponse.json({ error: 'Formato inválido: csv|json' }, { status: 400 })
  }

  const admin = createAdminClient()
  const rows: Record<string, unknown>[] = []

  for (let from = 0; from < MAX_ROWS; from += PAGE_SIZE) {
    const { data, error } = await admin
      .from(table)
      .select('*')
      .range(from, from + PAGE_SIZE - 1)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    rows.push(...(data ?? []))
    if (!data || data.length < PAGE_SIZE) break
  }

  await logAudit('datos.exportados', { table, format, filas: rows.length }, caller.email)

  const fecha    = new Date().toISOString().split('T')[0]
  const filename = `baratera_${table}_${fecha}.${format}`
  const body     = format === 'csv' ? toCsv(rows) : JSON.stringify(rows, null, 2)

  return new NextResponse(body, {
    headers: {
      'Content-Type':        format === 'csv' ? 'text/csv; charset=utf-8' : 'application/json',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  })
}
