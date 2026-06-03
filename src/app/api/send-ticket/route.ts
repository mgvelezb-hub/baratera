import { NextRequest, NextResponse } from 'next/server'
import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY)

interface TicketItem {
  nombre:         string
  cantidadCajas:  number
  cantidadPiezas: number
  unidad:         string
  subtotal:       number
}

interface SendTicketBody {
  email:         string
  items:         TicketItem[]
  total:         number
  hora:          string
  metodo:        string
  montoEfectivo: number
  montoTarjeta:  number
  cambio:        number
}

function formatMXN(n: number) {
  return new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(n)
}

export async function POST(req: NextRequest) {
  const body: SendTicketBody = await req.json()
  const { email, items, total, hora, metodo, montoEfectivo, montoTarjeta, cambio } = body

  if (!email || !items?.length) {
    return NextResponse.json({ error: 'Datos incompletos' }, { status: 400 })
  }

  const metodoLabel = metodo === 'efectivo' ? 'Efectivo'
    : metodo === 'tarjeta' ? 'Tarjeta' : 'Efectivo + Tarjeta'

  const itemsHtml = items.map(item => {
    const parts: string[] = []
    if (item.cantidadCajas  > 0) parts.push(`${item.cantidadCajas} caja`)
    if (item.cantidadPiezas > 0) parts.push(`${item.cantidadPiezas} ${item.unidad}`)
    return `
      <tr>
        <td style="padding:8px 0;border-bottom:1px solid #f0f0f0;">
          <span style="font-weight:600;">${item.nombre}</span><br>
          <span style="font-size:12px;color:#888;">${parts.join(' + ')}</span>
        </td>
        <td style="padding:8px 0;border-bottom:1px solid #f0f0f0;text-align:right;font-weight:600;">
          ${formatMXN(item.subtotal)}
        </td>
      </tr>`
  }).join('')

  const html = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>Ticket</title></head>
<body style="margin:0;padding:0;background:#f5f5f5;font-family:Arial,sans-serif;">
  <div style="max-width:480px;margin:32px auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08);">

    <div style="background:#7c3aed;padding:24px;text-align:center;">
      <p style="margin:0;color:#ede9fe;font-size:12px;letter-spacing:2px;text-transform:uppercase;">Papelería</p>
      <h1 style="margin:4px 0 0;color:#fff;font-size:22px;">La Más Baratera</h1>
      <p style="margin:6px 0 0;color:#c4b5fd;font-size:13px;">${hora}</p>
    </div>

    <div style="padding:24px 24px 0;">
      <table style="width:100%;border-collapse:collapse;">
        ${itemsHtml}
      </table>
    </div>

    <div style="padding:16px 24px;background:#faf5ff;margin:16px 24px;border-radius:8px;">
      <div style="display:flex;justify-content:space-between;align-items:center;">
        <span style="font-size:16px;color:#6b21a8;font-weight:600;">TOTAL</span>
        <span style="font-size:24px;color:#7c3aed;font-weight:700;">${formatMXN(total)}</span>
      </div>
    </div>

    <div style="padding:0 24px 24px;">
      <p style="margin:0 0 8px;font-size:13px;color:#888;">Forma de pago: <strong style="color:#333;">${metodoLabel}</strong></p>
      ${montoEfectivo > 0 ? `<p style="margin:0 0 4px;font-size:13px;color:#888;">Efectivo: <strong style="color:#333;">${formatMXN(montoEfectivo)}</strong></p>` : ''}
      ${montoTarjeta  > 0 ? `<p style="margin:0 0 4px;font-size:13px;color:#888;">Tarjeta: <strong style="color:#333;">${formatMXN(montoTarjeta)}</strong></p>` : ''}
      ${cambio        > 0 ? `<p style="margin:0;font-size:14px;color:#16a34a;font-weight:700;">Cambio: ${formatMXN(cambio)}</p>` : ''}
    </div>

    <div style="padding:16px 24px;background:#f9fafb;text-align:center;border-top:1px solid #f0f0f0;">
      <p style="margin:0;font-size:13px;color:#888;">¡Gracias por su compra! Vuelva pronto</p>
    </div>
  </div>
</body>
</html>`

  try {
    const { error } = await resend.emails.send({
      from:    'Papelería La Más Baratera <tickets@lamasbaratera.com.mx>',
      to:      email,
      subject: `Tu ticket de compra — ${hora}`,
      html,
    })

    if (error) {
      console.error('Resend error:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('send-ticket error:', err)
    return NextResponse.json({ error: 'Error al enviar' }, { status: 500 })
  }
}
