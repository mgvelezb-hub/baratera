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

  // Destinatario configurable desde /configuraciones (clave alertas.email)
  let alertEmail = 'lamasbaratera@gmail.com'
  const { data: configRow } = await supabase
    .from('configuracion')
    .select('valor')
    .eq('clave', 'alertas')
    .maybeSingle()
  if (configRow?.valor && typeof configRow.valor === 'object') {
    const email = (configRow.valor as { email?: string }).email
    if (email && email.includes('@')) alertEmail = email
  }

  const today = new Date().toISOString().split('T')[0]
  const cutoff = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]

  const { data: adeudos, error } = await supabase
    .from('adeudos')
    .select('*, proveedores(nombre)')
    .in('estado', ['pendiente', 'parcial'])
    .lte('fecha_vencimiento', cutoff)
    .order('fecha_vencimiento')

  if (error) {
    console.error('adeudos-alert: supabase error', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  if (!adeudos || adeudos.length === 0) {
    return NextResponse.json({ ok: true, enviado: false, motivo: 'sin adeudos próximos' })
  }

  const totalMonto = adeudos.reduce((sum, a) => sum + Number(a.monto) - Number(a.monto_pagado ?? 0), 0)

  const rows = adeudos.map(a => {
    const dias = Math.round(
      (new Date(a.fecha_vencimiento).getTime() - new Date(today).getTime()) / 86400000
    )
    const color    = colorSemaforo(dias)
    const label    = diasLabel(dias)
    const restante = Number(a.monto) - Number(a.monto_pagado ?? 0)
    const parcial  = a.estado === 'parcial'
    return `
      <tr>
        <td style="padding:10px 0;border-bottom:1px solid #f0f0f0;">
          <div style="font-weight:600;color:#1e293b;">${a.proveedores?.nombre ?? '—'}</div>
          <div style="font-size:13px;color:#64748b;">${a.descripcion}</div>
          <div style="margin-top:4px;display:flex;gap:6px;flex-wrap:wrap;">
            <span style="background:${color}1a;color:${color};padding:2px 8px;border-radius:999px;font-size:12px;font-weight:600;">${label}</span>
            ${parcial ? `<span style="background:#fef3c7;color:#d97706;padding:2px 8px;border-radius:999px;font-size:12px;font-weight:600;">Pago parcial</span>` : ''}
          </div>
        </td>
        <td style="padding:10px 0;border-bottom:1px solid #f0f0f0;text-align:right;font-weight:700;color:#1e293b;white-space:nowrap;">
          ${formatMXN(restante)}
          ${parcial ? `<div style="font-size:11px;color:#94a3b8;font-weight:400;">de ${formatMXN(Number(a.monto))}</div>` : ''}
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
      from:    'Baratera OS <sistema@lamasbaratera.com.mx>',
      to:      alertEmail,
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
