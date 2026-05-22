import AppShell from '@/components/AppShell'
import ProximamenteCard from '@/components/ProximamenteCard'

export default function TiendaPage() {
  return (
    <AppShell>
      <ProximamenteCard
        modulo="Tienda Online"
        emoji="🛍️"
        descripcion="Catálogo público mobile-first con stock en tiempo real, ideal para compartir por WhatsApp y TikTok."
        features={[
          'Catálogo con badge de stock actualizado en tiempo real',
          'Precio mayoreo automático al superar la cantidad mínima',
          'Checkout con confirmación por WhatsApp al cliente',
          'Open Graph para preview al compartir links en redes sociales',
          'Pedido foráneo con estimación de entrega incluida',
        ]}
      />
    </AppShell>
  )
}
