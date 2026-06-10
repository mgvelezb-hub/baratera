import { createClient } from '@/lib/supabase/server'
import AppShell from '@/components/AppShell'
import { requirePermiso } from '@/lib/permisos-server'
import ProveedoresClient from './ProveedoresClient'

export const revalidate = 0

export default async function ProveedoresPage() {
  await requirePermiso('proveedores.ver')

  const supabase = await createClient()

  const [{ data: proveedores }, { data: adeudos }] = await Promise.all([
    supabase.from('proveedores').select('*').eq('activo', true).order('nombre'),
    supabase
      .from('adeudos')
      .select('*, proveedores(nombre), pagos_proveedor(*)')
      .order('fecha_vencimiento', { ascending: true }),
  ])

  return (
    <AppShell>
      <ProveedoresClient
        proveedoresIniciales={proveedores ?? []}
        adeudosIniciales={adeudos ?? []}
      />
    </AppShell>
  )
}
