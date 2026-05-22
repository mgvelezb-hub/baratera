import AppShell from '@/components/AppShell'
import ProximamenteCard from '@/components/ProximamenteCard'

export default function ClientesPage() {
  return (
    <AppShell>
      <ProximamenteCard
        modulo="Clientes (CRM)"
        emoji="👥"
        descripcion="Perfil unificado de cada cliente por número de teléfono, con historial de compras y promociones automáticas."
        features={[
          'Un solo perfil por cliente sin importar el canal (WA, POS, tienda)',
          'Motor de reglas de promociones configurables desde el dashboard',
          'Chatbot incluye promociones activas en cada cotización',
          'Reactivación automática a clientes inactivos por más de N días',
          'Broadcast segmentado a grupos de clientes por WhatsApp',
        ]}
      />
    </AppShell>
  )
}
