# Plan: Módulo Proveedores + Estructura de Costos
**Fecha:** 2026-06-02  
**Objetivo:** Adeudos a Proveedores + Costos Fijos → dashboard con datos reales

---

## Decisiones de arquitectura

- **Patrón existente**: server page fetches data → pasa a client components para interactividad
- **Mutaciones**: Supabase client directo en componentes cliente (sin server actions)
- **Costos de mercancía**: calculados dinámicamente de `stock_ledger` (no tabla separada)
- **Admin-only**: ambos módulos requieren `adminOnly: true` en sidebar
- **Fechas vencimiento**: guardadas como `DATE` en Supabase, comparadas en JS

---

## PASO 0 — SQL en Supabase (el usuario lo ejecuta)

```sql
-- ── Proveedores ───────────────────────────────────────────────
CREATE TABLE proveedores (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre          TEXT NOT NULL,
  contacto_nombre TEXT,
  contacto_tel    TEXT,
  notas           TEXT,
  activo          BOOLEAN NOT NULL DEFAULT true,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE proveedores ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth users can read proveedores"
  ON proveedores FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "auth users can insert proveedores"
  ON proveedores FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "auth users can update proveedores"
  ON proveedores FOR UPDATE USING (auth.role() = 'authenticated');

-- ── Adeudos (cuentas por pagar) ───────────────────────────────
CREATE TABLE adeudos (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  proveedor_id      UUID NOT NULL REFERENCES proveedores(id) ON DELETE CASCADE,
  descripcion       TEXT NOT NULL,
  monto             DECIMAL(12,2) NOT NULL CHECK (monto > 0),
  fecha_vencimiento DATE NOT NULL,
  estado            TEXT NOT NULL DEFAULT 'pendiente'
                    CHECK (estado IN ('pendiente','pagado')),
  fecha_pago        DATE,
  notas             TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by        UUID REFERENCES auth.users(id)
);

ALTER TABLE adeudos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth users can read adeudos"
  ON adeudos FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "auth users can insert adeudos"
  ON adeudos FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "auth users can update adeudos"
  ON adeudos FOR UPDATE USING (auth.role() = 'authenticated');
CREATE POLICY "auth users can delete adeudos"
  ON adeudos FOR DELETE USING (auth.role() = 'authenticated');

-- ── Costos fijos ──────────────────────────────────────────────
CREATE TABLE costos_fijos (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  categoria  TEXT NOT NULL
             CHECK (categoria IN ('personal','renta','servicios','marketing','otros')),
  nombre     TEXT NOT NULL,
  monto      DECIMAL(12,2) NOT NULL CHECK (monto > 0),
  periodo    TEXT NOT NULL DEFAULT 'mensual'
             CHECK (periodo IN ('mensual','quincenal','semanal','anual','unico')),
  activo     BOOLEAN NOT NULL DEFAULT true,
  notas      TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE costos_fijos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth users can read costos_fijos"
  ON costos_fijos FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "auth users can insert costos_fijos"
  ON costos_fijos FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "auth users can update costos_fijos"
  ON costos_fijos FOR UPDATE USING (auth.role() = 'authenticated');
CREATE POLICY "auth users can delete costos_fijos"
  ON costos_fijos FOR DELETE USING (auth.role() = 'authenticated');
```

---

## Archivos a crear/modificar

| Archivo | Acción | Responsabilidad |
|---|---|---|
| `src/lib/types.ts` | Modificar | Añadir tipos Proveedor, Adeudo, CostoFijo |
| `src/components/Sidebar.tsx` | Modificar | Añadir módulos Proveedores y Costos |
| `src/app/proveedores/page.tsx` | Crear | Server page: fetch + layout |
| `src/app/proveedores/ProveedoresClient.tsx` | Crear | Lista interactiva con modales |
| `src/app/proveedores/NuevoProveedorModal.tsx` | Crear | Modal crear proveedor |
| `src/app/proveedores/AdeudoModal.tsx` | Crear | Modal crear/editar adeudo |
| `src/app/costos/page.tsx` | Crear | Server page: fetch + layout |
| `src/app/costos/CostosClient.tsx` | Crear | Lista costos + modal inline |
| `src/app/costos/CostoModal.tsx` | Crear | Modal crear/editar costo |
| `src/app/dashboard/page.tsx` | Modificar | Queries reales para donut y panel proveedores |

---

## Tarea 1: Tipos TypeScript

**Objetivo:** Añadir los tipos Proveedor, Adeudo y CostoFijo a `src/lib/types.ts`

**Archivos a modificar:**
- `src/lib/types.ts` — añadir al final del archivo

