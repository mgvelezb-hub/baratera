# Plan: Módulo Clientes

**Fecha:** 2026-06-11  
**Feature:** CRM básico — clientes frecuentes/mayoristas, cupones en POS, numeración de tickets, historial por ticket/cliente en dashboard

---

## Alcance

1. DB: tabla `clientes` + tabla `ticket_secuencia` + 4 columnas nuevas en `ventas`
2. API routes: CRUD clientes + búsqueda + generador de ticket atomico
3. Módulo `/clientes` con lista, alta y detalle por cliente
4. POS: búsqueda de cliente al inicio de venta + 4 botones de cupón en PaymentModal
5. Ticket: `numero_ticket` + `clienteNombre/Numero` impresos
6. Dashboard admin: historial de tickets + alertas de cupones usados
7. Sidebar: marcar `clientes` como `built: true`

---

## Archivos a crear/modificar

| Archivo | Acción |
|---------|--------|
| SQL migration (Supabase editor) | CREAR — tablas + columnas + función PG |
| `src/lib/types.ts` | MODIFICAR — añadir `Cliente`, extender `Venta` |
| `src/app/api/clientes/route.ts` | CREAR — GET lista + POST crear |
| `src/app/api/clientes/buscar/route.ts` | CREAR — GET búsqueda por teléfono o número |
| `src/app/api/clientes/[id]/route.ts` | CREAR — GET detalle + tickets |
| `src/app/api/ventas/ticket-num/route.ts` | CREAR — POST generar siguiente ticket |
| `src/app/clientes/page.tsx` | MODIFICAR — reemplazar ProximamenteCard |
| `src/app/clientes/ClientesClient.tsx` | CREAR — lista + búsqueda |
| `src/app/clientes/NuevoClienteModal.tsx` | CREAR — form alta cliente |
| `src/app/clientes/[id]/page.tsx` | CREAR — detalle + historial de tickets |
| `src/app/venta/PaymentModal.tsx` | MODIFICAR — añadir botones de cupón |
| `src/app/venta/VentaClient.tsx` | MODIFICAR — lookup cliente + pasar datos a save |
| `src/app/venta/TicketPrint.tsx` | MODIFICAR — añadir numero_ticket + clienteNombre |
| `src/app/dashboard/page.tsx` | MODIFICAR — historial tickets + cupones |
| `src/components/Sidebar.tsx` | MODIFICAR — `built: true` en clientes |

---

## Fase A — Fundación (DB + tipos)

### Tarea 1: SQL Migration

**Objetivo:** Crear el esquema completo en Supabase para el módulo de clientes.

**Dónde ejecutar:** Supabase Dashboard → SQL Editor

**SQL completo a ejecutar:**

```sql
-- ── 1. Tabla clientes ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS clientes (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  numero_cliente  TEXT UNIQUE NOT NULL,   -- auto-generado: 'CLI-0001'
  nombre          TEXT NOT NULL,
  telefono        TEXT UNIQUE NOT NULL,   -- clave universal por CLAUDE.md
  correo          TEXT,
  recibe_promo    BOOLEAN NOT NULL DEFAULT false,
  tipo            TEXT NOT NULL DEFAULT 'frecuente'
                  CHECK (tipo IN ('frecuente', 'mayorista')),
  notas           TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Secuencia para auto-incrementar numero_cliente
CREATE SEQUENCE IF NOT EXISTS clientes_seq START 1;

-- RLS: cajeros pueden leer, sólo admin puede escribir (vía API con service key)
ALTER TABLE clientes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "clientes_select_all" ON clientes;
CREATE POLICY "clientes_select_all" ON clientes
  FOR SELECT USING (true);

-- ── 2. Tabla ticket_secuencia (reset diario) ──────────────────
CREATE TABLE IF NOT EXISTS ticket_secuencia (
  fecha           DATE PRIMARY KEY,
  ultimo_numero   INTEGER NOT NULL DEFAULT 0
);

ALTER TABLE ticket_secuencia ENABLE ROW LEVEL SECURITY;
-- Sin políticas: sólo accesible con service key (admin client)

-- ── 3. Función para generar siguiente numero_ticket ───────────
CREATE OR REPLACE FUNCTION next_ticket_num(p_fecha DATE)
RETURNS TEXT
LANGUAGE plpgsql
AS $$
DECLARE
  v_num INTEGER;
BEGIN
  INSERT INTO ticket_secuencia (fecha, ultimo_numero)
  VALUES (p_fecha, 1)
  ON CONFLICT (fecha) DO UPDATE
    SET ultimo_numero = ticket_secuencia.ultimo_numero + 1
  RETURNING ultimo_numero INTO v_num;

  RETURN TO_CHAR(p_fecha, 'YYYYMMDD') || '-' || LPAD(v_num::TEXT, 3, '0');
END;
$$;

-- ── 4. Nuevas columnas en ventas ──────────────────────────────
ALTER TABLE ventas
  ADD COLUMN IF NOT EXISTS cliente_id    UUID REFERENCES clientes(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS cupon_pct     INTEGER CHECK (cupon_pct IN (5, 10, 15, 20)),
  ADD COLUMN IF NOT EXISTS descuento     DECIMAL(12,2),
  ADD COLUMN IF NOT EXISTS numero_ticket TEXT;

-- Índices útiles
CREATE INDEX IF NOT EXISTS idx_ventas_numero_ticket ON ventas(numero_ticket);
CREATE INDEX IF NOT EXISTS idx_ventas_cliente_id    ON ventas(cliente_id);
```

