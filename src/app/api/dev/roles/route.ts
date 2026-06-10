import { NextRequest, NextResponse } from 'next/server'
import { createClient }      from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { TODAS_LAS_CLAVES, ROLES_FALLBACK, permisosDesdeLista } from '@/lib/permisos'
import { logAudit } from '@/lib/audit'

async function verifyDeveloper() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || user.app_metadata?.role !== 'developer') return null
  return user
}

function tableMissing(error: { code?: string; message?: string } | null): boolean {
  // 42P01 = undefined_table (Postgres) · PGRST205 = tabla fuera del schema cache (PostgREST)
  if (!error) return false
  if (error.code === '42P01' || error.code === 'PGRST205') return true
  const msg = error.message ?? ''
  return msg.includes('does not exist') || msg.includes('Could not find the table')
}

function sanitizePermisos(input: unknown): Record<string, boolean> {
  if (!input || typeof input !== 'object') return {}
  const out: Record<string, boolean> = {}
  for (const key of TODAS_LAS_CLAVES) {
    if ((input as Record<string, unknown>)[key] === true) out[key] = true
  }
  return out
}

// ── GET: listar roles + conteo de usuarios por rol ──────────────
export async function GET() {
  if (!await verifyDeveloper()) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const admin = createAdminClient()

  // Conteo de usuarios por rol (para mostrar y para proteger el DELETE)
  const { data: { users } } = await admin.auth.admin.listUsers({ perPage: 100 })
  const userCounts: Record<string, number> = {}
  for (const u of users ?? []) {
    const r = (u.app_metadata as Record<string, string> | null)?.role ?? ''
    if (r) userCounts[r] = (userCounts[r] ?? 0) + 1
  }

  const { data: roles, error } = await admin
    .from('roles')
    .select('id, nombre, etiqueta, descripcion, permisos, es_sistema, creado_en')
    .order('creado_en')

  if (error) {
    if (tableMissing(error)) {
      // Migración pendiente: devolver los roles legacy en modo solo-lectura
      const legacy = Object.entries(ROLES_FALLBACK).map(([nombre, claves]) => ({
        id:          nombre,
        nombre,
        etiqueta:    nombre[0].toUpperCase() + nombre.slice(1),
        descripcion: null,
        permisos:    permisosDesdeLista(claves),
        es_sistema:  true,
        creado_en:   null,
      }))
      return NextResponse.json({ migrationPending: true, roles: legacy, userCounts })
    }
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ migrationPending: false, roles, userCounts })
}

// ── POST: crear un perfil nuevo ──────────────────────────────────
export async function POST(req: NextRequest) {
  const caller = await verifyDeveloper()
  if (!caller) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = await req.json()
  const nombre = String(body.nombre ?? '').trim().toLowerCase()
  const etiqueta = String(body.etiqueta ?? '').trim()

  if (!/^[a-z0-9_-]{2,20}$/.test(nombre)) {
    return NextResponse.json(
      { error: 'Nombre inválido: 2-20 caracteres, solo minúsculas, números, guion y guion bajo' },
      { status: 400 },
    )
  }
  if (nombre === 'developer') {
    return NextResponse.json({ error: 'El nombre "developer" está reservado' }, { status: 400 })
  }
  if (!etiqueta) {
    return NextResponse.json({ error: 'La etiqueta es requerida' }, { status: 400 })
  }

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('roles')
    .insert({
      nombre,
      etiqueta,
      descripcion: body.descripcion ? String(body.descripcion).trim() : null,
      permisos:    sanitizePermisos(body.permisos),
      es_sistema:  false,
    })
    .select()
    .single()

  if (error) {
    if (tableMissing(error)) {
      return NextResponse.json({ error: 'Corre migration-roles.sql en Supabase primero' }, { status: 409 })
    }
    if (error.code === '23505') {
      return NextResponse.json({ error: `Ya existe un perfil llamado "${nombre}"` }, { status: 409 })
    }
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  await logAudit('perfil.creado', { nombre, etiqueta }, caller.email)
  return NextResponse.json({ ok: true, role: data })
}

// ── PATCH: editar etiqueta/descripción/permisos ──────────────────
export async function PATCH(req: NextRequest) {
  const caller = await verifyDeveloper()
  if (!caller) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = await req.json()
  if (!body.id) return NextResponse.json({ error: 'id requerido' }, { status: 400 })

  const admin = createAdminClient()
  const { data: existing, error: findError } = await admin
    .from('roles')
    .select('nombre')
    .eq('id', body.id)
    .single()

  if (findError || !existing) {
    return NextResponse.json({ error: 'Perfil no encontrado' }, { status: 404 })
  }
  if (existing.nombre === 'developer') {
    return NextResponse.json({ error: 'El perfil developer no se puede modificar' }, { status: 400 })
  }

  const update: Record<string, unknown> = {}
  if (body.etiqueta !== undefined)    update.etiqueta    = String(body.etiqueta).trim()
  if (body.descripcion !== undefined) update.descripcion = body.descripcion ? String(body.descripcion).trim() : null
  if (body.permisos !== undefined)    update.permisos    = sanitizePermisos(body.permisos)

  const { data, error } = await admin
    .from('roles')
    .update(update)
    .eq('id', body.id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  await logAudit('perfil.editado', { id: body.id, nombre: existing.nombre }, caller.email)
  return NextResponse.json({ ok: true, role: data })
}

// ── DELETE: eliminar perfil (no sistema, sin usuarios asignados) ──
export async function DELETE(req: NextRequest) {
  const caller = await verifyDeveloper()
  if (!caller) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { id } = await req.json()
  if (!id) return NextResponse.json({ error: 'id requerido' }, { status: 400 })

  const admin = createAdminClient()
  const { data: role, error: findError } = await admin
    .from('roles')
    .select('nombre, es_sistema')
    .eq('id', id)
    .single()

  if (findError || !role) {
    return NextResponse.json({ error: 'Perfil no encontrado' }, { status: 404 })
  }
  if (role.es_sistema) {
    return NextResponse.json({ error: `El perfil "${role.nombre}" es de sistema y no se puede eliminar` }, { status: 400 })
  }

  // Bloquear si hay usuarios con este rol asignado
  const { data: { users } } = await admin.auth.admin.listUsers({ perPage: 100 })
  const asignados = (users ?? []).filter(
    u => (u.app_metadata as Record<string, string> | null)?.role === role.nombre
  )
  if (asignados.length > 0) {
    return NextResponse.json(
      { error: `${asignados.length} usuario(s) tienen el perfil "${role.nombre}". Reasígnalos primero.` },
      { status: 409 },
    )
  }

  const { error } = await admin.from('roles').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  await logAudit('perfil.eliminado', { id, nombre: role.nombre }, caller.email)
  return NextResponse.json({ ok: true })
}
