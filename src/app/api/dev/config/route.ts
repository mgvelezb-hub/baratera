import { NextRequest, NextResponse } from 'next/server'
import { createClient }      from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { logAudit } from '@/lib/audit'
import { CONFIG_CLAVES, mergeConfig } from '@/lib/config'

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

// ── GET: configuración completa (merged con defaults) ────────────
export async function GET() {
  if (!await verifyDeveloper()) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const admin = createAdminClient()
  const { data, error } = await admin.from('configuracion').select('clave, valor')

  if (error && !tableMissing(error)) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({
    migrationPending: tableMissing(error),
    config: mergeConfig(data ?? null),
  })
}

// ── PATCH: actualizar una clave de configuración ─────────────────
export async function PATCH(req: NextRequest) {
  const caller = await verifyDeveloper()
  if (!caller) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { clave, valor } = await req.json()

  if (!CONFIG_CLAVES.includes(clave)) {
    return NextResponse.json(
      { error: `Clave inválida. Usa: ${CONFIG_CLAVES.join('|')}` },
      { status: 400 },
    )
  }
  if (!valor || typeof valor !== 'object') {
    return NextResponse.json({ error: 'valor debe ser un objeto' }, { status: 400 })
  }

  const admin = createAdminClient()
  const { error } = await admin
    .from('configuracion')
    .upsert({ clave, valor, actualizado_en: new Date().toISOString() })

  if (error) {
    if (tableMissing(error)) {
      return NextResponse.json({ error: 'Corre migration-configuracion.sql en Supabase primero' }, { status: 409 })
    }
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  await logAudit('config.editada', { clave, valor }, caller.email)
  return NextResponse.json({ ok: true })
}
