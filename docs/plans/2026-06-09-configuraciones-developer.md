# Módulo Configuraciones — Rol Developer

**Fecha:** 2026-06-09

---

## Mapa de archivos

| Archivo | Acción | Responsabilidad |
|---------|--------|-----------------|
| `scripts/create-dev-user.mjs` | crear | Crear user dev@dev.mx con role='developer' |
| `src/lib/hooks/useIsAdmin.ts` | modificar | Añadir isDeveloper, heredar todos los permisos |
| `src/components/Sidebar.tsx` | modificar | Agregar Configuraciones con flag devOnly |
| `src/app/api/dev/users/route.ts` | crear | GET listar usuarios, PATCH cambiar rol |
| `src/app/api/dev/reset/route.ts` | crear | POST resetear datos por módulo |
| `src/app/api/dev/stats/route.ts` | crear | GET conteos de filas por tabla |
| `src/app/configuraciones/page.tsx` | crear | Server component — auth check + layout |
| `src/app/configuraciones/ConfiguracionesClient.tsx` | crear | UI completa: 3 tabs |

---

## Dependencias de ejecución

```
T1 (crear usuario) — independiente
T2 (useIsAdmin)    — independiente
T3 (Sidebar)       — depende T2
T4 (API users)     — independiente
T5 (API reset)     — independiente
T6 (API stats)     — independiente
T7 (page.tsx)      — independiente
T8 (Client)        — depende T4+T5+T6+T7
```

T1, T2, T4, T5, T6, T7 → paralelos. T3 tras T2. T8 al final.

---

## Tarea 1: Crear usuario dev@dev.mx

**Objetivo:** Crear el usuario developer en Supabase con `app_metadata.role = 'developer'` y password `Dev2026!`.

**Archivos a crear:**
- `scripts/create-dev-user.mjs`

**Implementación:**
```javascript
import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'

const envRaw = readFileSync('.env.local', 'utf-8')
const env = Object.fromEntries(
  envRaw.split('\n').filter(l => l.includes('=') && !l.startsWith('#'))
    .map(l => { const i = l.indexOf('='); return [l.slice(0,i).trim(), l.slice(i+1).trim()] })
)

const supabase = createClient(
  env.NEXT_PUBLIC_SUPABASE_URL,
  env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

const { data, error } = await supabase.auth.admin.createUser({
  email: 'dev@dev.mx',
  password: 'Dev2026!',
  app_metadata: { role: 'developer' },
  email_confirm: true,
})

if (error) { console.error('Error:', error.message); process.exit(1) }
console.log('✅ dev@dev.mx creado — id:', data.user.id)
```

Luego ejecutar: `node scripts/create-dev-user.mjs`

**Verificación:**
- [ ] Script corre sin error
- [ ] Usuario aparece en Supabase Auth console con `app_metadata.role = 'developer'`

---

## Tarea 2: Actualizar useIsAdmin — añadir isDeveloper

**Objetivo:** Añadir rol developer que hereda TODOS los permisos existentes más el flag `isDeveloper`.

**Archivos a modificar:**
- `src/lib/hooks/useIsAdmin.ts`

**Implementación** (archivo completo):
```typescript
'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

// Roles del sistema:
//   developer → acceso total + módulo de configuraciones
//   admin     → acceso total al negocio
//   encargado → inventario (ver + entrada + agregar) sin costos
//   (otros)   → cajero básico (solo POS + ver inventario)

export function useIsAdmin() {
  const [role, setRole] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    createClient().auth.getUser().then(({ data: { user } }) => {
      setRole(user?.app_metadata?.role ?? null)
      setLoading(false)
    })
  }, [])

  const isDeveloper = role === 'developer'

  return {
    isDeveloper,
    isAdmin:    isDeveloper || role === 'admin',
    canEntrada: isDeveloper || role === 'admin' || role === 'encargado',
    showCostos: isDeveloper || role === 'admin',
    loading,
  }
}
```

**Verificación:**
- [ ] Build sin errores TypeScript
- [ ] developer hereda isAdmin=true, canEntrada=true, showCostos=true

---

## Tarea 3: Actualizar Sidebar — agregar Configuraciones

**Objetivo:** Añadir módulo "Configuraciones" visible solo para developer, con icono Settings.

**Archivos a modificar:**
- `src/components/Sidebar.tsx`