**Verificación:**
- [ ] `\d clientes` muestra las 9 columnas
- [ ] `\d ticket_secuencia` muestra `fecha` + `ultimo_numero`
- [ ] `SELECT next_ticket_num(CURRENT_DATE)` retorna `YYYYMMDD-001`
- [ ] `\d ventas` muestra `cliente_id`, `cupon_pct`, `descuento`, `numero_ticket`

---

### Tarea 2: Tipos TypeScript

**Objetivo:** Añadir `Cliente` y extender `Venta` en `src/lib/types.ts`.

**Archivos a modificar:**
- `src/lib/types.ts` — dos cambios

**Implementación:**

En `src/lib/types.ts`, después de la interfaz `StockLedgerEntry` (aprox. línea 60), añadir:

```typescript
export interface Cliente {
  id:             string
  numero_cliente: string
  nombre:         string
  telefono:       string
  correo:         string | null
  recibe_promo:   boolean
  tipo:           'frecuente' | 'mayorista'
  notas:          string | null
  created_at:     string
}
```

En la interfaz `Venta` existente, añadir los 4 campos nuevos al final:

```typescript
  cliente_id?:    string | null
  cupon_pct?:     number | null
  descuento?:     number | null
  numero_ticket?: string | null
  clientes?: {    // join cuando se consulta con select('...clientes(nombre, numero_cliente)')
    nombre:         string
    numero_cliente: string
  } | null
```

**Verificación:**
- [ ] `npx tsc --noEmit` sin errores nuevos

---

## Fase B — API Routes

### Tarea 3: CRUD de clientes

**Objetivo:** Crear 3 rutas API para gestionar clientes.

**Archivos a crear:**
- `src/app/api/clientes/route.ts`
- `src/app/api/clientes/buscar/route.ts`
- `src/app/api/clientes/[id]/route.ts`

**`src/app/api/clientes/route.ts`:**

```typescript
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

  // Generar numero_cliente con la secuencia
  const { data: seqRow, error: seqErr } = await admin
    .rpc('nextval', { seq: 'clientes_seq' })
    .single()
  // Alternativa directa si rpc no está disponible:
  const { data: seqData } = await admin
    .from('clientes')
    .select('numero_cliente')
    .order('created_at', { ascending: false })
    .limit(1)
  const lastNum = seqData?.[0]?.numero_cliente
    ? parseInt(seqData[0].numero_cliente.replace('CLI-', '')) + 1
    : 1
  const numero_cliente = `CLI-${String(lastNum).padStart(4, '0')}`

  const { data, error } = await admin
    .from('clientes')
    .insert({ nombre: nombre.trim(), telefono: telefono.trim(), correo: correo?.trim() || null,
              recibe_promo: recibe_promo ?? false, tipo: tipo ?? 'frecuente',
              notas: notas?.trim() || null, numero_cliente })
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
```

> **Nota sobre `numero_cliente`:** La secuencia de PostgreSQL (`clientes_seq`) garantiza unicidad a nivel DB. La lógica de fallback con `order by created_at` puede tener race condition en alta concurrencia — para una papelería con tráfico bajo es aceptable. Si en el futuro se necesita robustez total, agregar una función PG similar a `next_ticket_num`.

**`src/app/api/clientes/buscar/route.ts`:**

```typescript
import { createAdminClient } from '@/lib/supabase/admin'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get('q')?.trim()
  if (!q) return NextResponse.json(null)

  const admin = createAdminClient()

  // Buscar por teléfono exacto primero, luego por numero_cliente
  const [{ data: porTelefono }, { data: porNumero }] = await Promise.all([
    admin.from('clientes').select('*').eq('telefono', q).maybeSingle(),
    admin.from('clientes').select('*').ilike('numero_cliente', `%${q}%`).limit(1).maybeSingle(),
  ])

  const resultado = porTelefono ?? porNumero ?? null
  return NextResponse.json(resultado)
}
```

**`src/app/api/clientes/[id]/route.ts`:**

```typescript
import { createAdminClient } from '@/lib/supabase/admin'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const admin = createAdminClient()
  const [{ data: cliente }, { data: tickets }] = await Promise.all([
    admin.from('clientes').select('*').eq('id', params.id).single(),
    admin.from('ventas')
      .select('id, total, cupon_pct, descuento, numero_ticket, metodo, created_at')
      .eq('cliente_id', params.id)
      .order('created_at', { ascending: false })
      .limit(50),
  ])
  if (!cliente) return NextResponse.json({ error: 'not found' }, { status: 404 })
  return NextResponse.json({ cliente, tickets: tickets ?? [] })
}
```

**Verificación:**
- [ ] `GET /api/clientes` retorna array (vacío si no hay datos)
- [ ] `POST /api/clientes` con `{ nombre, telefono }` crea registro + retorna 201 con `numero_cliente: 'CLI-0001'`
- [ ] `POST /api/clientes` con teléfono duplicado retorna 409
- [ ] `GET /api/clientes/buscar?q=5551234567` retorna el cliente
- [ ] `GET /api/clientes/[id]` retorna `{ cliente, tickets }`

