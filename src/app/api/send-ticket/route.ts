import { NextRequest, NextResponse } from 'next/server'
import { Resend } from 'resend'
import { montoALetras } from '@/lib/utils'

const resend = new Resend(process.env.RESEND_API_KEY)

interface TicketItem {
  nombre:          string
  cantidadCajas:   number
  cantidadPiezas:  number
  unidad:          string
  subtotal:        number
  colorNombre?:    string | null
  sku?:            string | null
  cantidad?:       number
  precioUnitario?: number
}

interface SendTicketBody {
  email:              string
  items:              TicketItem[]
  total:              number
  hora:               string
  fecha?:             string | null
  cajero?:            string | null
  numeroTicket?:      string | null
  clienteNombre?:     string | null
  clienteNumero?:     string | null
  metodo:             string
  montoEfectivo:      number
  montoTarjeta:       number
  montoTransferencia: number
  cambio:             number
  cuponPct?:          number | null
  descuento?:         number | null
  negocio?: {
    direccion1?: string
    direccion2?: string
    web?:        string
    telefono?:   string
    footer1?:    string
    footer3?:    string
  }
}

function formatMXN(n: number) {
  return new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(n)
}
function formatNum(n: number) {
  return new Intl.NumberFormat('es-MX').format(n)
}
function pluralUnidad(u: string, n: number): string {
  if (n === 1) return u
  const map: Record<string, string> = { caja: 'cajas', pza: 'pzas', paquete: 'paquetes', rollo: 'rollos', par: 'pares', juego: 'juegos' }
  return map[u] ?? u
}