**Implementación:**

1. Agregar `Settings` al import de lucide-react (junto a los otros iconos).

2. Añadir al array `MODULES` al final:
```typescript
{ id: 'configuraciones', label: 'Configuraciones', href: '/configuraciones', icon: Settings, built: true, adminOnly: false, devOnly: true },
```

3. Agregar `devOnly?: boolean` en el tipo implícito del array (TypeScript lo infiere).

4. Reemplazar el destructuring en `NavContent`:
```typescript
const { isAdmin, isDeveloper } = useIsAdmin()
```

5. Cambiar el `.filter`:
```typescript
{MODULES.filter(mod => {
  if (mod.devOnly)   return isDeveloper
  if (mod.adminOnly) return isAdmin
  return true
}).map(mod => {
```

**Verificación:**
- [ ] "Configuraciones" aparece en sidebar solo con dev@dev.mx
- [ ] Otros roles no ven el módulo
- [ ] Build sin errores

---

## Tarea 4: API route GET/PATCH /api/dev/users

**Objetivo:** Listar todos los usuarios y permitir cambiar el rol de cualquiera, verificando que el caller sea developer.

**Archivos a crear:**
- `src/app/api/dev/users/route.ts`

**Implementación:**
```typescript
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

async function verifyDeveloper() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || user.app_metadata?.role !== 'developer') return null
  return user
}

export async function GET() {
  const caller = await verifyDeveloper()
  if (!caller) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const admin = createAdminClient()
  const { data: { users }, error } = await admin.auth.admin.listUsers({ perPage: 100 })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const result = users.map(u => ({
    id:            u.id,
    email:         u.email,
    role:          u.app_metadata?.role ?? null,
    lastSignIn:    u.last_sign_in_at ?? null,
    createdAt:     u.created_at,
    emailConfirmed: !!u.email_confirmed_at,
  }))

  return NextResponse.json({ users: result })
}

export async function PATCH(req: NextRequest) {
  const caller = await verifyDeveloper()
  if (!caller) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { userId, role } = await req.json()
  if (!userId) return NextResponse.json({ error: 'userId requerido' }, { status: 400 })

  const ROLES_VALIDOS = ['developer', 'admin', 'encargado', 'cajero', null]
  if (!ROLES_VALIDOS.includes(role)) {
    return NextResponse.json({ error: 'Rol inválido' }, { status: 400 })
  }

  const admin = createAdminClient()
  const newMeta = role ? { role } : {}
  const { error } = await admin.auth.admin.updateUserById(userId, { app_metadata: newMeta })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true, userId, role })
}
```

**Verificación:**
- [ ] `GET /api/dev/users` desde developer retorna lista de usuarios
- [ ] `PATCH /api/dev/users` desde otro rol retorna 403
- [ ] Cambiar rol actualiza `app_metadata` en Supabase

---

## Tarea 5: API route POST /api/dev/reset

**Objetivo:** Borrar datos por módulo. El developer puede limpiar tablas específicas o todo de golpe.

**Archivos a crear:**
- `src/app/api/dev/reset/route.ts`

**Implementación:**
```typescript
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

async function verifyDeveloper() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || user.app_metadata?.role !== 'developer') return null
  return user
}

const MODULES_RESET: Record<string, () => Promise<void>> = {}

export async function POST(req: NextRequest) {
  const caller = await verifyDeveloper()
  if (!caller) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { module } = await req.json()
  const admin = createAdminClient()

  const ops: Record<string, string[]> = {
    productos:  ['stock_ledger', 'venta_items', 'ventas', 'producto_colores', 'productos'],
    ventas:     ['venta_items', 'ventas'],
    cortes:     ['cortes_caja'],
    adeudos:    ['pagos_proveedor', 'adeudos'],
    costos:     ['costos_fijos'],
    proveedores:['pagos_proveedor', 'adeudos', 'proveedores'],
    ledger:     ['stock_ledger'],
    todo:       ['stock_ledger', 'venta_items', 'ventas', 'cortes_caja',
                 'pagos_proveedor', 'adeudos', 'costos_fijos',
                 'producto_colores', 'productos'],
  }

  const tables = ops[module]
  if (!tables) return NextResponse.json({ error: 'Módulo inválido' }, { status: 400 })

  const results: Record<string, string> = {}
  for (const table of tables) {
    // DELETE con filtro dummy que aplica a todas las filas (gt uuid vacío)
    const { error } = await admin.from(table).delete().neq('id', '00000000-0000-0000-0000-000000000000')
    results[table] = error ? `ERROR: ${error.message}` : 'OK'
  }

  return NextResponse.json({ ok: true, module, results })
}
```

