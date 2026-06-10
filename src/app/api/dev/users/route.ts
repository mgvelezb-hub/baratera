import { NextRequest, NextResponse } from 'next/server'
import { createClient }      from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

async function verifyDeveloper() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || user.app_metadata?.role !== 'developer') return null
  return user
}

export async function GET() {
  if (!await verifyDeveloper()) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const admin = createAdminClient()
  const { data: { users }, error } = await admin.auth.admin.listUsers({ perPage: 100 })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const result = users.map(u => ({
    id:             u.id,
    email:          u.email ?? '',
    role:           (u.app_metadata as Record<string, string> | null)?.role ?? null,
    lastSignIn:     u.last_sign_in_at ?? null,
    createdAt:      u.created_at,
    emailConfirmed: !!u.email_confirmed_at,
  }))

  // Ordenar: developer primero, luego admin, encargado, cajero, sin rol
  const ORDER: Record<string, number> = { developer: 0, admin: 1, encargado: 2, cajero: 3 }
  result.sort((a, b) => (ORDER[a.role ?? ''] ?? 9) - (ORDER[b.role ?? ''] ?? 9))

  return NextResponse.json({ users: result })
}

export async function PATCH(req: NextRequest) {
  if (!await verifyDeveloper()) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { userId, role } = await req.json()
  if (!userId) return NextResponse.json({ error: 'userId requerido' }, { status: 400 })

  const ROLES_VALIDOS = ['developer', 'admin', 'encargado', 'cajero', null]
  if (!ROLES_VALIDOS.includes(role)) {
    return NextResponse.json({ error: 'Rol inválido. Usa: developer|admin|encargado|cajero|null' }, { status: 400 })
  }

  const admin = createAdminClient()
  const newMeta = role ? { role } : {}
  const { error } = await admin.auth.admin.updateUserById(userId, { app_metadata: newMeta })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true, userId, role })
}
