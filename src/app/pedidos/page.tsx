import AppShell from '@/components/AppShell'
import ProximamenteCard from '@/components/ProximamenteCard'

export default function PedidosPage() {
  return (
    <AppShell>
      <ProximamenteCard
        modulo="Pedidos (OMS)"
        emoji="📋"
        descripcion="Gestión completa del ciclo de vida de pedidos, desde la recepción hasta la entrega."
        features={[
          'Reserva atómica de stock — sin sobreventa posible',
          'Precios mayoreo/menudeo automáticos por cantidad',
          'Pedidos locales (CDMX) vs foráneo con estimación de entrega',
          'Cancelación automática si no hay pago en 24 horas',
          'Notificaciones WhatsApp en cada cambio de estado',
        ]}
      />
    </AppShell>
  )
}
