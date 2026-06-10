import { NextRequest, NextResponse } from 'next/server'
import { createClient }      from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

async function verifyDeveloper() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || user.app_metadata?.role !== 'developer') return null
  return user
}

// Orden importa: hay que borrar tablas hijas antes que las padre
const OPS: Record<string, string[]> = {
  ventas:      ['venta_items', 'ventas'],
  cortes:      ['cortes_caja'],
  adeudos:     ['pagos_proveedor', 'adeudos'],
  costos:      ['costos_fijos'],
  ledger:      ['stock_ledger'],
  proveedores: ['pagos_proveedor', 'adeudos', 'proveedores'],
  productos:   ['stock_ledger', 'venta_items', 'ventas', 'producto_colores', 'productos'],
  todo:        [
    'stock_ledger', 'venta_items', 'ventas', 'cortes_caja',
    'pagos_proveedor', 'adeudos', 'costos_fijos',
    'producto_colores', 'productos', 'proveedores',
  ],
}

export async function POST(req: NextRequest) {
  if (!await verifyDeveloper()) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { module } = await req.json()
  const tables = OPS[module]
  if (!tables) {
    return NextResponse.json({ error: `Módulo inválido. Usa: ${Object.keys(OPS).join('|')}` }, { status: 400 })
  }

  const admin = createAdminClient()
  const results: Record<string, string> = {}

  for (const table of tables) {
    // Filtramos por id != uuid-cero para que Supabase no bloquee el DELETE sin filtro
    const { error } = await admin
      .from(table)
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000')

    results[table] = error ? `ERROR: ${error.message}` : 'OK'
  }

  return NextResponse.json({ ok: true, module, results })
}
