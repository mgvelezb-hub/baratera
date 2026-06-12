import { createAdminClient } from '@/lib/supabase/admin'
import { NextResponse }      from 'next/server'

export async function POST() {
  const admin = createAdminClient()
  const today = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Mexico_City' })

  const { data, error } = await admin.rpc('next_ticket_num', { p_fecha: today })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ numero_ticket: data as string })
}