**Verificación:**
- [ ] POST con `{ module: 'ventas' }` elimina `ventas` + `venta_items`
- [ ] POST con `{ module: 'todo' }` vacía todas las tablas en orden correcto
- [ ] Desde rol non-developer retorna 403

---

## Tarea 6: API route GET /api/dev/stats

**Objetivo:** Retornar conteos de filas por tabla para el panel de sistema.

**Archivos a crear:**
- `src/app/api/dev/stats/route.ts`

**Implementación:**
```typescript
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

async function verifyDeveloper() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || user.app_metadata?.role !== 'developer') return null
  return user
}

const TABLES = [
  'productos', 'producto_colores', 'stock_ledger',
  'ventas', 'venta_items', 'cortes_caja',
  'proveedores', 'adeudos', 'pagos_proveedor', 'costos_fijos',
]

export async function GET() {
  const caller = await verifyDeveloper()
  if (!caller) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const admin = createAdminClient()
  const counts: Record<string, number> = {}

  await Promise.all(
    TABLES.map(async table => {
      const { count } = await admin.from(table).select('*', { count: 'exact', head: true })
      counts[table] = count ?? 0
    })
  )

  const { data: { users } } = await admin.auth.admin.listUsers({ perPage: 100 })

  return NextResponse.json({
    tables:    counts,
    userCount: users?.length ?? 0,
    env:       process.env.VERCEL_ENV ?? 'local',
    url:       process.env.NEXT_PUBLIC_SUPABASE_URL?.split('.')[0].replace('https://', '') ?? '—',
  })
}
```

**Verificación:**
- [ ] Retorna objeto con conteos de las 10 tablas
- [ ] `userCount` coincide con usuarios en Supabase

---

## Tarea 7: Page /configuraciones/page.tsx

**Objetivo:** Server component que verifica developer server-side y monta el client.

**Archivos a crear:**
- `src/app/configuraciones/page.tsx`

**Implementación:**
```typescript
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import AppShell from '@/components/AppShell'
import ConfiguracionesClient from './ConfiguracionesClient'

export default async function ConfiguracionesPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user || user.app_metadata?.role !== 'developer') {
    redirect('/inventario')
  }

  return (
    <AppShell>
      <ConfiguracionesClient />
    </AppShell>
  )
}
```

**Verificación:**
- [ ] Acceder desde admin → redirige a /inventario
- [ ] Acceder desde developer → muestra el client
- [ ] Build sin errores

---

## Tarea 8: ConfiguracionesClient.tsx — UI completa

**Objetivo:** Panel de control del developer con 3 tabs: Usuarios, Datos, Sistema.

**Archivos a crear:**
- `src/app/configuraciones/ConfiguracionesClient.tsx`

**Implementación:** (ver código completo abajo)

### Tab Usuarios
- Fetcha `GET /api/dev/users` al montar
- Tabla: avatar con inicial, email, badge de rol (color por rol), última conexión, dropdown para cambiar rol
- Roles disponibles: developer / admin / encargado / cajero / sin rol
- Al cambiar: `PATCH /api/dev/users` → toast de éxito/error → refetch

### Tab Datos
- Cards por módulo con descripción de qué borrará
- Cada card tiene botón "Borrar" → diálogo de confirmación inline con input "CONFIRMAR"
- Módulos: Productos (incluye ledger y colores), Ventas, Cortes de caja, Adeudos, Costos fijos, Proveedores, 🔴 Reset total
- Feedback visual: spinner + resultado por tabla

### Tab Sistema
- Stats en grid (conteos por tabla)
- Info del entorno: Supabase project ID, env (local/preview/production)
- Simular rol: dropdown local (localStorage `devSimRole`) que cuando está activo muestra un banner amarillo "Simulando como [rol]" y hace que useIsAdmin retorne ese rol

