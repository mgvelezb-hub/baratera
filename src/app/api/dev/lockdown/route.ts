import { NextRequest, NextResponse } from 'next/server'
import { createClient }      from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { logAudit } from '@/lib/audit'

export const dynamic = 'force-dynamic'

// Solo el developer controla el bloqueo de plataforma.
async function verifyDeveloper() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || (user.app_metadata as Record<string, string> | null)?.role !== 'developer') return null
  return user
}

interface LockdownValor {
  activo?: boolean
  por?:    string | null
  desde?:  string | null
}

// ── GET: estado actual del bloqueo ──────────────────────────────
export async function GET() {
  if (!await verifyDeveloper()) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  const admin = createAdminClient()
  const { data } = await admin
    .from('configuracion')
    .select('valor')
    .eq('clave', 'lockdown')
    .maybeSingle()

  const v = (data?.valor as LockdownValor | null) ?? null
  return NextResponse.json({
    activo: v?.activo === true,
    por:    v?.por ?? null,
    desde:  v?.desde ?? null,
  })
}

// ── POST: activar / desactivar el bloqueo ───────────────────────
// Al activar, el middleware (updateSession) cierra la sesión de
// cualquier usuario que no sea developer en su siguiente request y
// le impide volver a entrar hasta que se desactive.
export async function POST(req: NextRequest) {
  const caller = await verifyDeveloper()
  if (!caller) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { activo } = await req.json()
  const valor: LockdownValor = activo
    ? { activo: true, por: caller.email ?? null, desde: new Date().toISOString() }
    : { activo: false, por: null, desde: null }

  const admin = createAdminClient()
  const { error } = await admin
    .from('configuracion')
    .upsert({ clave: 'lockdown', valor, actualizado_en: new Date().toISOString() })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  await logAudit(activo ? 'plataforma.bloqueada' : 'plataforma.desbloqueada', {}, caller.email)
  return NextResponse.json({ ok: true, activo: !!activo })
}
