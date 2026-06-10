import { NextResponse } from 'next/server'
import { createClient }      from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

async function verifyDeveloper() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || user.app_metadata?.role !== 'developer') return null
  return user
}

function tableMissing(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false
  if (error.code === '42P01' || error.code === 'PGRST205') return true
  const msg = error.message ?? ''
  return msg.includes('does not exist') || msg.includes('Could not find the table')
}

export async function GET() {
  if (!await verifyDeveloper()) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('auditoria')
    .select('id, accion, detalle, usuario_email, creado_en')
    .order('creado_en', { ascending: false })
    .limit(200)

  if (error) {
    if (tableMissing(error)) {
      return NextResponse.json({ migrationPending: true, eventos: [] })
    }
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ migrationPending: false, eventos: data ?? [] })
}
