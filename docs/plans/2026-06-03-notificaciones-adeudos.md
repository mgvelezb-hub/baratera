# Plan: Notificaciones de vencimiento de adeudos

**Fecha:** 2026-06-03  
**Feature:** Cron job diario que envía email (Resend) cuando hay adeudos pendientes vencidos o que vencen en ≤3 días.

## Archivos a crear/modificar

| Archivo | Acción |
|---------|--------|
| `src/lib/supabase/admin.ts` | CREAR — cliente Supabase con service role (sin RLS) |
| `src/app/api/cron/adeudos-alert/route.ts` | CREAR — GET handler del cron |
| `vercel.json` | CREAR — config del cron de Vercel |
| `.env.local` | MODIFICAR — agregar `CRON_SECRET` y `SUPABASE_SERVICE_ROLE_KEY` |

---

## Tarea 1: Cliente Supabase admin (service role)

**Objetivo:** Crear un cliente Supabase que usa la service role key para saltarse RLS — necesario porque el cron no tiene sesión de usuario.

**Archivos a crear:**
- `src/lib/supabase/admin.ts`

**Implementación:**

```typescript
import { createClient } from '@supabase/supabase-js'

export function createAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
}
```

**Verificación:**
- [ ] El archivo compila sin errores (`node node_modules/next/dist/bin/next build`)
- [ ] No expone la service role key al cliente (no usa `NEXT_PUBLIC_`)

---

## Tarea 2: API route del cron

**Objetivo:** Endpoint GET que consulta adeudos pendientes con vencimiento ≤3 días y envía email de alerta via Resend. Solo responde con 200 si la petición lleva el header `Authorization: Bearer <CRON_SECRET>`.

**Archivos a crear:**
- `src/app/api/cron/adeudos-alert/route.ts`

**Implementación:**

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { Resend } from 'resend'
import { createAdminClient } from '@/lib/supabase/admin'

const resend = new Resend(process.env.RESEND_API_KEY)

function formatMXN(n: number) {
  return new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(n)
}

function diasLabel(dias: number): string {
  if (dias < 0) return `Vencido hace ${Math.abs(dias)} día${Math.abs(dias) === 1 ? '' : 's'}`
  if (dias === 0) return 'Vence hoy'
  return `Vence en ${dias} día${dias === 1 ? '' : 's'}`
}

function colorSemaforo(dias: number): string {
  if (dias < 0) return '#dc2626'
  if (dias === 0) return '#ea580c'
  return '#d97706'
}