---

### Tarea 4: Generador de ticket

**Objetivo:** Ruta API que genera el siguiente número de ticket para el día de hoy de forma atómica.

**Archivo a crear:** `src/app/api/ventas/ticket-num/route.ts`

```typescript
import { createAdminClient } from '@/lib/supabase/admin'
import { NextResponse }      from 'next/server'

export async function POST() {
  const admin = createAdminClient()
  const today = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Mexico_City' })

  const { data, error } = await admin
    .rpc('next_ticket_num', { p_fecha: today })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ numero_ticket: data as string })
}
```

**Verificación:**
- [ ] `POST /api/ventas/ticket-num` retorna `{ numero_ticket: "20260611-001" }`
- [ ] Segunda llamada el mismo día retorna `"20260611-002"`
- [ ] Primera llamada del día siguiente retorna `"20260612-001"`

---

## Fase C — Módulo /clientes

### Tarea 5: Página de lista de clientes

**Objetivo:** Reemplazar el placeholder en `/clientes` con el módulo real de CRM.

**Archivos a modificar/crear:**
- `src/app/clientes/page.tsx` — reemplazar completamente
- `src/app/clientes/ClientesClient.tsx` — CREAR
- `src/app/clientes/NuevoClienteModal.tsx` — CREAR

**`src/app/clientes/page.tsx`:**

```typescript
import { createAdminClient }  from '@/lib/supabase/admin'
import { requirePermiso }     from '@/lib/permisos-server'
import AppShell               from '@/components/AppShell'
import ClientesClient         from './ClientesClient'
import type { Cliente }       from '@/lib/types'

export const dynamic = 'force-dynamic'

export default async function ClientesPage() {
  await requirePermiso('clientes.ver')
  const admin = createAdminClient()
  const { data } = await admin
    .from('clientes')
    .select('*')
    .order('nombre')
  return (
    <AppShell>
      <ClientesClient clientes={(data ?? []) as Cliente[]} />
    </AppShell>
  )
}
```

**`src/app/clientes/ClientesClient.tsx`:**

```tsx
'use client'
import { useState, useMemo } from 'react'
import { Users, Plus, Search, Phone, Mail, Tag } from 'lucide-react'
import Link                  from 'next/link'
import type { Cliente }      from '@/lib/types'
import NuevoClienteModal     from './NuevoClienteModal'

const TIPO_BADGE: Record<string, string> = {
  frecuente: 'bg-blue-50 text-blue-700',
  mayorista: 'bg-amber-50 text-amber-700',
}

interface Props { clientes: Cliente[] }

export default function ClientesClient({ clientes: inicial }: Props) {
  const [clientes, setClientes] = useState(inicial)
  const [q, setQ]               = useState('')
  const [showNuevo, setShowNuevo] = useState(false)

  const filtrados = useMemo(() => {
    if (!q.trim()) return clientes
    const lq = q.toLowerCase()
    return clientes.filter(c =>
      c.nombre.toLowerCase().includes(lq) ||
      c.telefono.includes(lq) ||
      c.numero_cliente.toLowerCase().includes(lq)
    )
  }, [clientes, q])

  function onClienteCreado(c: Cliente) {
    setClientes(prev => [c, ...prev].sort((a, b) => a.nombre.localeCompare(b.nombre)))
    setShowNuevo(false)
  }

  return (
    <div className="p-4 md:p-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <Users className="text-violet-600" size={22} />
          <h1 className="text-lg font-bold text-slate-800">Clientes</h1>
          <span className="text-xs bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full">
            {clientes.length}
          </span>
        </div>
        <button
          onClick={() => setShowNuevo(true)}
          className="flex items-center gap-1.5 bg-violet-600 text-white px-3 py-2 rounded-lg text-sm font-medium hover:bg-violet-700"
        >
          <Plus size={16} /> Nuevo cliente
        </button>
      </div>

      {/* Search */}
      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
        <input
          value={q} onChange={e => setQ(e.target.value)}
          placeholder="Buscar por nombre, teléfono o N° cliente…"
          className="w-full pl-9 pr-4 py-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
        />
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        {filtrados.length === 0 ? (
          <div className="text-center py-12 text-slate-400 text-sm">
            {q ? 'Sin resultados' : 'Aún no hay clientes registrados'}
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wide">
              <tr>
                <th className="px-4 py-3 text-left">N° Cliente</th>
                <th className="px-4 py-3 text-left">Nombre</th>
                <th className="px-4 py-3 text-left">Teléfono</th>
                <th className="px-4 py-3 text-left">Tipo</th>
                <th className="px-4 py-3 text-left">Promo</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtrados.map(c => (
                <tr key={c.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-4 py-3 font-mono text-xs text-violet-700 font-semibold">
                    {c.numero_cliente}
                  </td>
                  <td className="px-4 py-3 font-medium text-slate-800">{c.nombre}</td>
                  <td className="px-4 py-3 text-slate-600 flex items-center gap-1">
                    <Phone size={12} className="text-slate-400" />{c.telefono}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium capitalize ${TIPO_BADGE[c.tipo] ?? ''}`}>
                      {c.tipo}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    {c.recibe_promo
                      ? <Mail size={14} className="text-green-500" />
                      : <span className="text-slate-300 text-xs">—</span>}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link href={`/clientes/${c.id}`}
                      className="text-xs text-violet-600 hover:text-violet-800 font-medium">
                      Ver →
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {showNuevo && (
        <NuevoClienteModal
          onCreado={onClienteCreado}
          onCerrar={() => setShowNuevo(false)}
        />
      )}
    </div>
  )
}
```

**`src/app/clientes/NuevoClienteModal.tsx`:**

```tsx
'use client'
import { useState }      from 'react'
import { X, UserPlus }   from 'lucide-react'
import type { Cliente }  from '@/lib/types'

