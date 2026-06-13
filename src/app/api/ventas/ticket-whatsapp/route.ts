import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

const GRAPH_URL = 'https://graph.facebook.com/v20.0'

interface WaPayload {
  pdfUrl:        string
  telefono:      string
  clienteNombre?: string | null
}

export async function POST(req: NextRequest) {
  const { pdfUrl, telefono, clienteNombre } = (await req.json()) as WaPayload

  const phoneId = process.env.WHATSAPP_PHONE_NUMBER_ID
  const token   = process.env.WHATSAPP_ACCESS_TOKEN
  const tpl     = process.env.WHATSAPP_TEMPLATE_NAME ?? 'ticket_papeleria'
  const lang    = process.env.WHATSAPP_TEMPLATE_LANG ?? 'es_MX'

  if (!phoneId || !token) {
    return NextResponse.json({ error: 'WhatsApp API no configurada' }, { status: 503 })
  }

  // WhatsApp requires E.164 without '+': 521XXXXXXXXXX for Mexico mobile
  const digits = String(telefono).replace(/\D/g, '')
  const to     = digits.startsWith('52') ? digits : `52${digits}`

  const body = {
    messaging_product: 'whatsapp',
    to,
    type: 'template',
    template: {
      name:     tpl,
      language: { code: lang },
      components: [
        {
          type: 'body',
          parameters: [
            { type: 'text', text: clienteNombre ?? 'cliente' },
            { type: 'text', text: pdfUrl },
          ],
        },
      ],
    },
  }

  const res  = await fetch(`${GRAPH_URL}/${phoneId}/messages`, {
    method:  'POST',
    headers: {
      'Content-Type':  'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  })

  const data = await res.json() as {
    messages?: { id: string }[]
    error?:    { message: string; code?: number }
  }

  if (!res.ok) {
    const msg = data.error?.message ?? 'Error de WhatsApp API'
    return NextResponse.json({ error: msg }, { status: res.status })
  }

  return NextResponse.json({ success: true, messageId: data.messages?.[0]?.id })
}
