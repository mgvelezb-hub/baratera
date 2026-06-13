import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import AppShell from '@/components/AppShell'
import ConfiguracionesClient from './ConfiguracionesClient'

export default async function ConfiguracionesPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  // developer → acceso total. admin → solo módulo Usuarios (cambiar nombre).
  // Verificación server-side sobre app_metadata.
  const rol = (user?.app_metadata as Record<string, string> | null)?.role ?? null
  if (!user || (rol !== 'developer' && rol !== 'admin')) {
    redirect('/inventario')
  }

  return (
    <AppShell>
      <ConfiguracionesClient isDeveloper={rol === 'developer'} />
    </AppShell>
  )
}
