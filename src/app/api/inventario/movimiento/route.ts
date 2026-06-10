import { NextRequest, NextResponse } from 'next/server'
import { createClient }      from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function POST(req: NextRequest) {
  // Verify authenticated session
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  const body = await req.json()
  const {
    producto_id,
    tipo,
    qty_antes,
    qty_despues,
    notas,
    canal = 'manual',
    color_variante,
    proveedor_id,
    precio_unitario,
    color_id,
    color_stock_nuevo,
  } = body

  if (!producto_id || !tipo || qty_despues === undefined || qty_antes === undefined) {
    return NextResponse.json({ error: 'Faltan campos requeridos' }, { status: 400 })
  }

  const admin = createAdminClient()

  // 1. INSERT stock_ledger (append-only)
  const { error: ledgerError } = await admin.from('stock_ledger').insert({
    producto_id,
    tipo,
    qty_antes,
    qty_despues,
    notas:           notas || null,
    canal,
    usuario_id:      user.id,
    color_variante:  color_variante || null,
    proveedor_id:    proveedor_id   || null,
    precio_unitario: precio_unitario ?? null,
  })

  if (ledgerError) {
    return NextResponse.json({ error: 'Error al registrar movimiento', detail: ledgerError.message }, { status: 500 })
  }

  // 2. UPDATE productos.stock_fisico (service role bypasses RLS)
  const { data: updated, error: updateError } = await admin.from('productos')
    .update({ stock_fisico: qty_despues })
    .eq('id', producto_id)
    .select('id')

  if (updateError || !updated?.length) {
    return NextResponse.json(
      { error: 'Movimiento guardado pero error al actualizar stock', detail: updateError?.message },
      { status: 500 }
    )
  }

  // 3. UPDATE producto_colores.stock si aplica
  if (color_id && color_stock_nuevo !== undefined) {
    await admin.from('producto_colores')
      .update({ stock: color_stock_nuevo })
      .eq('id', color_id)
  }

  return NextResponse.json({ ok: true, qty_despues })
}
