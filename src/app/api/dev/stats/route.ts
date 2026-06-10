import { NextResponse } from 'next/server'
import { createClient }      from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

async function verifyDeveloper() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || user.app_metadata?.role !== 'developer') return null
  return user
}

const TABLES = [
  'productos', 'producto_colores', 'stock_ledger',
  'ventas', 'venta_items', 'cortes_caja',
  'proveedores', 'adeudos', 'pagos_proveedor', 'costos_fijos',
]

export async function GET() {
  if (!await verifyDeveloper()) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const admin = createAdminClient()
  const counts: Record<string, number> = {}

  await Promise.all(
    TABLES.map(async table => {
      const { count } = await admin
        .from(table)
        .select('*', { count: 'exact', head: true })
      counts[table] = count ?? 0
    })
  )

  const { data: { users } } = await admin.auth.admin.listUsers({ perPage: 100 })

  return NextResponse.json({
    tables:    counts,
    userCount: users?.length ?? 0,
    env:       process.env.VERCEL_ENV ?? 'local',
    url:       (process.env.NEXT_PUBLIC_SUPABASE_URL ?? '').replace('https://', '').split('.')[0],
  })
}