```typescript
'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  Users, Database, Monitor, RefreshCw, ChevronDown,
  Trash2, AlertTriangle, CheckCircle2, Loader2, Shield,
  Activity, Server
} from 'lucide-react'

// ── Types ──────────────────────────────────────────────────────
interface UserInfo {
  id:             string
  email:          string
  role:           string | null
  lastSignIn:     string | null
  createdAt:      string
  emailConfirmed: boolean
}

interface Stats {
  tables:    Record<string, number>
  userCount: number
  env:       string
  url:       string
}

type Tab = 'usuarios' | 'datos' | 'sistema'

// ── Helpers ────────────────────────────────────────────────────
const ROLE_META: Record<string, { label: string; color: string }> = {
  developer: { label: 'Developer', color: 'bg-violet-100 text-violet-700' },
  admin:     { label: 'Admin',     color: 'bg-blue-100 text-blue-700'     },
  encargado: { label: 'Encargado', color: 'bg-amber-100 text-amber-700'   },
  cajero:    { label: 'Cajero',    color: 'bg-slate-100 text-slate-600'   },
}

const RESET_MODULES = [
  { key: 'ventas',      label: 'Ventas',           desc: 'Elimina ventas y venta_items',                       color: 'border-orange-200', icon: '🛒' },
  { key: 'cortes',      label: 'Cortes de caja',   desc: 'Elimina todos los cortes registrados',               color: 'border-orange-200', icon: '✂️' },
  { key: 'adeudos',     label: 'Adeudos',          desc: 'Elimina adeudos y pagos a proveedores',              color: 'border-orange-200', icon: '💳' },
  { key: 'costos',      label: 'Costos fijos',     desc: 'Elimina todos los costos fijos configurados',        color: 'border-orange-200', icon: '📊' },
  { key: 'ledger',      label: 'Stock ledger',     desc: 'Elimina el historial de movimientos de inventario',  color: 'border-red-200',    icon: '📋' },
  { key: 'productos',   label: 'Productos',        desc: 'Elimina productos, colores y todo el ledger',        color: 'border-red-200',    icon: '📦' },
  { key: 'proveedores', label: 'Proveedores',      desc: 'Elimina proveedores, adeudos y pagos',               color: 'border-red-200',    icon: '🏭' },
  { key: 'todo',        label: 'Reset total',      desc: 'Borra TODOS los datos de la app. No hay vuelta atrás', color: 'border-red-500 bg-red-50', icon: '💣' },
]

const TABLE_LABELS: Record<string, string> = {
  productos:        'Productos',      producto_colores: 'Colores',
  stock_ledger:     'Movimientos',    ventas:           'Ventas',
  venta_items:      'Items vendidos', cortes_caja:      'Cortes',
  proveedores:      'Proveedores',    adeudos:          'Adeudos',
  pagos_proveedor:  'Pagos prov.',    costos_fijos:     'Costos fijos',
}

// ── Main component ──────────────────────────────────────────────
export default function ConfiguracionesClient() {
  const [tab,         setTab]         = useState<Tab>('usuarios')
  const [users,       setUsers]       = useState<UserInfo[]>([])
  const [stats,       setStats]       = useState<Stats | null>(null)
  const [loadingUsers, setLoadingUsers] = useState(true)
  const [loadingStats, setLoadingStats] = useState(false)
  const [roleLoading, setRoleLoading] = useState<string | null>(null)  // userId in progress
  const [toast,       setToast]       = useState<{ msg: string; ok: boolean } | null>(null)
  const [simRole,     setSimRole]     = useState<string>('')

  // Confirm reset state
  const [resetModal,  setResetModal]  = useState<{ key: string; label: string } | null>(null)
  const [resetInput,  setResetInput]  = useState('')
  const [resetLoading, setResetLoading] = useState(false)
  const [resetResult, setResetResult] = useState<Record<string, string> | null>(null)

  // ── Load simRole from localStorage ──────────────────────────
  useEffect(() => {
    setSimRole(localStorage.getItem('devSimRole') ?? '')
  }, [])

  function showToast(msg: string, ok: boolean) {
    setToast({ msg, ok })
    setTimeout(() => setToast(null), 3000)
  }

  // ── Fetch users ──────────────────────────────────────────────
  const fetchUsers = useCallback(async () => {
    setLoadingUsers(true)
    const res = await fetch('/api/dev/users')
    if (res.ok) {
      const data = await res.json()
      setUsers(data.users)
    }
    setLoadingUsers(false)
  }, [])

  useEffect(() => { fetchUsers() }, [fetchUsers])

  // ── Fetch stats ───────────────────────────────────────────────
  async function fetchStats() {
    setLoadingStats(true)
    const res = await fetch('/api/dev/stats')
    if (res.ok) setStats(await res.json())
    setLoadingStats(false)
  }

  useEffect(() => { if (tab === 'sistema') fetchStats() }, [tab])

  // ── Change role ───────────────────────────────────────────────
  async function changeRole(userId: string, role: string | null) {
    setRoleLoading(userId)
    const res = await fetch('/api/dev/users', {
      method:  'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ userId, role }),
    })
    if (res.ok) {
      showToast('Rol actualizado', true)
      await fetchUsers()
    } else {
      const d = await res.json()
      showToast(d.error ?? 'Error al actualizar', false)
    }
    setRoleLoading(null)
  }

  // ── Reset module ─────────────────────────────────────────────
  async function confirmReset() {
    if (!resetModal) return
    setResetLoading(true)
    setResetResult(null)
    const res = await fetch('/api/dev/reset', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ module: resetModal.key }),
    })
    const data = await res.json()
    if (res.ok) {
      setResetResult(data.results)
      showToast(`${resetModal.label} eliminado`, true)
    } else {
      showToast(data.error ?? 'Error al resetear', false)
    }
    setResetLoading(false)
    setResetInput('')
    if (res.ok) setTimeout(() => setResetModal(null), 2000)
  }

  // ── Simulate role ─────────────────────────────────────────────
  function applySimRole(r: string) {
    setSimRole(r)
    if (r) localStorage.setItem('devSimRole', r)
    else   localStorage.removeItem('devSimRole')
    showToast(r ? `Simulando como ${r} — recarga para ver efecto` : 'Simulación desactivada', true)
  }

  // ── Render ───────────────────────────────────────────────────
  return (
    <div className="max-w-4xl mx-auto px-4 py-6">

      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-1">
          <div className="w-7 h-7 rounded-lg bg-violet-600 flex items-center justify-center">
            <Shield className="w-4 h-4 text-white" />
          </div>
          <h1 className="text-xl font-semibold text-slate-900">Configuraciones</h1>
          <span className="text-xs bg-violet-100 text-violet-700 px-2 py-0.5 rounded-full font-medium">Developer</span>
        </div>
        <p className="text-sm text-slate-500">Panel exclusivo del desarrollador. Los cambios son inmediatos y permanentes.</p>
      </div>

      {/* Sim role banner */}
      {simRole && (
        <div className="mb-4 flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-xl px-4 py-2.5 text-sm text-amber-800">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <span>Simulando rol <strong>{simRole}</strong> — recarga la app para ver el efecto completo.</span>
          <button onClick={() => applySimRole('')} className="ml-auto text-amber-600 hover:text-amber-800 font-medium">Desactivar</button>
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div className={`fixed bottom-6 right-6 z-50 flex items-center gap-2 px-4 py-3 rounded-xl shadow-lg text-sm font-medium transition-all ${
          toast.ok ? 'bg-green-600 text-white' : 'bg-red-600 text-white'
        }`}>
          {toast.ok ? <CheckCircle2 className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
          {toast.msg}
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 bg-slate-100 p-1 rounded-xl mb-6">
        {([
          { id: 'usuarios', label: 'Usuarios',  Icon: Users    },
          { id: 'datos',    label: 'Datos',      Icon: Database },
          { id: 'sistema',  label: 'Sistema',    Icon: Monitor  },
        ] as const).map(({ id, label, Icon }) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={`flex-1 flex items-center justify-center gap-1.5 h-9 rounded-lg text-sm font-medium transition-colors ${
              tab === id ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            <Icon className="w-3.5 h-3.5" />
            {label}
          </button>
        ))}
      </div>

      {/* ── TAB: USUARIOS ──────────────────────────────────────── */}
      {tab === 'usuarios' && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <p className="text-sm text-slate-500">{users.length} usuarios registrados</p>
            <button
              onClick={fetchUsers}
              className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700 h-8 px-3 rounded-lg hover:bg-slate-100 transition-colors"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Actualizar
            </button>
          </div>

          {loadingUsers ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-5 h-5 animate-spin text-violet-500" />
            </div>
          ) : (
            <div className="space-y-2">
              {users.map(u => {
                const meta = ROLE_META[u.role ?? '']
                const initials = (u.email ?? '?')[0].toUpperCase()
                const lastSeen = u.lastSignIn
                  ? new Date(u.lastSignIn).toLocaleString('es-MX', { dateStyle: 'short', timeStyle: 'short' })
                  : 'Nunca'
                return (
                  <div key={u.id} className="flex items-center gap-3 p-3 bg-white border border-slate-200 rounded-xl">
                    {/* Avatar */}
                    <div className="w-9 h-9 rounded-full bg-violet-100 flex items-center justify-center text-sm font-semibold text-violet-700 shrink-0">
                      {initials}
                    </div>
                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-900 truncate">{u.email}</p>
                      <p className="text-xs text-slate-400">Último acceso: {lastSeen}</p>
                    </div>
                    {/* Role badge */}
                    {meta && (
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${meta.color}`}>
                        {meta.label}
                      </span>
                    )}
                    {/* Role selector */}
                    <div className="relative">
                      {roleLoading === u.id ? (
                        <Loader2 className="w-4 h-4 animate-spin text-violet-500" />
                      ) : (
                        <select
                          value={u.role ?? ''}
                          onChange={e => changeRole(u.id, e.target.value || null)}
                          className="h-8 pl-2 pr-6 rounded-lg border border-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-violet-500 bg-white appearance-none cursor-pointer"
                        >
                          <option value="">Sin rol</option>
                          <option value="cajero">Cajero</option>
                          <option value="encargado">Encargado</option>
                          <option value="admin">Admin</option>
                          <option value="developer">Developer</option>
                        </select>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* ── TAB: DATOS ─────────────────────────────────────────── */}
      {tab === 'datos' && (
        <div>
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-5 flex gap-3">
            <AlertTriangle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-red-800">Zona de peligro</p>
              <p className="text-sm text-red-700 mt-0.5">Estas acciones son irreversibles. El sistema está en producción con datos reales.</p>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            {RESET_MODULES.map(mod => (
              <div key={mod.key} className={`bg-white border ${mod.color} rounded-xl p-4`}>
                <div className="flex items-start justify-between gap-2 mb-1">
                  <div className="flex items-center gap-2">
                    <span className="text-base">{mod.icon}</span>
                    <p className="text-sm font-semibold text-slate-900">{mod.label}</p>
                  </div>
                </div>
                <p className="text-xs text-slate-500 mb-3">{mod.desc}</p>
                <button
                  onClick={() => { setResetModal({ key: mod.key, label: mod.label }); setResetInput(''); setResetResult(null) }}
                  className={`w-full h-8 rounded-lg text-xs font-semibold transition-colors flex items-center justify-center gap-1.5 ${
                    mod.key === 'todo'
                      ? 'bg-red-600 hover:bg-red-700 text-white'
                      : 'border border-red-200 text-red-600 hover:bg-red-50'
                  }`}
                >
                  <Trash2 className="w-3 h-3" />
                  Borrar {mod.label}
                </button>
              </div>
            ))}
          </div>

          {/* Confirm dialog */}
          {resetModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
              <div className="w-full max-w-sm bg-white rounded-2xl shadow-xl p-6">
                <div className="flex items-center gap-2 mb-3">
                  <AlertTriangle className="w-5 h-5 text-red-500" />
                  <h3 className="font-semibold text-slate-900">Confirmar: {resetModal.label}</h3>
                </div>
                <p className="text-sm text-slate-600 mb-4">
                  Esta acción es <strong>irreversible</strong>. Escribe <code className="bg-slate-100 px-1 rounded text-red-600">CONFIRMAR</code> para continuar.
                </p>
                <input
                  autoFocus
                  type="text"
                  value={resetInput}
                  onChange={e => setResetInput(e.target.value)}
                  placeholder="CONFIRMAR"
                  className="w-full h-10 px-3 rounded-lg border border-slate-300 text-sm mb-4 focus:outline-none focus:ring-2 focus:ring-red-500"
                />
                {resetResult && (
                  <div className="mb-4 text-xs space-y-1 bg-slate-50 rounded-lg p-3">
                    {Object.entries(resetResult).map(([table, status]) => (
                      <div key={table} className="flex justify-between">
                        <span className="text-slate-600">{table}</span>
                        <span className={status === 'OK' ? 'text-green-600 font-medium' : 'text-red-600'}>{status}</span>
                      </div>
                    ))}
                  </div>
                )}
                <div className="flex gap-2">
                  <button
                    onClick={() => setResetModal(null)}
                    className="flex-1 h-10 rounded-xl border border-slate-200 text-sm text-slate-600 hover:bg-slate-50 transition-colors"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={confirmReset}
                    disabled={resetInput !== 'CONFIRMAR' || resetLoading}
                    className="flex-1 h-10 rounded-xl bg-red-600 text-white text-sm font-semibold disabled:opacity-40 hover:bg-red-700 transition-colors flex items-center justify-center gap-1.5"
                  >
                    {resetLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                    Eliminar
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── TAB: SISTEMA ───────────────────────────────────────── */}
      {tab === 'sistema' && (
        <div className="space-y-6">

          {/* Stats */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm font-semibold text-slate-700 flex items-center gap-1.5">
                <Activity className="w-4 h-4 text-violet-500" />
                Registros por tabla
              </p>
              <button onClick={fetchStats} className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-700 h-7 px-2 rounded-lg hover:bg-slate-100 transition-colors">
                <RefreshCw className="w-3 h-3" />
                Actualizar
              </button>
            </div>
            {loadingStats ? (
              <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-violet-500" /></div>
            ) : stats ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {Object.entries(stats.tables).map(([table, count]) => (
                  <div key={table} className="bg-white border border-slate-200 rounded-xl p-3">
                    <p className="text-xs text-slate-500 mb-0.5">{TABLE_LABELS[table] ?? table}</p>
                    <p className="text-xl font-bold text-slate-900">{count.toLocaleString('es-MX')}</p>
                  </div>
                ))}
              </div>
            ) : null}
          </div>

          {/* Entorno */}
          {stats && (
            <div>
              <p className="text-sm font-semibold text-slate-700 flex items-center gap-1.5 mb-3">
                <Server className="w-4 h-4 text-violet-500" />
                Entorno
              </p>
              <div className="bg-white border border-slate-200 rounded-xl divide-y divide-slate-100">
                {[
                  { label: 'Supabase project', value: stats.url },
                  { label: 'Vercel env',        value: stats.env },
                  { label: 'Usuarios',          value: String(stats.userCount) },
                  { label: 'Producción',        value: 'baratera-os.vercel.app' },
                ].map(({ label, value }) => (
                  <div key={label} className="flex justify-between items-center px-4 py-3">
                    <span className="text-sm text-slate-500">{label}</span>
                    <span className="text-sm font-mono font-medium text-slate-900">{value}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Simular rol */}
          <div>
            <p className="text-sm font-semibold text-slate-700 flex items-center gap-1.5 mb-1">
              <Shield className="w-4 h-4 text-violet-500" />
              Simular rol
            </p>
            <p className="text-xs text-slate-400 mb-3">
              Guarda un flag en localStorage para que useIsAdmin devuelva otro rol.
              Útil para revisar vistas sin cambiar de cuenta.
            </p>
            <div className="flex gap-2 flex-wrap">
              {['', 'cajero', 'encargado', 'admin'].map(r => (
                <button
                  key={r || 'ninguno'}
                  onClick={() => applySimRole(r)}
                  className={`h-8 px-3 rounded-lg text-xs font-medium border transition-colors ${
                    simRole === r
                      ? 'bg-violet-600 text-white border-violet-600'
                      : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  {r || 'Sin simulación'}
                </button>
              ))}
            </div>
          </div>

        </div>
      )}

    </div>
  )
}
```

**Verificación:**
- [ ] Tab Usuarios: muestra los 4 usuarios, dropdowns de rol funcionan
- [ ] Tab Datos: "CONFIRMAR" habilita botón, reset ejecuta y muestra resultados por tabla
- [ ] Tab Sistema: stats cargan correctamente
- [ ] Simulación de rol guarda en localStorage
- [ ] Build sin errores TypeScript

---

## Orden final de ejecución

1. T1 (script) + T2 (hook) + T4 + T5 + T6 + T7 → paralelos
2. T3 (Sidebar) — tras T2
3. T8 (Client) — al final (depende de T4+T5+T6)
4. Build + commit + push