interface Props {
  onCreado: (c: Cliente) => void
  onCerrar: () => void
}

const EMPTY = { nombre: '', telefono: '', correo: '', tipo: 'frecuente', recibe_promo: false, notas: '' }

export default function NuevoClienteModal({ onCreado, onCerrar }: Props) {
  const [form, setForm]     = useState(EMPTY)
  const [error, setError]   = useState('')
  const [saving, setSaving] = useState(false)

  const set = (k: keyof typeof EMPTY) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm(p => ({ ...p, [k]: e.target.value }))

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setSaving(true)
    try {
      const res  = await fetch('/api/clientes', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error ?? 'Error al crear cliente'); return }
      onCreado(data as Cliente)
    } catch { setError('Error de conexión') }
    finally { setSaving(false) }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl">
        <div className="flex items-center justify-between p-5 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <UserPlus size={18} className="text-violet-600" />
            <h2 className="font-semibold text-slate-800">Nuevo cliente</h2>
          </div>
          <button onClick={onCerrar} className="text-slate-400 hover:text-slate-600">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={submit} className="p-5 space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Nombre *</label>
            <input value={form.nombre} onChange={set('nombre')} required
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
              placeholder="María García" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Teléfono * (clave única)</label>
            <input value={form.telefono} onChange={set('telefono')} required type="tel"
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
              placeholder="5551234567" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Correo</label>
            <input value={form.correo} onChange={set('correo')} type="email"
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
              placeholder="maria@ejemplo.com" />
          </div>
          <div className="flex gap-3">
            <div className="flex-1">
              <label className="block text-xs font-medium text-slate-600 mb-1">Tipo</label>
              <select value={form.tipo} onChange={set('tipo')}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500">
                <option value="frecuente">Frecuente</option>
                <option value="mayorista">Mayorista</option>
              </select>
            </div>
            <div className="flex items-end pb-1">
              <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
                <input type="checkbox" checked={form.recibe_promo}
                  onChange={e => setForm(p => ({ ...p, recibe_promo: e.target.checked }))}
                  className="accent-violet-600" />
                Recibe promos
              </label>
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Notas</label>
            <textarea value={form.notas} onChange={set('notas')} rows={2}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 resize-none"
              placeholder="Pedidos frecuentes, preferencias, etc." />
          </div>

          {error && <p className="text-red-600 text-xs">{error}</p>}

          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onCerrar}
              className="flex-1 border border-slate-200 text-slate-600 rounded-lg py-2 text-sm hover:bg-slate-50">
              Cancelar
            </button>
            <button type="submit" disabled={saving}
              className="flex-1 bg-violet-600 text-white rounded-lg py-2 text-sm font-medium hover:bg-violet-700 disabled:opacity-50">
              {saving ? 'Guardando…' : 'Crear cliente'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
```

**Verificación:**
- [ ] `/clientes` carga sin errores
- [ ] Botón "Nuevo cliente" abre el modal
- [ ] Crear cliente con teléfono nuevo → aparece en la lista con `CLI-0001`
- [ ] Crear cliente con teléfono repetido → muestra error "El teléfono ya está registrado"
- [ ] Búsqueda por nombre/teléfono/número filtra la tabla
- [ ] Link "Ver →" navega a `/clientes/[id]`

---

### Tarea 6: Detalle de cliente

**Objetivo:** Página `/clientes/[id]` con info del cliente y su historial de tickets.

**Archivo a crear:** `src/app/clientes/[id]/page.tsx`

```typescript
import { createAdminClient } from '@/lib/supabase/admin'
import { requirePermiso }    from '@/lib/permisos-server'
import AppShell              from '@/components/AppShell'
import Link                  from 'next/link'
import { notFound }          from 'next/navigation'
import { ArrowLeft, User, Phone, Mail, FileText, Tag } from 'lucide-react'
import type { Cliente, Venta } from '@/lib/types'

export const dynamic = 'force-dynamic'

function formatMXN(n: number) {
  return new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 0 }).format(n)
}

