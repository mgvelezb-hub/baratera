import { createAdminClient } from '@/lib/supabase/admin'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const admin = createAdminClient()

  const [{ data: cliente }, { data: tickets }] = await Promise.all([
    admin.from('clientes').select('*').eq('id', id).single(),
    admin.from('ventas')
      .select('id, total, cupon_pct, descuento, numero_ticket, metodo, created_at, venta_items(cantidad, precio_unitario, subtotal, productos(nombre))')
      .eq('cliente_id', id)
      .order('created_at', { ascending: false })
      .limit(100),
  ])

  if (!cliente) return NextResponse.json({ error: 'not found' }, { status: 404 })
  return NextResponse.json({ cliente, tickets: tickets ?? [] })
}