export async function POST(req: NextRequest) {
  const body: SendTicketBody = await req.json()
  const {
    email, items, total, hora, fecha, cajero, numeroTicket,
    clienteNombre, clienteNumero, metodo,
    montoEfectivo, montoTarjeta, montoTransferencia, cambio, cuponPct, descuento, negocio,
  } = body

  const direccion1 = negocio?.direccion1 ?? 'Calle Mesones 123, Col. Centro, CDMX'
  const direccion2 = negocio?.direccion2 ?? ''
  const web        = negocio?.web        ?? 'lamasbaratera.com.mx'
  const telefono   = negocio?.telefono   ?? ''
  const gracias    = negocio?.footer1    ?? '¡Gracias por su compra!'
  const disclaimer = negocio?.footer3    ?? 'Estimado cliente, por favor revise su mercancía antes de salir; una vez fuera de la tienda NO HAY CAMBIOS NI DEVOLUCIONES de ningún producto.'

  if (!email || !items?.length) {
    return NextResponse.json({ error: 'Datos incompletos' }, { status: 400 })
  }

  const logoUrl = `${req.nextUrl.origin}/logo-baratera.png`

  const metodoLabel =
    metodo === 'efectivo'        ? 'Efectivo'
    : metodo === 'tarjeta'       ? 'Tarjeta'
    : metodo === 'transferencia' ? 'Transferencia SPEI'
    : 'Efectivo + Tarjeta'

  const itemsHtml = items.map(item => {
    const cantidad = item.cantidad ?? item.cantidadPiezas
    const uPieza   = item.unidad === 'caja' ? 'pza' : item.unidad
    const precioU  = item.precioUnitario ?? (cantidad > 0 ? item.subtotal / cantidad : item.subtotal)
    const nombre   = [item.nombre, item.colorNombre].filter(Boolean).join(' / ')
    return `
      <tr>
        <td style="padding:8px 0;border-bottom:1px solid #f0f0f0;vertical-align:top;">
          ${item.sku ? `<span style="font-size:11px;color:#aaa;font-family:monospace;">[${item.sku}]</span> ` : ''}<span style="font-weight:600;">${nombre}</span><br>
          <span style="font-size:12px;color:#888;">${formatNum(cantidad)} ${pluralUnidad(uPieza, cantidad)} × ${formatMXN(precioU)}</span>
        </td>
        <td style="padding:8px 0;border-bottom:1px solid #f0f0f0;text-align:right;font-weight:600;white-space:nowrap;vertical-align:top;">
          ${formatMXN(item.subtotal)}
        </td>
      </tr>`
  }).join('')

  const metaRow = (label: string, value: string) => `
    <tr>
      <td style="padding:2px 0;font-size:13px;color:#888;">${label}</td>
      <td style="padding:2px 0;font-size:13px;color:#333;text-align:right;font-weight:600;">${value}</td>
    </tr>`

  const html = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>Nota de venta</title></head>
<body style="margin:0;padding:0;background:#f5f5f5;font-family:Arial,sans-serif;">
  <div style="max-width:480px;margin:32px auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08);">

    <div style="background:#7c3aed;padding:20px;text-align:center;">
      <img src="${logoUrl}" alt="La Más Baratera" width="150" style="display:block;margin:0 auto;border-radius:8px;max-width:150px;height:auto;" />
    </div>

    <div style="padding:16px 24px 0;text-align:center;color:#888;font-size:12px;line-height:1.5;">
      ${escapeHtml(direccion1)}${direccion2 ? `<br>${escapeHtml(direccion2)}` : ''}<br>
      ${escapeHtml(web)}${telefono ? ` · CEL. +52 ${escapeHtml(telefono)}` : ''}
    </div>

    <div style="padding:16px 24px 0;">
      <p style="margin:0 0 12px;text-align:center;font-size:16px;font-weight:700;letter-spacing:1px;color:#333;">NOTA DE VENTA</p>
      <table style="width:100%;border-collapse:collapse;">
        ${numeroTicket ? metaRow('Nota no.:', numeroTicket) : ''}
        ${metaRow('Fecha:', fecha ?? hora)}
        ${clienteNombre ? metaRow(`Cliente ${clienteNumero ?? ''}`, clienteNombre.toUpperCase()) : ''}
        ${cajero ? metaRow('Atendido por:', cajero) : ''}
      </table>
    </div>

    <div style="padding:8px 24px 0;">
      <table style="width:100%;border-collapse:collapse;border-top:1px dashed #ccc;">
        ${itemsHtml}
      </table>
    </div>

    ${cuponPct && descuento ? `
    <div style="padding:8px 24px 0;display:flex;justify-content:space-between;font-size:13px;color:#16a34a;">
      <span>Descuento ${cuponPct}% Off</span><span>−${formatMXN(descuento)}</span>
    </div>` : ''}

    <div style="padding:12px 24px;">
      <div style="background:#faf5ff;border-radius:8px;padding:14px 16px;display:flex;justify-content:space-between;align-items:center;">
        <span style="font-size:16px;color:#6b21a8;font-weight:600;">TOTAL</span>
        <span style="font-size:24px;color:#7c3aed;font-weight:700;">${formatMXN(total)}</span>
      </div>
      <p style="margin:8px 0 0;text-align:center;font-size:12px;color:#888;text-transform:uppercase;">${montoALetras(total)}</p>
    </div>

    <div style="padding:0 24px 16px;">
      <p style="margin:0 0 4px;font-size:13px;color:#888;">Forma de pago: <strong style="color:#333;">${metodoLabel}</strong></p>
      ${montoEfectivo      > 0 ? `<p style="margin:0 0 4px;font-size:13px;color:#888;">Efectivo: <strong style="color:#333;">${formatMXN(montoEfectivo)}</strong></p>` : ''}
      ${montoTarjeta       > 0 ? `<p style="margin:0 0 4px;font-size:13px;color:#888;">Tarjeta: <strong style="color:#333;">${formatMXN(montoTarjeta)}</strong></p>` : ''}
      ${montoTransferencia > 0 ? `<p style="margin:0 0 4px;font-size:13px;color:#888;">Transferencia: <strong style="color:#333;">${formatMXN(montoTransferencia)}</strong></p>` : ''}
      ${cambio             > 0 ? `<p style="margin:0;font-size:14px;color:#16a34a;font-weight:700;">Cambio: ${formatMXN(cambio)}</p>` : ''}
    </div>

    <div style="padding:16px 24px;background:#f9fafb;text-align:center;border-top:1px solid #f0f0f0;">
      <p style="margin:0 0 6px;font-size:14px;color:#333;font-weight:700;">${escapeHtml(gracias)}</p>
      <p style="margin:0;font-size:11px;color:#aaa;line-height:1.5;">
        ${escapeHtml(disclaimer)}
      </p>
    </div>
  </div>
</body>
</html>`

  try {
    const { error } = await resend.emails.send({
      from:    'Papelería La Más Baratera <tickets@lamasbaratera.com.mx>',
      to:      email,
      subject: `Tu nota de venta${numeroTicket ? ` ${numeroTicket}` : ''} — La Más Baratera`,
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

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}