function formatFecha(iso: string) {
  return new Date(iso).toLocaleDateString('es-MX', {
    timeZone: 'America/Mexico_City',
    day: 'numeric', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

export default async function ClienteDetallePage({ params }: { params: { id: string } }) {
  await requirePermiso('clientes.ver')
  const admin = createAdminClient()

  const [{ data: cliente }, { data: tickets }] = await Promise.all([
    admin.from('clientes').select('*').eq('id', params.id).single(),
    admin.from('ventas')
      .select('id, total, cupon_pct, descuento, numero_ticket, metodo, created_at, venta_items(cantidad, precio_unitario, subtotal, productos(nombre))')
      .eq('cliente_id', params.id)
      .order('created_at', { ascending: false })
      .limit(100),
  ])

  if (!cliente) notFound()

  const totalGastado = (tickets ?? []).reduce((s: number, v: any) => s + Number(v.total), 0)
  const TIPO_BADGE: Record<string, string> = {
    frecuente: 'bg-blue-50 text-blue-700',
    mayorista: 'bg-amber-50 text-amber-700',
  }

  return (
    <AppShell>
      <div className="p-4 md:p-6 max-w-3xl mx-auto">
        {/* Back */}
        <Link href="/clientes" className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700 mb-5">
          <ArrowLeft size={16} /> Clientes
        </Link>

        {/* Card info */}
        <div className="bg-white rounded-xl border border-slate-200 p-5 mb-6">
          <div className="flex items-start justify-between mb-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-violet-100 rounded-full flex items-center justify-center">
                <User size={18} className="text-violet-600" />
              </div>
              <div>
                <h1 className="font-bold text-slate-800 text-lg">{(cliente as Cliente).nombre}</h1>
                <span className="font-mono text-xs text-violet-600 font-semibold">{(cliente as Cliente).numero_cliente}</span>
              </div>
            </div>
            <span className={`text-xs px-2.5 py-1 rounded-full font-medium capitalize ${TIPO_BADGE[(cliente as Cliente).tipo] ?? ''}`}>
              {(cliente as Cliente).tipo}
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm text-slate-600">
            <div className="flex items-center gap-2">
              <Phone size={14} className="text-slate-400" /> {(cliente as Cliente).telefono}
            </div>
            {(cliente as Cliente).correo && (
              <div className="flex items-center gap-2">
                <Mail size={14} className="text-slate-400" /> {(cliente as Cliente).correo}
              </div>
            )}
            <div className="flex items-center gap-2">
              <Tag size={14} className="text-slate-400" />
              {(cliente as Cliente).recibe_promo ? 'Recibe promociones' : 'No recibe promociones'}
            </div>
            {(cliente as Cliente).notas && (
              <div className="flex items-start gap-2 col-span-full">
                <FileText size={14} className="text-slate-400 mt-0.5" /> {(cliente as Cliente).notas}
              </div>
            )}
          </div>

          <div className="mt-4 pt-4 border-t border-slate-100 flex gap-6 text-sm">
            <div>
              <p className="text-slate-400 text-xs">Total compras</p>
              <p className="font-bold text-slate-800">{tickets?.length ?? 0} tickets</p>
            </div>
            <div>
              <p className="text-slate-400 text-xs">Total gastado</p>
              <p className="font-bold text-green-700">{formatMXN(totalGastado)}</p>
            </div>
          </div>
        </div>

        {/* Historial de tickets */}
        <h2 className="text-sm font-semibold text-slate-700 mb-3">Historial de tickets</h2>
        {!tickets?.length ? (
          <div className="text-center py-8 text-slate-400 text-sm bg-white rounded-xl border border-slate-200">
            Aún no hay compras registradas
          </div>
        ) : (
          <div className="space-y-2">
            {(tickets as any[]).map(t => (
              <details key={t.id} className="bg-white rounded-xl border border-slate-200">
                <summary className="flex items-center justify-between px-4 py-3 cursor-pointer list-none hover:bg-slate-50 rounded-xl">
                  <div className="flex items-center gap-3">
                    <span className="font-mono text-xs text-violet-600 font-semibold">
                      {t.numero_ticket ?? '—'}
                    </span>
                    <span className="text-xs text-slate-500">{formatFecha(t.created_at)}</span>
                    {t.cupon_pct && (
                      <span className="text-xs bg-green-50 text-green-700 px-1.5 py-0.5 rounded font-medium">
                        -{t.cupon_pct}% Off
                      </span>
                    )}
                  </div>
                  <span className="font-bold text-slate-800">{formatMXN(Number(t.total))}</span>
                </summary>
                <div className="px-4 pb-3 border-t border-slate-100 mt-1">
                  {(t.cupon_pct && t.descuento) && (
                    <p className="text-xs text-green-600 mb-2">
                      Descuento: {formatMXN(Number(t.descuento))} ({t.cupon_pct}% Off)
                    </p>
                  )}
                  <ul className="text-xs text-slate-600 space-y-0.5">
                    {(t.venta_items ?? []).map((item: any, i: number) => (
                      <li key={i} className="flex justify-between">
                        <span>{item.productos?.nombre ?? '—'} × {item.cantidad}</span>
                        <span>{formatMXN(Number(item.subtotal))}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </details>
            ))}
          </div>
        )}
      </div>
    </AppShell>
  )
}
```

**Verificación:**
- [ ] `/clientes/[id]` muestra info del cliente
- [ ] Muestra historial de tickets (vacío si no hay ventas)
- [ ] `<details>` expande para mostrar items del ticket
- [ ] Muestra badge de cupon si aplica

---

## Fase D — POS Integration

### Tarea 7: PaymentModal — cupones

**Objetivo:** Añadir 4 botones de cupón en el PaymentModal antes del botón de confirmar.

**Archivos a modificar:** `src/app/venta/PaymentModal.tsx`

**Cambios a la interfaz `PaymentData`** (exportada desde el mismo archivo):

```typescript
// En la interface PaymentData, añadir:
cuponPct?:  number | null
descuento?: number | null
```

**Nuevos estados a añadir en el componente PaymentModal** (justo después de los estados existentes):

```typescript
const [cuponPct, setCuponPct] = useState<number | null>(null)
```

**Cálculo de total con descuento** (añadir antes del return):

```typescript
const descuento         = cuponPct ? Math.round(props.total * cuponPct) / 100 : 0
const totalConDescuento = props.total - descuento
```

Nota: todos los cálculos de cambio/validación de pago deben usar `totalConDescuento` en vez de `props.total`.

**Botones de cupón** (insertar justo antes del botón "Confirmar pago"):

```tsx
{/* Cupones */}
<div className="border-t border-slate-100 pt-3 mt-1">
  <p className="text-xs text-slate-500 mb-2 font-medium">Cupón de descuento</p>
  <div className="grid grid-cols-4 gap-2">
    {[5, 10, 15, 20].map(pct => (
      <button
        key={pct}
        type="button"
        onClick={() => setCuponPct(cuponPct === pct ? null : pct)}
        className={`py-1.5 rounded-lg text-xs font-bold border transition-all ${
          cuponPct === pct
            ? 'bg-green-600 text-white border-green-600 shadow-sm'
            : 'bg-white text-slate-600 border-slate-200 hover:border-green-400 hover:text-green-700'
        }`}
      >
        {pct}% Off
      </button>
    ))}
  </div>
  {cuponPct && (
    <div className="mt-2 flex justify-between text-sm">
      <span className="text-slate-500">Descuento</span>
      <span className="text-green-600 font-semibold">−${descuento.toFixed(2)}</span>
    </div>
  )}
</div>

{/* Total con descuento destacado si hay cupón */}
{cuponPct && (
  <div className="flex justify-between items-center bg-green-50 rounded-lg px-3 py-2 mt-2">
    <span className="text-sm font-semibold text-green-800">Total con descuento</span>
    <span className="text-lg font-bold text-green-700">
      ${totalConDescuento.toFixed(2)}
    </span>
  </div>
)}
```

**Modificar el `onConfirmar`** para incluir cupón en el payload:

```typescript
// En la función de confirmar pago, añadir al objeto PaymentData:
cuponPct:  cuponPct,
descuento: descuento > 0 ? descuento : null,
```

**Verificación:**
- [ ] Los 4 botones aparecen en el modal de pago
- [ ] Clic en "10% Off" activa el botón y muestra "−$X.XX"
- [ ] Clic de nuevo desactiva el cupón
- [ ] El total a pagar se reduce correctamente
- [ ] El cambio en efectivo se calcula sobre el total con descuento

---

### Tarea 8: VentaClient — cliente lookup + save con nuevos campos

**Objetivo:** Añadir búsqueda opcional de cliente al inicio de la venta y pasar `cliente_id`, `cupon_pct`, `descuento`, `numero_ticket` al save.

**Archivos a modificar:** `src/app/venta/VentaClient.tsx`

**A) Nuevos imports y estados** (añadir cerca de los imports):

```typescript
import type { Cliente } from '@/lib/types'
```

```typescript
// Estados del cliente (añadir junto a los otros useState)
const [clienteActual, setClienteActual] = useState<Cliente | null>(null)
const [busquedaCliente, setBusquedaCliente] = useState('')
const [buscandoCliente, setBuscandoCliente] = useState(false)
const [clienteError, setClienteError] = useState('')
```

**B) Función de búsqueda de cliente** (añadir antes de `confirmarVenta`):

```typescript
async function buscarCliente(q: string) {
  if (!q.trim()) return
  setBuscandoCliente(true)
  setClienteError('')
  try {
    const res  = await fetch(`/api/clientes/buscar?q=${encodeURIComponent(q.trim())}`)
    const data = await res.json()
    if (data) setClienteActual(data as Cliente)
    else setClienteError('No se encontró ningún cliente con ese dato')
  } catch { setClienteError('Error de conexión') }
  finally { setBuscandoCliente(false) }
}
```

**C) Widget de cliente** — añadir en la barra lateral del carrito o como sección sobre los botones de pago. Insertar en la sección del carrito (panel derecho), antes del botón "Cobrar":

```tsx
{/* Lookup de cliente */}
<div className="border-b border-slate-100 px-3 py-2">
  {clienteActual ? (
    <div className="flex items-center justify-between">
      <div>
        <p className="text-xs text-slate-500">Cliente</p>
        <p className="text-sm font-semibold text-violet-700">{clienteActual.nombre}</p>
        <p className="text-xs text-slate-400 font-mono">{clienteActual.numero_cliente}</p>
      </div>
      <button
        onClick={() => { setClienteActual(null); setBusquedaCliente('') }}
        className="text-xs text-slate-400 hover:text-red-500"
      >✕</button>
    </div>
  ) : (
    <div>
      <p className="text-xs text-slate-500 mb-1">Cliente (opcional)</p>
      <div className="flex gap-1">
        <input
          value={busquedaCliente}
          onChange={e => { setBusquedaCliente(e.target.value); setClienteError('') }}
          onKeyDown={e => e.key === 'Enter' && buscarCliente(busquedaCliente)}
          placeholder="N° o teléfono"
          className="flex-1 text-xs border border-slate-200 rounded px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-violet-400"
        />
        <button
          onClick={() => buscarCliente(busquedaCliente)}
          disabled={buscandoCliente}
          className="text-xs bg-slate-100 hover:bg-slate-200 px-2 py-1.5 rounded"
        >
          {buscandoCliente ? '…' : 'Buscar'}
        </button>
      </div>
      {clienteError && <p className="text-xs text-red-500 mt-1">{clienteError}</p>}
    </div>
  )}
</div>
```

**D) Modificar `confirmarVenta`** para obtener el ticket y pasar los datos nuevos:

```typescript
// Al inicio de confirmarVenta, antes del insert de venta:
// 1. Obtener número de ticket
let numeroTicket: string | null = null
try {
  const res = await fetch('/api/ventas/ticket-num', { method: 'POST' })
  if (res.ok) {
    const d = await res.json()
    numeroTicket = d.numero_ticket
  }
} catch { /* no bloquear la venta si falla el ticket num */ }

// 2. En el insert de ventas, añadir los nuevos campos:
const { data: ventaData, error: ventaError } = await supabase
  .from('ventas')
  .insert({
    total:               totalCarrito(carrito),
    metodo:              payment.metodo,
    monto_efectivo:      payment.montoEfectivo,
    monto_tarjeta:       payment.montoTarjeta,
    monto_transferencia: payment.montoTransferencia,
    cambio:              payment.cambio,
    cajero_id:           user?.id ?? null,
    // Nuevos campos:
    cliente_id:    clienteActual?.id ?? null,
    cupon_pct:     payment.cuponPct ?? null,
    descuento:     payment.descuento ?? null,
    numero_ticket: numeroTicket,
  })
  .select('id')
  .single()
```

**E) Pasar datos a `setVentaExitosa`** para que TicketPrint los reciba:

```typescript
// Añadir al setVentaExitosa (state que pasa datos al TicketPrint):
setVentaExitosa({
  items: [...carrito],
  total: ventaTotal,
  hora,
  payment,
  // Nuevos:
  numeroTicket,
  clienteNombre: clienteActual?.nombre ?? null,
  clienteNumero: clienteActual?.numero_cliente ?? null,
})
// Limpiar estado de cliente
setClienteActual(null)
setBusquedaCliente('')
```

El estado `ventaExitosa` necesita el tipo actualizado. Buscarlo y añadir los 3 campos nuevos.

**Verificación:**
- [ ] Widget de búsqueda aparece en el carrito
- [ ] Buscar por teléfono encuentra al cliente
- [ ] "Cobrar" abre el PaymentModal con el cupón disponible
- [ ] La venta se guarda con `cliente_id`, `cupon_pct`, `descuento`, `numero_ticket` en Supabase
- [ ] Limpiar carrito también resetea el cliente

---

### Tarea 9: TicketPrint — campos nuevos

**Objetivo:** Mostrar `numero_ticket` y `clienteNombre/Numero` en el ticket.

**Archivo a modificar:** `src/app/venta/TicketPrint.tsx`

**Cambios en Props** (añadir los 3 campos):

```typescript
interface Props {
  // ... campos existentes ...
  numeroTicket?:  string | null
  clienteNombre?: string | null
  clienteNumero?: string | null
}
```

**En el JSX del ticket**, insertar después del header (logo/nombre tienda) y antes de los items:

```tsx
{/* Ticket number + Cliente */}
<div className="border-b border-dashed border-slate-300 pb-2 mb-2 text-center">
  {props.numeroTicket && (
    <p className="text-xs font-mono font-bold text-slate-700">
      Ticket: {props.numeroTicket}
    </p>
  )}
  {props.clienteNombre && (
    <p className="text-xs text-slate-600">
      Cliente: {props.clienteNumero ? `${props.clienteNumero} — ` : ''}{props.clienteNombre}
    </p>
  )}
</div>
```

**Pasar los props desde VentaClient** — en el `<TicketPrint>` dentro de VentaClient:

```tsx
<TicketPrint
  // ... props existentes ...
  numeroTicket={ventaExitosa.numeroTicket}
  clienteNombre={ventaExitosa.clienteNombre}
  clienteNumero={ventaExitosa.clienteNumero}
/>
```

**Verificación:**
- [ ] Ticket sin cliente: sólo muestra el número de ticket
- [ ] Ticket con cliente: muestra "CLI-0001 — María García"
- [ ] Ticket con cupón: muestra el descuento en el desglose de pago (ya lo hace PaymentModal — verificar que se pase)

---

## Fase E — Dashboard + Sidebar

### Tarea 10: Dashboard — historial de tickets y alertas de cupones

**Objetivo:** Añadir dos nuevas secciones al dashboard de la dueña.

**Archivo a modificar:** `src/app/dashboard/page.tsx`

**Nuevas queries** (añadir al `Promise.all` existente):

```typescript
supabase.from('ventas')
  .select('id, total, cupon_pct, descuento, numero_ticket, created_at, clientes(nombre, numero_cliente)')
  .not('numero_ticket', 'is', null)
  .order('created_at', { ascending: false })
  .limit(15),

supabase.from('ventas')
  .select('id, total, cupon_pct, descuento, numero_ticket, created_at, clientes(nombre, numero_cliente)')
  .not('cupon_pct', 'is', null)
  .order('created_at', { ascending: false })
  .limit(8),
```

Extraer en las variables: `{ data: ticketsRecientes }` y `{ data: cuponesUsados }`.

**Nueva sección "Historial de tickets"** (añadir antes del cierre del main, después de los cortes de caja existentes):

```tsx
{/* ── Historial de tickets ──────────────────────── */}
{ticketsRecientes && ticketsRecientes.length > 0 && (
  <section>
    <h2 className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2">
      <Receipt size={16} className="text-violet-500" /> Tickets recientes
    </h2>
    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
      <table className="w-full text-sm">
        <thead className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wide">
          <tr>
            <th className="px-4 py-2 text-left">Ticket</th>
            <th className="px-4 py-2 text-left">Fecha</th>
            <th className="px-4 py-2 text-left">Cliente</th>
            <th className="px-4 py-2 text-right">Total</th>
            <th className="px-4 py-2 text-right">Cupón</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {(ticketsRecientes as any[]).map(t => (
            <tr key={t.id} className="hover:bg-slate-50">
              <td className="px-4 py-2 font-mono text-xs text-violet-600 font-semibold">
                {t.numero_ticket}
              </td>
              <td className="px-4 py-2 text-slate-500 text-xs">
                {tiempoRelativo(t.created_at)}
              </td>
              <td className="px-4 py-2 text-slate-700 text-xs">
                {t.clientes?.nombre ?? <span className="text-slate-300">—</span>}
              </td>
              <td className="px-4 py-2 text-right font-semibold text-slate-800">
                {formatMXNFull(Number(t.total))}
              </td>
              <td className="px-4 py-2 text-right">
                {t.cupon_pct
                  ? <span className="text-xs bg-green-50 text-green-700 px-1.5 py-0.5 rounded">-{t.cupon_pct}%</span>
                  : <span className="text-slate-300 text-xs">—</span>}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  </section>
)}

{/* ── Alertas de cupones ────────────────────────── */}
{cuponesUsados && cuponesUsados.length > 0 && (
  <section>
    <h2 className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2">
      <Zap size={16} className="text-amber-500" /> Cupones usados recientemente
      <span className="bg-amber-100 text-amber-700 text-xs px-2 py-0.5 rounded-full font-semibold">
        {cuponesUsados.length}
      </span>
    </h2>
    <div className="grid gap-2">
      {(cuponesUsados as any[]).map(t => (
        <div key={t.id} className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 flex justify-between items-center">
          <div>
            <span className="font-mono text-xs text-violet-600 font-semibold mr-2">{t.numero_ticket ?? '—'}</span>
            <span className="text-sm font-bold text-amber-700">{t.cupon_pct}% Off</span>
            {t.clientes && (
              <span className="text-xs text-slate-500 ml-2">· {t.clientes.nombre}</span>
            )}
          </div>
          <div className="text-right">
            <p className="text-xs text-red-500">−{formatMXNFull(Number(t.descuento ?? 0))}</p>
            <p className="text-sm font-bold text-slate-800">{formatMXNFull(Number(t.total))}</p>
          </div>
        </div>
      ))}
    </div>
  </section>
)}
```

**Verificación:**
- [ ] Dashboard muestra tabla "Tickets recientes" cuando hay ventas con `numero_ticket`
- [ ] Dashboard muestra "Cupones usados" con badge de conteo cuando hay ventas con `cupon_pct`
- [ ] Las alertas de cupón muestran el descuento aplicado en rojo

---

### Tarea 11: Sidebar — activar módulo clientes

**Objetivo:** Marcar `clientes` como `built: true` para que el link funcione en el menú.

**Archivo a modificar:** `src/components/Sidebar.tsx`

Buscar la entrada del módulo `clientes` en el array `MODULES`:

```typescript
// Cambiar:
{ id: 'clientes', href: '/clientes', built: false }
// Por:
{ id: 'clientes', href: '/clientes', built: true }
```

**Verificación:**
- [ ] El link "Clientes" en el sidebar es clickeable y navega a `/clientes`
- [ ] No muestra el badge "Próximamente"

---

## Orden de ejecución recomendado

```
Tarea 1 (SQL)         → prerequisito de todo
Tarea 2 (types)       → prerequisito de tareas 3-10
Tareas 3+4 (APIs)     → en paralelo entre sí
Tarea 5 (/clientes)   → después de Tarea 3
Tarea 6 (/clientes/[id]) → después de Tarea 3
Tarea 7 (PaymentModal) → en paralelo con Tarea 5/6
Tarea 8 (VentaClient) → después de Tareas 4 y 7
Tarea 9 (TicketPrint) → después de Tarea 8
Tarea 10 (Dashboard)  → después de Tarea 1
Tarea 11 (Sidebar)    → en paralelo con cualquiera
```

---

## Notas finales

- **`telefono` es la clave universal** — nunca usar email como identificador
- **`total` en ventas = monto final pagado** (ya con descuento aplicado) — `descuento` guarda el monto de la reducción por separado
- **`numero_ticket`** puede ser `null` si la API falla — la venta NO se bloquea por esto
- **`stock_ledger` es append-only** — no modificar esta lógica en `confirmarVenta`
- **Todos los writes a `clientes` y `ticket_secuencia`** van por el admin client (API routes), nunca por el browser client
- Las ventas existentes sin `numero_ticket` son válidas — el campo es nullable