**Implementación:**
```typescript
// ── Proveedores ───────────────────────────────────────────────
export interface Proveedor {
  id:              string
  nombre:          string
  contacto_nombre: string | null
  contacto_tel:    string | null
  notas:           string | null
  activo:          boolean
  created_at:      string
  adeudos?:        Adeudo[]
}

export interface Adeudo {
  id:                string
  proveedor_id:      string
  descripcion:       string
  monto:             number
  fecha_vencimiento: string   // 'YYYY-MM-DD'
  estado:            'pendiente' | 'pagado'
  fecha_pago:        string | null
  notas:             string | null
  created_at:        string
  proveedores?:      { nombre: string }
}

// ── Costos fijos ──────────────────────────────────────────────
export type CostoCategoria = 'personal' | 'renta' | 'servicios' | 'marketing' | 'otros'
export type CostoPeriodo   = 'mensual' | 'quincenal' | 'semanal' | 'anual' | 'unico'

export interface CostoFijo {
  id:         string
  categoria:  CostoCategoria
  nombre:     string
  monto:      number
  periodo:    CostoPeriodo
  activo:     boolean
  notas:      string | null
  created_at: string
}

// Convierte cualquier período a equivalente mensual para comparar
export function costoMensual(costo: CostoFijo): number {
  const m: Record<CostoPeriodo, number> = {
    mensual:    1,
    quincenal:  2,
    semanal:    4.33,
    anual:      1 / 12,
    unico:      1 / 12,  // amortizado en 12 meses
  }
  return costo.monto * m[costo.periodo]
}

export const CATEGORIA_META: Record<CostoCategoria, { label: string; color: string; bg: string }> = {
  personal:   { label: 'Personal',   color: '#8b5cf6', bg: 'bg-purple-50 text-purple-700' },
  renta:      { label: 'Renta',      color: '#3b82f6', bg: 'bg-blue-50 text-blue-700'    },
  servicios:  { label: 'Servicios',  color: '#f59e0b', bg: 'bg-amber-50 text-amber-700'  },
  marketing:  { label: 'Marketing',  color: '#ec4899', bg: 'bg-pink-50 text-pink-700'    },
  otros:      { label: 'Otros',      color: '#94a3b8', bg: 'bg-slate-100 text-slate-600' },
}
```

**Verificación:**
- [ ] El build de Next.js pasa sin errores de tipo

---

## Tarea 2: Sidebar — agregar módulos

**Objetivo:** Añadir "Proveedores" y "Costos" al nav, ambos admin-only, ambos `built: true`.

**Archivos a modificar:**
- `src/components/Sidebar.tsx`

**Implementación:**
```typescript
// Añadir imports
import { Building2, Receipt } from 'lucide-react'

// En el array MODULES, insertar ANTES de dashboard:
{ id: 'proveedores', label: 'Proveedores', href: '/proveedores', icon: Building2, built: true,  adminOnly: true },
{ id: 'costos',      label: 'Costos',      href: '/costos',      icon: Receipt,   built: true,  adminOnly: true },
```

**Verificación:**
- [ ] Admin ve los dos módulos en el sidebar
- [ ] Cajero NO los ve

---

## Tarea 3: Página de Proveedores — server page

**Objetivo:** Server component que fetch proveedores + adeudos pendientes y renderiza la vista.

**Archivos a crear:**
- `src/app/proveedores/page.tsx`

**Implementación:**
```typescript
import { createClient } from '@/lib/supabase/server'
import AppShell from '@/components/AppShell'
import ProveedoresClient from './ProveedoresClient'

export const revalidate = 0

export default async function ProveedoresPage() {
  const supabase = await createClient()

  const [{ data: proveedores }, { data: adeudos }] = await Promise.all([
    supabase.from('proveedores').select('*').eq('activo', true).order('nombre'),
    supabase.from('adeudos')
      .select('*, proveedores(nombre)')
      .order('fecha_vencimiento', { ascending: true }),
  ])

  return (
    <AppShell>
      <ProveedoresClient
        proveedoresIniciales={proveedores ?? []}
        adeudosIniciales={adeudos ?? []}
      />
    </AppShell>
  )
}
```

**Verificación:**
- [ ] La página carga en `/proveedores` sin errores
- [ ] Pasa datos al client component correctamente

---

## Tarea 4: ProveedoresClient — lista interactiva

**Objetivo:** Client component principal: lista proveedores con sus adeudos, filtros de urgencia, acciones.

**Archivos a crear:**
- `src/app/proveedores/ProveedoresClient.tsx`

