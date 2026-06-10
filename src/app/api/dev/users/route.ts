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

  const admin = createAdminClient()

  // Validar contra la tabla de roles dinámicos; fallback a la lista legacy
  // si la migración aún no corre en Supabase.
  if (role !== null) {
    const { data: roleRow, error: roleError } = await admin
      .from('roles')
      .select('nombre')
      .eq('nombre', role)
      .maybeSingle()

    const legacyOk = ['developer', 'admin', 'encargado', 'cajero'].includes(role)
    if (roleError ? !legacyOk : !roleRow) {
      return NextResponse.json({ error: `El perfil "${role}" no existe` }, { status: 400 })
    }
  }
  const newMeta = role ? { role } : {}
  const { error } = await admin.auth.admin.updateUserById(userId, { app_metadata: newMeta })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true, userId, role })
}
