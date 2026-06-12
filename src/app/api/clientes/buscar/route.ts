import { createAdminClient } from '@/lib/supabase/admin'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get('q')?.trim()
  if (!q) return NextResponse.json(null)

  const admin = createAdminClient()

  // Buscar primero por teléfono exacto, luego por numero_cliente
  const [{ data: porTelefono }, { data: porNumero }] = await Promise.all([
    admin.from('clientes').select('*').eq('telefono', q).maybeSingle(),
    admin.from('clientes').select('*').ilike('numero_cliente', `%${q}%`).limit(1).maybeSingle(),
  ])

  return NextResponse.json(porTelefono ?? porNumero ?? null)
}