**Implementación (esqueleto completo):**
```typescript
'use client'

import { useState } from 'react'
import { Plus, Building2, AlertTriangle, CheckCircle2, Clock } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import type { Proveedor, Adeudo } from '@/lib/types'
import NuevoProveedorModal from './NuevoProveedorModal'
import AdeudoModal from './AdeudoModal'

type Filtro = 'todos' | 'urgentes' | 'vencidos' | 'pagados'

function diasParaVencer(fecha: string): number {
  const hoy = new Date(); hoy.setHours(0,0,0,0)
  const venc = new Date(fecha + 'T00:00:00')
  return Math.ceil((venc.getTime() - hoy.getTime()) / 86_400_000)
}

function urgencia(adeudo: Adeudo): 'vencido' | 'urgente' | 'proximo' | 'ok' {
  if (adeudo.estado === 'pagado') return 'ok'
  const dias = diasParaVencer(adeudo.fecha_vencimiento)
  if (dias < 0)  return 'vencido'
  if (dias <= 3) return 'urgente'
  if (dias <= 7) return 'proximo'
  return 'ok'
}

interface Props {
  proveedoresIniciales: Proveedor[]
  adeudosIniciales:     Adeudo[]
}

export default function ProveedoresClient({ proveedoresIniciales, adeudosIniciales }: Props) {
  const [proveedores,     setProveedores]     = useState(proveedoresIniciales)
  const [adeudos,         setAdeudos]         = useState(adeudosIniciales)
  const [filtro,          setFiltro]          = useState<Filtro>('todos')
  const [showNewProv,     setShowNewProv]     = useState(false)
  const [showAdeudo,      setShowAdeudo]      = useState(false)
  const [proveedorActivo, setProveedorActivo] = useState<Proveedor | null>(null)
  const [adeudoEditar,    setAdeudoEditar]    = useState<Adeudo | null>(null)

  async function refresh() {
    const supabase = createClient()
    const [{ data: p }, { data: a }] = await Promise.all([
      supabase.from('proveedores').select('*').eq('activo', true).order('nombre'),
      supabase.from('adeudos').select('*, proveedores(nombre)').order('fecha_vencimiento', { ascending: true }),
    ])
    setProveedores(p ?? [])
    setAdeudos(a ?? [])
  }

  async function marcarPagado(adeudo: Adeudo) {
    await createClient().from('adeudos').update({
      estado: 'pagado',
      fecha_pago: new Date().toISOString().split('T')[0],
    }).eq('id', adeudo.id)
    await refresh()
  }

  // KPIs
  const pendientes = adeudos.filter(a => a.estado === 'pendiente')
  const totalDeuda = pendientes.reduce((s, a) => s + Number(a.monto), 0)
  const vencidos   = pendientes.filter(a => diasParaVencer(a.fecha_vencimiento) < 0)
  const urgentes   = pendientes.filter(a => { const d = diasParaVencer(a.fecha_vencimiento); return d >= 0 && d <= 3 })

  // Adeudos filtrados
  const adeudosFiltrados = adeudos.filter(a => {
    if (filtro === 'todos')    return a.estado === 'pendiente'
    if (filtro === 'vencidos') return a.estado === 'pendiente' && diasParaVencer(a.fecha_vencimiento) < 0
    if (filtro === 'urgentes') return a.estado === 'pendiente' && diasParaVencer(a.fecha_vencimiento) >= 0 && diasParaVencer(a.fecha_vencimiento) <= 7
    if (filtro === 'pagados')  return a.estado === 'pagado'
    return true
  })

  return (
    <div className="px-4 py-5 max-w-4xl mx-auto space-y-5">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Proveedores & Adeudos</h1>
          <p className="text-sm text-slate-500">Cuentas por pagar ordenadas por urgencia</p>
        </div>
        <button
          onClick={() => setShowNewProv(true)}
          className="flex items-center gap-2 h-10 px-4 bg-violet-600 hover:bg-violet-700 text-white text-sm font-semibold rounded-xl transition-colors"
        >
          <Plus className="w-4 h-4" />Nuevo proveedor
        </button>
      </div>

      {/* KPI strip */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-white rounded-2xl border border-slate-200 p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-1">Total adeudado</p>
          <p className="text-2xl font-bold text-slate-900">
            {new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 0 }).format(totalDeuda)}
          </p>
          <p className="text-xs text-slate-400 mt-0.5">{pendientes.length} adeudos pendientes</p>
        </div>
        <div className={`bg-white rounded-2xl border p-4 ${vencidos.length > 0 ? 'border-red-200 bg-red-50/30' : 'border-slate-200'}`}>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-1">Vencidos</p>
          <p className={`text-2xl font-bold ${vencidos.length > 0 ? 'text-red-600' : 'text-slate-900'}`}>{vencidos.length}</p>
          <p className="text-xs text-slate-400 mt-0.5">requieren atención</p>
        </div>
        <div className={`bg-white rounded-2xl border p-4 ${urgentes.length > 0 ? 'border-amber-200 bg-amber-50/30' : 'border-slate-200'}`}>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-1">Vencen en 3 días</p>
          <p className={`text-2xl font-bold ${urgentes.length > 0 ? 'text-amber-600' : 'text-slate-900'}`}>{urgentes.length}</p>
          <p className="text-xs text-slate-400 mt-0.5">adeudos urgentes</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-1 bg-slate-100 p-1 rounded-xl">
        {([['todos','Pendientes'],['urgentes','Esta semana'],['vencidos','Vencidos'],['pagados','Pagados']] as const).map(([id, label]) => (
          <button key={id} onClick={() => setFiltro(id)}
            className={`flex-1 h-8 rounded-lg text-xs font-semibold transition-colors ${
              filtro === id ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
            }`}
          >{label}</button>
        ))}
      </div>

      {/* Adeudos list */}
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
        {adeudosFiltrados.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <CheckCircle2 className="w-10 h-10 text-slate-200 mb-2" />
            <p className="text-sm text-slate-500">No hay adeudos en esta categoría</p>
          </div>
        ) : (
          <ul className="divide-y divide-slate-100">
            {adeudosFiltrados.map(a => {
              const urg  = urgencia(a)
              const dias = a.estado === 'pendiente' ? diasParaVencer(a.fecha_vencimiento) : null
              const prov = (a as any).proveedores?.nombre ?? '—'

              const urgColor = {
                vencido: 'text-red-600 bg-red-50 border-red-200',
                urgente: 'text-amber-600 bg-amber-50 border-amber-200',
                proximo: 'text-orange-600 bg-orange-50 border-orange-200',
                ok:      'text-slate-600 bg-slate-50 border-slate-200',
              }[urg]

              return (
                <li key={a.id} className="flex items-center gap-4 px-5 py-4 hover:bg-slate-50 transition-colors">
                  {/* Avatar */}
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-sm font-bold shrink-0 border ${urgColor}`}>
                    {prov.charAt(0).toUpperCase()}
                  </div>
                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-slate-900">{prov}</p>
                    <p className="text-xs text-slate-500 mt-0.5">{a.descripcion}</p>
                    <p className="text-xs text-slate-400 mt-0.5">
                      {a.estado === 'pagado'
                        ? `✓ Pagado ${a.fecha_pago ?? ''}`
                        : dias !== null && dias < 0
                          ? `Venció hace ${Math.abs(dias)} días`
                          : `Vence ${new Date(a.fecha_vencimiento + 'T00:00:00').toLocaleDateString('es-MX', { day: 'numeric', month: 'short' })}`
                          + (dias !== null ? ` (en ${dias} días)` : '')
                      }
                    </p>
                  </div>
                  {/* Monto */}
                  <div className="text-right shrink-0">
                    <p className={`text-base font-bold ${
                      a.estado === 'pagado' ? 'text-slate-400' :
                      urg === 'vencido' ? 'text-red-600' :
                      urg === 'urgente' ? 'text-amber-600' : 'text-slate-900'
                    }`}>
                      {new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 0 }).format(Number(a.monto))}
                    </p>
                    {a.estado === 'pendiente' && (
                      <button
                        onClick={() => marcarPagado(a)}
                        className="mt-1 text-[11px] text-violet-600 hover:text-violet-800 font-medium"
                      >
                        Marcar pagado
                      </button>
                    )}
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </div>

      {/* Proveedores list */}
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <p className="text-sm font-semibold text-slate-700">Proveedores registrados</p>
        </div>
        {proveedores.length === 0 ? (
          <div className="flex flex-col items-center py-10 text-center">
            <Building2 className="w-8 h-8 text-slate-200 mb-2" />
            <p className="text-sm text-slate-400">Agrega tu primer proveedor</p>
          </div>
        ) : (
          <ul className="divide-y divide-slate-100">
            {proveedores.map(p => {
              const deudaProv = pendientes.filter(a => a.proveedor_id === p.id)
              const totalProv = deudaProv.reduce((s, a) => s + Number(a.monto), 0)
              return (
                <li key={p.id} className="flex items-center gap-4 px-5 py-3 hover:bg-slate-50">
                  <div className="w-9 h-9 rounded-xl bg-violet-50 border border-violet-200 flex items-center justify-center text-sm font-bold text-violet-600 shrink-0">
                    {p.nombre.charAt(0)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-slate-900">{p.nombre}</p>
                    {p.contacto_tel && <p className="text-xs text-slate-400">{p.contacto_tel}</p>}
                  </div>
                  <div className="flex items-center gap-3">
                    {totalProv > 0 && (
                      <span className="text-xs font-semibold text-red-600 bg-red-50 border border-red-200 px-2 py-0.5 rounded-lg">
                        {new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 0 }).format(totalProv)}
                      </span>
                    )}
                    <button
                      onClick={() => { setProveedorActivo(p); setAdeudoEditar(null); setShowAdeudo(true) }}
                      className="text-xs text-violet-600 hover:text-violet-800 font-medium border border-violet-200 rounded-lg px-2 py-1"
                    >
                      + Adeudo
                    </button>
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </div>

      {/* Modals */}
      {showNewProv && (
        <NuevoProveedorModal
          onClose={() => setShowNewProv(false)}
          onSuccess={() => { setShowNewProv(false); refresh() }}
        />
      )}
      {showAdeudo && proveedorActivo && (
        <AdeudoModal
          proveedor={proveedorActivo}
          adeudo={adeudoEditar}
          onClose={() => { setShowAdeudo(false); setAdeudoEditar(null) }}
          onSuccess={() => { setShowAdeudo(false); setAdeudoEditar(null); refresh() }}
        />
      )}
    </div>
  )
}
```

**Verificación:**
- [ ] Se listan adeudos pendientes por defecto
- [ ] Los filtros (Pendientes / Esta semana / Vencidos / Pagados) cambian la lista
- [ ] "Marcar pagado" actualiza estado en Supabase y refresca
- [ ] KPIs reflejan los totales reales

---

## Tarea 5: NuevoProveedorModal

**Objetivo:** Modal para crear un nuevo proveedor con nombre, contacto y teléfono.

**Archivos a crear:**
- `src/app/proveedores/NuevoProveedorModal.tsx`

**Implementación:**
```typescript
'use client'

import { useState } from 'react'
import { X, Loader2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

interface Props { onClose: () => void; onSuccess: () => void }

export default function NuevoProveedorModal({ onClose, onSuccess }: Props) {
  const [nombre,  setNombre]  = useState('')
  const [tel,     setTel]     = useState('')
  const [contacto,setContacto]= useState('')
  const [notas,   setNotas]   = useState('')
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!nombre.trim()) { setError('El nombre es requerido'); return }
    setLoading(true)
    const { error: err } = await createClient().from('proveedores').insert({
      nombre: nombre.trim(),
      contacto_nombre: contacto.trim() || null,
      contacto_tel: tel.trim() || null,
      notas: notas.trim() || null,
    })
    if (err) { setError('Error al guardar. Intenta de nuevo.'); setLoading(false); return }
    onSuccess()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/40">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-xl">
        <div className="flex items-center justify-between p-5 pb-4 border-b border-slate-100">
          <h2 className="text-base font-semibold text-slate-900">Nuevo proveedor</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400">
            <X className="w-4 h-4" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <Field label="Nombre del proveedor *" value={nombre} onChange={setNombre} placeholder="Ej: Distribuidora Norte" />
          <Field label="Contacto" value={contacto} onChange={setContacto} placeholder="Nombre del contacto" />
          <Field label="Teléfono" value={tel} onChange={setTel} placeholder="+52 55 1234 5678" type="tel" />
          <Field label="Notas" value={notas} onChange={setNotas} placeholder="Observaciones..." />
          {error && <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>}
          <div className="flex gap-2 pt-1">
            <button type="button" onClick={onClose} className="flex-1 h-11 rounded-xl border border-slate-200 text-sm font-medium text-slate-600 hover:bg-slate-50">
              Cancelar
            </button>
            <button type="submit" disabled={loading} className="flex-1 h-11 bg-violet-600 hover:bg-violet-700 disabled:bg-violet-300 text-white text-sm font-semibold rounded-xl flex items-center justify-center gap-2">
              {loading && <Loader2 className="w-4 h-4 animate-spin" />}
              {loading ? 'Guardando...' : 'Guardar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

function Field({ label, value, onChange, placeholder, type = 'text' }: {
  label: string; value: string; onChange: (v: string) => void; placeholder: string; type?: string
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-slate-700 mb-1.5">{label}</label>
      <input type={type} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}
        className="w-full h-11 px-3 rounded-xl border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500" />
    </div>
  )
}
```

**Verificación:**
- [ ] Se puede crear un proveedor con solo el nombre
- [ ] El modal cierra y el listado se refresca

---

## Tarea 6: AdeudoModal

**Objetivo:** Modal para registrar un adeudo para un proveedor (descripción, monto, fecha vencimiento).

**Archivos a crear:**
- `src/app/proveedores/AdeudoModal.tsx`

**Implementación:**
```typescript
'use client'

import { useState } from 'react'
import { X, Loader2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import type { Proveedor, Adeudo } from '@/lib/types'

interface Props {
  proveedor: Proveedor
  adeudo:    Adeudo | null   // null = crear, !null = editar
  onClose:   () => void
  onSuccess: () => void
}

export default function AdeudoModal({ proveedor, adeudo, onClose, onSuccess }: Props) {
  const [descripcion, setDescripcion] = useState(adeudo?.descripcion ?? '')
  const [monto,       setMonto]       = useState(adeudo ? String(adeudo.monto) : '')
  const [fecha,       setFecha]       = useState(adeudo?.fecha_vencimiento ?? '')
  const [notas,       setNotas]       = useState(adeudo?.notas ?? '')
  const [loading,     setLoading]     = useState(false)
  const [error,       setError]       = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const montoNum = parseFloat(monto)
    if (!descripcion.trim())  { setError('La descripción es requerida'); return }
    if (!montoNum || montoNum <= 0) { setError('El monto debe ser mayor a 0'); return }
    if (!fecha)               { setError('La fecha de vencimiento es requerida'); return }

    setLoading(true)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()

    const payload = {
      proveedor_id:      proveedor.id,
      descripcion:       descripcion.trim(),
      monto:             montoNum,
      fecha_vencimiento: fecha,
      notas:             notas.trim() || null,
      created_by:        user?.id ?? null,
    }

    const { error: err } = adeudo
      ? await supabase.from('adeudos').update(payload).eq('id', adeudo.id)
      : await supabase.from('adeudos').insert(payload)

    if (err) { setError('Error al guardar. Intenta de nuevo.'); setLoading(false); return }
    onSuccess()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/40">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-xl">
        <div className="flex items-center justify-between p-5 pb-4 border-b border-slate-100">
          <div>
            <h2 className="text-base font-semibold text-slate-900">{adeudo ? 'Editar adeudo' : 'Nuevo adeudo'}</h2>
            <p className="text-sm text-slate-500 mt-0.5">{proveedor.nombre}</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400">
            <X className="w-4 h-4" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Descripción *</label>
            <input value={descripcion} onChange={e => setDescripcion(e.target.value)}
              placeholder="Ej: Factura #2041 · compra mensual papelería"
              className="w-full h-11 px-3 rounded-xl border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Monto *</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">$</span>
                <input type="number" min="1" step="0.01" value={monto} onChange={e => setMonto(e.target.value)}
                  placeholder="0.00"
                  className="w-full h-11 pl-6 pr-3 rounded-xl border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500" />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Vence *</label>
              <input type="date" value={fecha} onChange={e => setFecha(e.target.value)}
                className="w-full h-11 px-3 rounded-xl border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500" />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Notas <span className="text-slate-400 font-normal">(opcional)</span></label>
            <input value={notas} onChange={e => setNotas(e.target.value)} placeholder="Observaciones..."
              className="w-full h-11 px-3 rounded-xl border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500" />
          </div>
          {error && <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>}
          <div className="flex gap-2 pt-1">
            <button type="button" onClick={onClose} className="flex-1 h-11 rounded-xl border border-slate-200 text-sm font-medium text-slate-600 hover:bg-slate-50">
              Cancelar
            </button>
            <button type="submit" disabled={loading} className="flex-1 h-11 bg-violet-600 hover:bg-violet-700 disabled:bg-violet-300 text-white text-sm font-semibold rounded-xl flex items-center justify-center gap-2">
              {loading && <Loader2 className="w-4 h-4 animate-spin" />}
              {loading ? 'Guardando...' : 'Guardar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
```

**Verificación:**
- [ ] Se puede crear un adeudo con proveedor, monto y fecha
- [ ] El adeudo aparece ordenado por fecha de vencimiento

---

## Tarea 7: Página de Costos — server page

**Objetivo:** Server component que fetch costos_fijos + calcula mercancía de stock_ledger.

**Archivos a crear:**
- `src/app/costos/page.tsx`

**Implementación:**
```typescript
import { createClient } from '@/lib/supabase/server'
import AppShell from '@/components/AppShell'
import CostosClient from './CostosClient'

export const revalidate = 0

export default async function CostosPage() {
  const supabase = await createClient()

  const mesInicio = new Date()
  mesInicio.setDate(1); mesInicio.setHours(0,0,0,0)

  const [{ data: costos }, { data: comprasMes }] = await Promise.all([
    supabase.from('costos_fijos').select('*').eq('activo', true).order('categoria').order('nombre'),
    // Entradas de compra del mes actual para estimar costo de mercancía
    supabase.from('stock_ledger')
      .select('qty_antes, qty_despues, productos(precio_menudeo)')
      .eq('tipo', 'entrada_compra')
      .gte('created_at', mesInicio.toISOString()),
  ])

  // Estima costo de mercancía (precio_menudeo × qty comprada)
  const costoMercancia = (comprasMes ?? []).reduce((s: number, r: any) => {
    const precio = Number(r.productos?.precio_menudeo ?? 0)
    return s + (r.qty_despues - r.qty_antes) * precio
  }, 0)

  return (
    <AppShell>
      <CostosClient costosIniciales={costos ?? []} costoMercanciaEstimado={costoMercancia} />
    </AppShell>
  )
}
```

**Verificación:**
- [ ] La página carga en `/costos`
- [ ] Pasa datos reales al client component

---

## Tarea 8: CostosClient — lista + donut real

**Objetivo:** Client component con lista de costos fijos, donut calculado con datos reales, CRUD.

**Archivos a crear:**
- `src/app/costos/CostosClient.tsx`

**Implementación (estructura):**
```typescript
'use client'

import { useState, useMemo } from 'react'
import { Plus, Pencil, Trash2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import type { CostoFijo, CostoCategoria } from '@/lib/types'
import { costoMensual, CATEGORIA_META } from '@/lib/types'
import CostoModal from './CostoModal'

interface Props { costosIniciales: CostoFijo[]; costoMercanciaEstimado: number }

export default function CostosClient({ costosIniciales, costoMercanciaEstimado }: Props) {
  const [costos,    setCostos]    = useState(costosIniciales)
  const [showModal, setShowModal] = useState(false)
  const [editando,  setEditando]  = useState<CostoFijo | null>(null)

  async function refresh() {
    const { data } = await createClient().from('costos_fijos').select('*').eq('activo', true).order('categoria').order('nombre')
    setCostos(data ?? [])
  }

  async function eliminar(id: string) {
    if (!confirm('¿Eliminar este costo?')) return
    await createClient().from('costos_fijos').delete().eq('id', id)
    await refresh()
  }

  // Totales mensuales por categoría
  const totalPorCat = useMemo(() => {
    const map: Partial<Record<CostoCategoria, number>> = {}
    for (const c of costos) {
      map[c.categoria] = (map[c.categoria] ?? 0) + costoMensual(c)
    }
    return map
  }, [costos])

  const totalFijos  = Object.values(totalPorCat).reduce((s, v) => s + v, 0)
  const totalGeneral = totalFijos + costoMercanciaEstimado

  // Donut segments: mercancía primero, luego costos fijos por categoría
  const segments = useMemo(() => {
    const all = [
      { label: 'Mercancía', value: costoMercanciaEstimado, color: '#7c3aed' },
      ...Object.entries(totalPorCat).map(([cat, val]) => ({
        label: CATEGORIA_META[cat as CostoCategoria].label,
        value: val ?? 0,
        color: CATEGORIA_META[cat as CostoCategoria].color,
      })),
    ].filter(s => s.value > 0)

    // Compute dasharray for each segment
    const circum = 2 * Math.PI * 38  // r=38
    let offset = 0
    return all.map(s => {
      const pct  = totalGeneral > 0 ? s.value / totalGeneral : 0
      const dash = pct * circum
      const seg  = { ...s, pct: Math.round(pct * 100), dash, offset }
      offset += dash
      return seg
    })
  }, [totalPorCat, costoMercanciaEstimado, totalGeneral])

  const formatMXN = (n: number) =>
    new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 0 }).format(n)

  return (
    <div className="px-4 py-5 max-w-4xl mx-auto space-y-5">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Estructura de Costos</h1>
          <p className="text-sm text-slate-500">Costos fijos + mercancía estimada este mes</p>
        </div>
        <button onClick={() => { setEditando(null); setShowModal(true) }}
          className="flex items-center gap-2 h-10 px-4 bg-violet-600 hover:bg-violet-700 text-white text-sm font-semibold rounded-xl">
          <Plus className="w-4 h-4" />Nuevo costo
        </button>
      </div>

      {/* Donut + summary */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6">
        <div className="flex flex-col sm:flex-row items-center gap-8">
          {/* Donut SVG real */}
          <div className="relative shrink-0">
            <svg viewBox="0 0 110 110" width="140" height="140">
              <circle cx="55" cy="55" r="38" fill="none" stroke="#f1f5f9" strokeWidth="18" />
              {segments.map((s, i) => (
                <circle key={i} cx="55" cy="55" r="38" fill="none"
                  stroke={s.color} strokeWidth="18"
                  strokeDasharray={`${s.dash} ${2 * Math.PI * 38 - s.dash}`}
                  strokeDashoffset={-s.offset}
                  strokeLinecap="butt"
                  transform="rotate(-90 55 55)"
                />
              ))}
              <text x="55" y="50" textAnchor="middle" fill="#1e293b" fontSize="11" fontWeight="700">Total</text>
              <text x="55" y="64" textAnchor="middle" fill="#7c3aed" fontSize="9">
                {formatMXN(totalGeneral).replace('MX$','$')}
              </text>
            </svg>
          </div>
          {/* Legend */}
          <div className="flex-1 space-y-2.5">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-3">Distribución mensual</p>
            {segments.map((s, i) => (
              <div key={i} className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <div className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ background: s.color }} />
                  <span className="text-sm text-slate-700">{s.label}</span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-20 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                    <div className="h-full rounded-full" style={{ width: `${s.pct}%`, background: s.color }} />
                  </div>
                  <span className="text-xs font-bold text-slate-600 font-mono w-8 text-right">{s.pct}%</span>
                  <span className="text-xs text-slate-500 font-mono w-20 text-right">{formatMXN(s.value)}</span>
                </div>
              </div>
            ))}
            <div className="pt-2 border-t border-slate-100 flex justify-between text-sm font-bold">
              <span className="text-slate-700">Total costos/mes</span>
              <span className="text-slate-900">{formatMXN(totalGeneral)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Costos list by category */}
      {costos.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 flex flex-col items-center py-16 text-center">
          <p className="text-slate-400 text-sm">Agrega tu primer costo fijo</p>
        </div>
      ) : (
        Object.entries(CATEGORIA_META).map(([cat, meta]) => {
          const catCostos = costos.filter(c => c.categoria === cat)
          if (catCostos.length === 0) return null
          return (
            <div key={cat} className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
              <div className="px-5 py-3 border-b border-slate-100 flex items-center justify-between">
                <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${meta.bg}`}>{meta.label}</span>
                <span className="text-xs font-bold text-slate-600 font-mono">
                  {formatMXN(totalPorCat[cat as CostoCategoria] ?? 0)} / mes
                </span>
              </div>
              <ul className="divide-y divide-slate-50">
                {catCostos.map(c => (
                  <li key={c.id} className="flex items-center gap-4 px-5 py-3 hover:bg-slate-50">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-900">{c.nombre}</p>
                      <p className="text-xs text-slate-400 mt-0.5 capitalize">{c.periodo} · {formatMXN(costoMensual(c))}/mes</p>
                    </div>
                    <p className="text-sm font-bold text-slate-700 font-mono">{formatMXN(Number(c.monto))}</p>
                    <div className="flex items-center gap-1.5">
                      <button onClick={() => { setEditando(c); setShowModal(true) }}
                        className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400">
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button onClick={() => eliminar(c.id)}
                        className="p-1.5 rounded-lg hover:bg-red-50 text-slate-400 hover:text-red-500">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )
        })
      )}

      {showModal && (
        <CostoModal
          costo={editando}
          onClose={() => { setShowModal(false); setEditando(null) }}
          onSuccess={() => { setShowModal(false); setEditando(null); refresh() }}
        />
      )}
    </div>
  )
}
```

**Verificación:**
- [ ] El donut usa datos reales de Supabase
- [ ] Los porcentajes suman 100%
- [ ] Se pueden agregar / editar / eliminar costos

---

## Tarea 9: CostoModal

**Objetivo:** Modal para crear / editar un costo fijo (categoría, nombre, monto, período).

**Archivos a crear:**
- `src/app/costos/CostoModal.tsx`

**Implementación:**
```typescript
'use client'

import { useState } from 'react'
import { X, Loader2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import type { CostoFijo, CostoCategoria, CostoPeriodo } from '@/lib/types'
import { CATEGORIA_META } from '@/lib/types'

const PERIODOS: { id: CostoPeriodo; label: string }[] = [
  { id: 'mensual',   label: 'Mensual'   },
  { id: 'quincenal', label: 'Quincenal' },
  { id: 'semanal',   label: 'Semanal'   },
  { id: 'anual',     label: 'Anual'     },
  { id: 'unico',     label: 'Único'     },
]

interface Props { costo: CostoFijo | null; onClose: () => void; onSuccess: () => void }

export default function CostoModal({ costo, onClose, onSuccess }: Props) {
  const [categoria, setCategoria] = useState<CostoCategoria>(costo?.categoria ?? 'otros')
  const [nombre,    setNombre]    = useState(costo?.nombre ?? '')
  const [monto,     setMonto]     = useState(costo ? String(costo.monto) : '')
  const [periodo,   setPeriodo]   = useState<CostoPeriodo>(costo?.periodo ?? 'mensual')
  const [notas,     setNotas]     = useState(costo?.notas ?? '')
  const [loading,   setLoading]   = useState(false)
  const [error,     setError]     = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const montoNum = parseFloat(monto)
    if (!nombre.trim())         { setError('El nombre es requerido'); return }
    if (!montoNum || montoNum <= 0) { setError('El monto debe ser mayor a 0'); return }

    setLoading(true)
    const payload = { categoria, nombre: nombre.trim(), monto: montoNum, periodo, notas: notas.trim() || null }
    const { error: err } = costo
      ? await createClient().from('costos_fijos').update(payload).eq('id', costo.id)
      : await createClient().from('costos_fijos').insert(payload)

    if (err) { setError('Error al guardar. Intenta de nuevo.'); setLoading(false); return }
    onSuccess()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/40">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-xl">
        <div className="flex items-center justify-between p-5 pb-4 border-b border-slate-100">
          <h2 className="text-base font-semibold text-slate-900">{costo ? 'Editar costo' : 'Nuevo costo fijo'}</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400"><X className="w-4 h-4" /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-5 space-y-4">

          {/* Categoría */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Categoría</label>
            <div className="grid grid-cols-3 gap-2">
              {Object.entries(CATEGORIA_META).map(([cat, meta]) => (
                <button key={cat} type="button" onClick={() => setCategoria(cat as CostoCategoria)}
                  className={`h-9 rounded-xl text-xs font-semibold border transition-colors ${
                    categoria === cat ? 'bg-violet-50 border-violet-300 text-violet-700' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                  }`}
                >{meta.label}</button>
              ))}
            </div>
          </div>

          {/* Nombre */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Nombre *</label>
            <input value={nombre} onChange={e => setNombre(e.target.value)} placeholder="Ej: Sueldo cajera, Renta local..."
              className="w-full h-11 px-3 rounded-xl border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500" />
          </div>

          {/* Monto + Período */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Monto *</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">$</span>
                <input type="number" min="1" step="0.01" value={monto} onChange={e => setMonto(e.target.value)} placeholder="0.00"
                  className="w-full h-11 pl-6 pr-3 rounded-xl border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500" />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Período</label>
              <select value={periodo} onChange={e => setPeriodo(e.target.value as CostoPeriodo)}
                className="w-full h-11 px-3 rounded-xl border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 bg-white">
                {PERIODOS.map(p => <option key={p.id} value={p.id}>{p.label}</option>)}
              </select>
            </div>
          </div>

          {/* Notas */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Notas <span className="text-slate-400 font-normal">(opcional)</span></label>
            <input value={notas} onChange={e => setNotas(e.target.value)} placeholder="Observaciones..."
              className="w-full h-11 px-3 rounded-xl border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500" />
          </div>

          {error && <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>}

          <div className="flex gap-2 pt-1">
            <button type="button" onClick={onClose} className="flex-1 h-11 rounded-xl border border-slate-200 text-sm font-medium text-slate-600 hover:bg-slate-50">Cancelar</button>
            <button type="submit" disabled={loading} className="flex-1 h-11 bg-violet-600 hover:bg-violet-700 disabled:bg-violet-300 text-white text-sm font-semibold rounded-xl flex items-center justify-center gap-2">
              {loading && <Loader2 className="w-4 h-4 animate-spin" />}
              {loading ? 'Guardando...' : 'Guardar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
```

**Verificación:**
- [ ] Selector de categoría funciona visualmente
- [ ] Select de período tiene las 5 opciones
- [ ] Al guardar, el donut se actualiza con los nuevos datos

---

## Tarea 10: Dashboard — datos reales

**Objetivo:** Actualizar `dashboard/page.tsx` para usar datos reales de `adeudos` y `costos_fijos` en el panel de proveedores y el donut.

**Archivos a modificar:**
- `src/app/dashboard/page.tsx`

**Cambios específicos:**

1. Añadir al bloque `Promise.all`:
```typescript
supabase.from('adeudos')
  .select('monto, fecha_vencimiento, estado, proveedores(nombre)')
  .eq('estado', 'pendiente')
  .order('fecha_vencimiento', { ascending: true })
  .limit(3),
supabase.from('costos_fijos').select('*').eq('activo', true),
```

2. En el panel "Adeudos a Proveedores", mostrar la lista real con urgencia y total.

3. En el donut "Estructura de Costos", usar `costoMensual()` de cada registro real.

**Verificación:**
- [ ] El panel de proveedores muestra adeudos reales ordenados por urgencia
- [ ] El donut usa porcentajes calculados de datos reales
- [ ] Las alertas del dashboard incluyen adeudos próximos a vencer

---

## Orden de ejecución

```
SQL en Supabase (usuario)
       ↓
  Tarea 1 (types)
       ↓
  Tarea 2 (sidebar) ← independiente
  Tarea 7 (costos page)
  Tarea 3 (proveedores page)
       ↓
  Tarea 4 (ProveedoresClient)
  Tarea 8 (CostosClient)
       ↓
  Tarea 5 (NuevoProveedorModal)
  Tarea 6 (AdeudoModal)
  Tarea 9 (CostoModal)
       ↓
  Tarea 10 (dashboard datos reales)
       ↓
  Build + deploy
```

---

## Checklist final

- [ ] `next build` sin errores
- [ ] `/proveedores` carga y muestra lista vacía (o con datos)
- [ ] Puedo agregar un proveedor y un adeudo
- [ ] Puedo marcar un adeudo como pagado
- [ ] `/costos` carga y muestra el donut (placeholder si vacío)
- [ ] Puedo agregar un costo fijo con categoría y período
- [ ] Dashboard panel de proveedores muestra datos reales
- [ ] Dashboard donut usa porcentajes reales
- [ ] Sidebar muestra "Proveedores" y "Costos" para admin
