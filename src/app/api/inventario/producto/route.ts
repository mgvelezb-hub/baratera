import { NextRequest, NextResponse } from 'next/server'
import { createClient }      from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

async function getUser() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  return user
}

// ── PATCH: guardar cambios de producto (campos + colores) ────────────────────
export async function PATCH(req: NextRequest) {
  const user = await getUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const {
    id,
    fields,
    colorStockChanges,   // Array<{ color_id, color_nombre, old_stock, new_stock }>
    currentStockFisico,  // stock_fisico actual antes de cambios de color
    stockFisicoFinal,    // stock_fisico resultante (si hay cambios de color)
    colorMinChanges,     // Array<{ color_id, new_min: number | null }>
  } = await req.json()

  if (!id || !fields) return NextResponse.json({ error: 'Faltan campos' }, { status: 400 })

  const admin = createAdminClient()

  // 1. Actualizar campos del producto
  const { error: updateError } = await admin.from('productos').update(fields).eq('id', id)
  if (updateError) {
    return NextResponse.json({ error: 'Error al actualizar producto', detail: updateError.message }, { status: 500 })
  }

  // 2. Cambios de stock por color (crea entradas en ledger)
  if (colorStockChanges?.length) {
    let stockActual = currentStockFisico ?? 0
    for (const c of colorStockChanges) {
      const delta = c.new_stock - c.old_stock
      const tipo  = delta > 0 ? 'ajuste_positivo' : 'ajuste_negativo'
      const stockDespues = stockActual + delta

      await admin.from('stock_ledger').insert({
        producto_id:    id,
        tipo,
        qty_antes:      stockActual,
        qty_despues:    stockDespues,
        notas:          `Ajuste manual color ${c.color_nombre}`,
        canal:          'manual',
        usuario_id:     user.id,
        color_variante: c.color_nombre,
      })
      await admin.from('producto_colores').update({ stock: c.new_stock }).eq('id', c.color_id)
      stockActual = stockDespues
    }
    await admin.from('productos').update({ stock_fisico: stockFisicoFinal ?? stockActual }).eq('id', id)
  } else if (stockFisicoFinal !== undefined) {
    // Actualización directa de stock_fisico sin cambios de color (ej: agregar colores con stock inicial)
    await admin.from('productos').update({ stock_fisico: stockFisicoFinal }).eq('id', id)
  }

  // 3. Cambios de stock_minimo por color
  if (colorMinChanges?.length) {
    for (const c of colorMinChanges) {
      await admin.from('producto_colores').update({ stock_minimo: c.new_min }).eq('id', c.color_id)
    }
  }

  return NextResponse.json({ ok: true })
}

// ── DELETE: desactivar o eliminar producto ───────────────────────────────────
export async function DELETE(req: NextRequest) {
  const user = await getUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const { id, action } = await req.json()
  if (!id || !action) return NextResponse.json({ error: 'Faltan campos' }, { status: 400 })

  const admin = createAdminClient()

  if (action === 'deactivate') {
    const { error } = await admin.from('productos').update({ activo: false }).eq('id', id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true })
  }

  if (action === 'delete') {
    await admin.from('producto_colores').delete().eq('producto_id', id)
    await admin.from('stock_ledger').delete().eq('producto_id', id)
    const { error } = await admin.from('productos').delete().eq('id', id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true })
  }

  return NextResponse.json({ error: 'Acción no válida' }, { status: 400 })
}

// ── PUT: actualizar color (nombre/hex) ───────────────────────────────────────
export async function PUT(req: NextRequest) {
  const user = await getUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const { color_id, nombre, hex } = await req.json()
  if (!color_id) return NextResponse.json({ error: 'Falta color_id' }, { status: 400 })

  const admin = createAdminClient()
  const { error } = await admin.from('producto_colores')
    .update({ nombre, hex })
    .eq('id', color_id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
