import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import AppShell from '@/components/AppShell'
import ConfiguracionesClient from './ConfiguracionesClient'

export default async function ConfiguracionesPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  // Solo el developer puede acceder — verificación server-side sobre app_metadata
  if (!user || (user.app_metadata as Record<string, string> | null)?.role !== 'developer') {
    redirect('/inventario')
  }

  return (
    <AppShell>
      <ConfiguracionesClient />
    </AppShell>
  )
}
