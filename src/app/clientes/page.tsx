import { createAdminClient } from '@/lib/supabase/admin'
import { requirePermiso }    from '@/lib/permisos-server'
import AppShell              from '@/components/AppShell'
import ClientesClient        from './ClientesClient'
import type { Cliente }      from '@/lib/types'

export const dynamic = 'force-dynamic'

export default async function ClientesPage() {
  await requirePermiso('clientes.ver')
  const admin = createAdminClient()
  const { data } = await admin
    .from('clientes')
    .select('*')
    .order('nombre')

  return (
    <AppShell>
      <ClientesClient clientes={(data ?? []) as Cliente[]} />
    </AppShell>
  )
}
