import { createClient } from '@/lib/supabase/server'
import AppShell from '@/components/AppShell'
import { requirePermiso } from '@/lib/permisos-server'
import CorteClient from './CorteClient'
import type { Venta, CorteCaja } from '@/lib/types'

export const revalidate = 0

export default async function CortePage() {
  await requirePermiso('corte.ver')

  const supabase  = await createClient()
  const todayStr  = new Date().toISOString().split('T')[0]
  const todayStart = `${todayStr}T00:00:00`

  // Último corte del día (si existe) para saber desde cuándo corre el turno actual
  const { data: ultimoCorte } = await supabase
    .from('cortes_caja')
    .select('*')
    .gte('created_at', todayStart)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  const turnoInicio = ultimoCorte
    ? ultimoCorte.created_at
    : todayStart

  // Ventas del turno actual
  const { data: ventasTurno } = await supabase
    .from('ventas')
    .select('*')
    .gte('created_at', turnoInicio)
    .order('created_at', { ascending: false })

  // Historial de cortes del día (más reciente primero)
  const { data: cortesHoy } = await supabase
    .from('cortes_caja')
    .select('*')
    .gte('created_at', todayStart)
    .order('created_at', { ascending: false })

  return (
    <AppShell>
      <CorteClient
        ventasTurno={(ventasTurno ?? []) as Venta[]}
        cortesHoy={(cortesHoy ?? []) as CorteCaja[]}
        turnoInicio={turnoInicio}
      />
    </AppShell>
  )
}
