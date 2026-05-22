import AppShell from '@/components/AppShell'
import ProximamenteCard from '@/components/ProximamenteCard'

export default function ChatbotPage() {
  return (
    <AppShell>
      <ProximamenteCard
        modulo="Chatbot WhatsApp + TikTok"
        emoji="💬"
        descripcion="Atención automática 24/7 por WhatsApp y TikTok que captura pedidos y consulta stock sin intervención manual."
        features={[
          'Captura nombre, producto, cantidad y dirección en una conversación',
          'Verifica disponibilidad antes de confirmar el pedido',
          'Responde en comentarios de TikTok con link de WhatsApp',
          'Escala a atención manual si no entiende al cliente (2 intentos)',
          'Respuesta al webhook de Meta en menos de 5 segundos',
        ]}
      />
    </AppShell>
  )
}
