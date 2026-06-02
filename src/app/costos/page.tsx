import { createClient } from '@/lib/supabase/server'
import AppShell from '@/components/AppShell'
import CostosClient from './CostosClient'

export const revalidate = 0

export default async function CostosPage() {
  const supabase = await createClient()

  const mesInicio = new Date()
  mesInicio.setDate(1)
  mesInicio.setHours(0, 0, 0, 0)

  const [{ data: costos }, { data: comprasMes }] = await Promise.all([
    supabase
      .from('costos_fijos')
      .select('*')
      .eq('activo', true)
      .order('categoria')
      .order('nombre'),
    supabase
      .from('stock_ledger')
      .select('qty_antes, qty_despues, productos(precio_menudeo)')
      .eq('tipo', 'entrada_compra')
      .gte('created_at', mesInicio.toISOString()),
  ])

  // Estima costo de mercancía: precio_menudeo × unidades ingresadas este mes
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const costoMercancia = (comprasMes ?? []).reduce((s: number, r: any) => {
    const precio = Number(r.productos?.precio_menudeo ?? 0)
    const qty    = Math.max(0, r.qty_despues - r.qty_antes)
    return s + qty * precio
  }, 0)

  return (
    <AppShell>
      <CostosClient
        costosIniciales={costos ?? []}
        costoMercanciaEstimado={costoMercancia}
      />
    </AppShell>
  )
}