export async function GET(req: NextRequest) {
  if (req.headers.get('authorization') !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createAdminClient()

  const today = new Date().toISOString().split('T')[0]
  const cutoff = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]

  const { data: adeudos, error } = await supabase
    .from('adeudos')
    .select('*, proveedores(nombre)')
    .eq('estado', 'pendiente')
    .lte('fecha_vencimiento', cutoff)
    .order('fecha_vencimiento')

  if (error) {
    console.error('adeudos-alert: supabase error', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  if (!adeudos || adeudos.length === 0) {
    return NextResponse.json({ ok: true, enviado: false, motivo: 'sin adeudos próximos' })
  }

  const totalMonto = adeudos.reduce((sum, a) => sum + Number(a.monto), 0)

  const rows = adeudos.map(a => {
    const dias = Math.round(
      (new Date(a.fecha_vencimiento).getTime() - new Date(today).getTime()) / 86400000
    )
    const color = colorSemaforo(dias)
    const label = diasLabel(dias)
    return `
      <tr>
        <td style="padding:10px 0;border-bottom:1px solid #f0f0f0;">
          <div style="font-weight:600;color:#1e293b;">${a.proveedores?.nombre ?? '—'}</div>
          <div style="font-size:13px;color:#64748b;">${a.descripcion}</div>
          <div style="margin-top:4px;">
            <span style="background:${color}1a;color:${color};padding:2px 8px;border-radius:999px;font-size:12px;font-weight:600;">${label}</span>
          </div>
        </td>
        <td style="padding:10px 0;border-bottom:1px solid #f0f0f0;text-align:right;font-weight:700;color:#1e293b;white-space:nowrap;">
          ${formatMXN(Number(a.monto))}
        </td>
      </tr>`
  }).join('')

  const html = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>Alerta de adeudos</title></head>
<body style="margin:0;padding:0;background:#f5f5f5;font-family:Arial,sans-serif;">
  <div style="max-width:480px;margin:32px auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08);">

    <div style="background:#7c3aed;padding:24px;text-align:center;">
      <p style="margin:0;color:#ede9fe;font-size:12px;letter-spacing:2px;text-transform:uppercase;">Papelería</p>
      <h1 style="margin:4px 0 0;color:#fff;font-size:22px;">La Más Baratera</h1>
      <p style="margin:6px 0 0;color:#c4b5fd;font-size:13px;">Alerta de adeudos próximos a vencer</p>
    </div>

    <div style="padding:20px 24px 0;">
      <p style="margin:0 0 16px;color:#475569;font-size:14px;">
        Tienes <strong style="color:#7c3aed;">${adeudos.length} adeudo${adeudos.length === 1 ? '' : 's'}</strong>
        vencido${adeudos.length === 1 ? '' : 's'} o que vence${adeudos.length === 1 ? '' : 'n'} en los próximos 3 días:
      </p>
      <table style="width:100%;border-collapse:collapse;">
        ${rows}
      </table>
    </div>

    <div style="padding:16px 24px;background:#faf5ff;margin:16px 24px;border-radius:8px;">
      <div style="display:flex;justify-content:space-between;align-items:center;">
        <span style="color:#6b21a8;font-weight:600;font-size:14px;">Total pendiente</span>
        <span style="font-size:22px;color:#7c3aed;font-weight:700;">${formatMXN(totalMonto)}</span>
      </div>
    </div>

    <div style="padding:0 24px 24px;text-align:center;">
      <a href="https://baratera-os.vercel.app/proveedores"
         style="display:inline-block;background:#7c3aed;color:#fff;padding:12px 28px;border-radius:8px;text-decoration:none;font-weight:600;font-size:14px;">
        Ver en Baratera OS →
      </a>
    </div>

    <div style="padding:16px 24px;background:#f9fafb;text-align:center;border-top:1px solid #f0f0f0;">
      <p style="margin:0;font-size:12px;color:#94a3b8;">Este mensaje se envía automáticamente cada mañana cuando hay adeudos próximos.</p>
    </div>
  </div>
</body>
</html>`

  try {
    const { error: resendError } = await resend.emails.send({
      from: 'Baratera OS <onboarding@resend.dev>',
      to:   'lamasbaratera@gmail.com',
      subject: `⚠️ ${adeudos.length} adeudo${adeudos.length === 1 ? '' : 's'} venciendo — ${formatMXN(totalMonto)}`,
      html,
    })

    if (resendError) {
      console.error('adeudos-alert: resend error', resendError)
      return NextResponse.json({ error: resendError.message }, { status: 500 })
    }

    return NextResponse.json({ ok: true, enviado: true, adeudos: adeudos.length, total: totalMonto })
  } catch (err) {
    console.error('adeudos-alert error:', err)
    return NextResponse.json({ error: 'Error al enviar' }, { status: 500 })
  }
}
```

**Verificación:**
- [ ] `GET /api/cron/adeudos-alert` sin header → responde 401
- [ ] `GET /api/cron/adeudos-alert` con `Authorization: Bearer <CRON_SECRET>` → responde `{ ok: true, enviado: false }` si no hay adeudos próximos
- [ ] Build pasa sin errores de TypeScript

---

## Tarea 3: Configuración — vercel.json y .env.local

**Objetivo:** Registrar el cron en Vercel (dispara a las 14:00 UTC = 8am hora México) y agregar los secrets necesarios.

### 3a. Crear `vercel.json` en la raíz del proyecto

```json
{
  "crons": [
    {
      "path": "/api/cron/adeudos-alert",
      "schedule": "0 14 * * *"
    }
  ]
}
```

> 14:00 UTC = 8:00 AM CST (México invierno) / 9:00 AM CDT (México verano)

### 3b. Agregar a `.env.local`

```
CRON_SECRET=<genera un string aleatorio, ej: openssl rand -hex 32>
SUPABASE_SERVICE_ROLE_KEY=<service role key de Supabase dashboard>
```

**Dónde obtener la service role key:**  
Supabase Dashboard → proyecto `vrbgvkyxqaajsgdmvnfh` → Settings → API → **service_role** (la segunda llave, no la anon)

### 3c. Agregar en Vercel Dashboard

Las mismas dos variables deben agregarse en:  
Vercel → baratera-os → Settings → Environment Variables

**Verificación:**
- [ ] `vercel.json` está en la raíz y el cron aparece en Vercel Dashboard → Settings → Crons después del próximo push
- [ ] `.env.local` tiene ambas variables
- [ ] Build pasa sin errores

---

## Orden de ejecución

1. Tarea 1 (`admin.ts`)
2. Tarea 2 (`route.ts`) — depende del admin client
3. Tarea 3 (`vercel.json` + `.env.local`) — independiente, puede ir en paralelo con 1+2

## Test manual post-deploy

```bash
curl -X GET https://baratera-os.vercel.app/api/cron/adeudos-alert \
  -H "Authorization: Bearer <CRON_SECRET>"
```

Debe responder `{"ok":true,"enviado":true,...}` si hay adeudos, o `{"ok":true,"enviado":false,...}` si no hay.
