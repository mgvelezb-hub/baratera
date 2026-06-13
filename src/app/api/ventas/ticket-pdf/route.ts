import { NextRequest, NextResponse } from 'next/server'
import { renderToBuffer, type DocumentProps } from '@react-pdf/renderer'
import React from 'react'
import { createAdminClient } from '@/lib/supabase/admin'
import TicketPDF, { type TicketPDFInput } from '@/components/TicketPDF'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  const body = (await req.json()) as TicketPDFInput

  let buffer: Buffer
  try {
    buffer = await renderToBuffer(
      React.createElement(TicketPDF, body) as React.ReactElement<DocumentProps>
    )
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Error al renderizar PDF'
    return NextResponse.json({ error: msg }, { status: 500 })
  }

  const admin  = createAdminClient()
  const bucket = 'tickets'

  // Create bucket if it doesn't exist (no-op on subsequent calls)
  await admin.storage.createBucket(bucket, {
    public:        true,
    fileSizeLimit: 5 * 1024 * 1024,
  }).catch(() => {})

  const filename = `${body.numeroTicket ?? `ticket-${Date.now()}`}.pdf`

  const { error: uploadError } = await admin.storage
    .from(bucket)
    .upload(filename, buffer, { contentType: 'application/pdf', upsert: true })

  if (uploadError) {
    return NextResponse.json({ error: uploadError.message }, { status: 500 })
  }

  const { data: { publicUrl } } = admin.storage.from(bucket).getPublicUrl(filename)

  return NextResponse.json({ url: publicUrl })
}
