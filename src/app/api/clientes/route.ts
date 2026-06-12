import { createAdminClient } from '@/lib/supabase/admin'
import { NextRequest, NextResponse } from 'next/server'

export async function GET() {
  const admin = createAdminClient()
  const { data, error } = await admin
    .from('clientes')
    .select('*')
    .order('nombre')
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(req: NextRequest) {
  const body = await req.json()
  const { nombre, telefono, correo, recibe_promo, tipo, notas } = body

  if (!nombre?.trim()) return NextResponse.json({ error: 'nombre requerido' }, { status: 400 })
  if (!telefono?.trim()) return NextResponse.json({ error: 'telefono requerido' }, { status: 400 })

  const admin = createAdminClient()

  // Generar numero_cliente basado en el último registro
  const { data: lastRow } = await admin
    .from('clientes')
    .select('numero_cliente')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  const lastNum = lastRow?.numero_cliente
    ? parseInt(lastRow.numero_cliente.replace('CLI-', ''), 10)
    : 0
  const numero_cliente = `CLI-${String(lastNum + 1).padStart(4, '0')}`

  const { data, error } = await admin
    .from('clientes')
    .insert({
      nombre:       nombre.trim(),
      telefono:     telefono.trim(),
      correo:       correo?.trim() || null,
      recibe_promo: recibe_promo ?? false,
      tipo:         tipo ?? 'frecuente',
      notas:        notas?.trim() || null,
      numero_cliente,
    })
    .select('*')
    .single()

  if (error) {
    if (error.code === '23505') {
      return NextResponse.json({ error: 'El teléfono ya está registrado' }, { status: 409 })
    }
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json(data, { status: 201 })
}
