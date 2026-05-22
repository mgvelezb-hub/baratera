import AppShell from '@/components/AppShell'
import ProximamenteCard from '@/components/ProximamenteCard'

export default function DashboardPage() {
  return (
    <AppShell>
      <ProximamenteCard
        modulo="Dashboard — Control Central"
        emoji="📊"
        descripcion="Vista ejecutiva en tiempo real: ventas por canal, alertas accionables, stock crítico y acceso a CCTV del local."
        features={[
          'Ventas del día desglosadas por canal (POS, WhatsApp, tienda) en tiempo real',
          'Alerta de descuento no autorizado en menos de 10 segundos',
          'Cambiar estado de pedidos directamente desde el celular',
          'Notificación push en celular bloqueado para alertas críticas',
          'Tabla de stock ordenada por semáforo con generación de PO en un clic',
          'Panel CCTV integrado — cámaras del local sin salir del dashboard',
        ]}
      />
    </AppShell>
  )
}
