'use client'

import { useRef, useState } from 'react'
import { Printer, Mail, MessageCircle, X } from 'lucide-react'
import { formatMXN, pluralUnidad } from '@/lib/utils'
import type { PaymentData } from './PaymentModal'

export interface TicketItem {
  nombre:         string
  cantidadCajas:  number
  cantidadPiezas: number
  unidad:         string
  subtotal:       number
  colorNombre?:   string | null
}

interface Props {
  items:        TicketItem[]
  total:        number
  payment:      PaymentData
  hora:         string
  onClose:      () => void
  onNuevaVenta: () => void
}

type Tab = 'imprimir' | 'correo' | 'telefono'

// ── Print CSS — @page con altura `auto` para que el largo del
// ticket se ajuste al contenido (no a un tamaño fijo del driver).
// El ancho fijo (58mm efectivo) evita mismatch; `auto` en la altura
// hace que el papel se corte justo al final del contenido.
const PRINT_CSS = `
  @page {
    size: 58mm auto;
    margin: 0;
  }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  html, body { height: auto; }
  body {
    font-family: 'Courier New', Courier, monospace;
    font-size: 16px;
    width: 54mm;
    padding: 2mm 2mm 2mm 0mm;  /* sin margen izquierdo */
    color: #000;
  }
  .titulo {
    font-size: 20px;
    font-weight: bold;
    text-align: center;
    margin-bottom: 4px;
  }
`

// ── Ticket rows — inline styles so they render identically
//    in the modal preview AND inside the iframe ────────────────
function Row({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', ...style }}>
      {children}
    </div>
  )
}

function Divider() {
  return (
    <div style={{ borderTop: '1px dashed #555', margin: '5px 0' }} />
  )
}

export default function TicketPrint({ items, total, payment, hora, onClose, onNuevaVenta }: Props) {
  const ticketRef = useRef<HTMLDivElement>(null)
  const [tab,          setTab]          = useState<Tab>('imprimir')
  const [email,        setEmail]        = useState('')
  const [telefono,     setTelefono]     = useState('')
  const [emailSending, setEmailSending] = useState(false)
  const [emailSent,    setEmailSent]    = useState(false)
  const [emailError,   setEmailError]   = useState('')

  const metodoLabel =
    payment.metodo === 'efectivo'      ? 'Efectivo'
    : payment.metodo === 'tarjeta'     ? 'Tarjeta'
    : payment.metodo === 'transferencia' ? 'Transferencia SPEI'
    : 'Efectivo + Tarjeta'

  // ── Print — ventana popup, misma lógica que imprimía completo
  function handlePrint() {
    const content = ticketRef.current?.innerHTML ?? ''
    const win = window.open('', '_blank', 'width=400,height=700')
    if (!win) return
    win.document.write(`<!DOCTYPE html><html><head>
<meta charset="utf-8">
<title>Ticket</title>
<style>${PRINT_CSS}</style>
</head><body>${content}</body></html>`)
    win.document.close()
    win.focus()
    setTimeout(() => {
      win.print()
      win.close()
    }, 500)
  }

  // ── Email via Resend API ─────────────────────────────────────
  async function handleEmail() {
    if (!email.trim() || emailSending) return
    setEmailSending(true)
    setEmailError('')
    try {
      const res = await fetch('/api/send-ticket', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          email,
          items,
          total,
          hora,
          metodo:        payment.metodo,
          montoEfectivo: payment.montoEfectivo,
          montoTarjeta:  payment.montoTarjeta,
          cambio:        payment.cambio,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Error al enviar')
      setEmailSent(true)
      setEmail('')
    } catch (err) {
      setEmailError(err instanceof Error ? err.message : 'Error al enviar')
    } finally {
      setEmailSending(false)
    }
  }

  // ── WhatsApp ──────────────────────────────────────────────────
  function handleWhatsApp() {
    if (!telefono.trim()) return

    const lines: string[] = ['📋 *La Más Baratera*', `🕐 ${hora}`, '']

    items.forEach(item => {
      const parts: string[] = []
      if (item.cantidadCajas  > 0) parts.push(`${item.cantidadCajas} ${pluralUnidad('caja', item.cantidadCajas)}`)
      if (item.cantidadPiezas > 0) parts.push(`${item.cantidadPiezas} ${pluralUnidad(item.unidad, item.cantidadPiezas)}`)
      const qty   = parts.join(' + ')
      const color = item.colorNombre ? ` · ${item.colorNombre}` : ''
      lines.push(`• ${item.nombre} (${qty}${color}) — ${formatMXN(item.subtotal)}`)
    })

    lines.push('', `💰 *TOTAL: ${formatMXN(total)}*`, `Pago: ${metodoLabel}`)
    if (payment.montoEfectivo    > 0) lines.push(`Efectivo: ${formatMXN(payment.montoEfectivo)}`)
    if (payment.montoTarjeta     > 0) lines.push(`Tarjeta: ${formatMXN(payment.montoTarjeta)}`)
    if (payment.cambio           > 0) lines.push(`Cambio: *${formatMXN(payment.cambio)}*`)
    lines.push('', '¡Gracias por su compra! 🙏')

    // Normaliza número mexicano: 10 dígitos → prefija 52
    const digits = telefono.replace(/\D/g, '')
    const phone  = digits.startsWith('52') ? digits : `52${digits}`

    window.open(`https://wa.me/${phone}?text=${encodeURIComponent(lines.join('\n'))}`, '_blank')
  }

  const TABS = [
    { id: 'imprimir',  label: 'Imprimir', Icon: Printer },
    { id: 'correo',    label: 'Correo',   Icon: Mail    },
    { id: 'telefono',  label: 'WhatsApp', Icon: MessageCircle },
  ] as const

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60">
      <div className="w-full max-w-sm bg-white rounded-2xl shadow-xl flex flex-col max-h-[90vh]">

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <h2 className="text-base font-semibold text-slate-900">Ticket de venta</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* ── Ticket preview (innerHTML is captured for print) ── */}
        <div className="flex-1 overflow-y-auto px-5 py-4">
          <div
            ref={ticketRef}
            style={{ fontFamily: "'Courier New', Courier, monospace", fontSize: '13px', lineHeight: '1.5', color: '#000', paddingLeft: '0px', marginLeft: '-8px'  }}
          >
            {/* Store name */}
            <p style={{ textAlign: 'center', fontWeight: 'bold', fontSize: '18px', marginBottom: '2px' }}>
              Papelería La Más Baratera
            </p>
            <p style={{ textAlign: 'center', fontSize: '10px', color: '#000', marginBottom: '4px' }}>
              {hora}
            </p>
            <Divider />

            {/* Items */}
            {items.map((item, i) => {
              const parts: string[] = []
              if (item.cantidadCajas  > 0) parts.push(`${item.cantidadCajas} ${pluralUnidad('caja', item.cantidadCajas)}`)
              if (item.cantidadPiezas > 0) parts.push(`${item.cantidadPiezas} ${pluralUnidad(item.unidad, item.cantidadPiezas)}`)
              const descripcion = [parts.join(' + '), item.colorNombre].filter(Boolean).join(' · ')
              return (
                <div key={i} style={{ marginBottom: '4px' }}>
                  <p style={{ fontWeight: 'bold' }}>{item.nombre}</p>
                  <Row>
                    <span style={{ fontSize: '13px', color: '#000' }}>{descripcion}</span>
                    <span>{formatMXN(item.subtotal)}</span>
                  </Row>
                </div>
              )
            })}

            <Divider />

            {/* Total */}
            <Row style={{ fontSize: '13px', fontWeight: 'bold' }}>
              <span>TOTAL</span>
              <span>{formatMXN(total)}</span>
            </Row>

            <Divider />

            {/* Payment breakdown */}
            <Row style={{ fontSize: '13px', color: '#000' }}>
              <span>Forma de pago</span>
              <span>{metodoLabel}</span>
            </Row>
            {payment.montoEfectivo > 0 && (
              <Row style={{ fontSize: '13px', color: '#000' }}>
                <span>Efectivo</span>
                <span>{formatMXN(payment.montoEfectivo)}</span>
              </Row>
            )}
            {payment.montoTarjeta > 0 && (
              <Row style={{ fontSize: '13px', color: '#000' }}>
                <span>Tarjeta</span>
                <span>{formatMXN(payment.montoTarjeta)}</span>
              </Row>
            )}
            {payment.cambio > 0 && (
              <Row style={{ fontSize: '13px', fontWeight: 'bold' }}>
                <span>Cambio</span>
                <span>{formatMXN(payment.cambio)}</span>
              </Row>
            )}

            <Divider />
            <p style={{ textAlign: 'center', fontSize: '16px', color: '#000' }}>¡Gracias por su compra!</p>
            <p style={{ textAlign: 'center', fontSize: '16px', color: '#000' }}>Vuelva pronto</p>
          </div>
        </div>

        {/* Actions */}
        <div className="border-t border-slate-100 p-4 space-y-3">

          {/* Tab selector */}
          <div className="grid grid-cols-3 gap-1 bg-slate-100 p-1 rounded-xl">
            {TABS.map(({ id, label, Icon }) => (
              <button
                key={id}
                onClick={() => setTab(id as Tab)}
                className={`flex flex-col items-center gap-0.5 py-2 rounded-lg text-xs font-semibold transition-colors ${
                  tab === id
                    ? 'bg-white text-slate-900 shadow-sm'
                    : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                {label}
              </button>
            ))}
          </div>

          {/* Imprimir */}
          {tab === 'imprimir' && (
            <button
              onClick={handlePrint}
              className="w-full h-11 bg-slate-900 hover:bg-slate-800 text-white text-sm font-semibold rounded-xl transition-colors flex items-center justify-center gap-2"
            >
              <Printer className="w-4 h-4" />
              Imprimir ticket
            </button>
          )}

          {/* Correo */}
          {tab === 'correo' && (
            <div className="space-y-2">
              <div className="flex gap-2">
                <input
                  type="email"
                  value={email}
                  onChange={e => { setEmail(e.target.value); setEmailSent(false); setEmailError('') }}
                  onKeyDown={e => e.key === 'Enter' && handleEmail()}
                  placeholder="correo@ejemplo.com"
                  disabled={emailSending}
                  className="flex-1 h-11 px-3 rounded-xl border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 disabled:bg-slate-50"
                />
                <button
                  onClick={handleEmail}
                  disabled={!email.trim() || emailSending}
                  className="h-11 px-4 bg-violet-600 hover:bg-violet-700 disabled:bg-slate-200 disabled:text-slate-400 text-white text-sm font-semibold rounded-xl transition-colors min-w-[80px]"
                >
                  {emailSending ? '...' : 'Enviar'}
                </button>
              </div>
              {emailSent && (
                <p className="text-xs text-green-600 font-medium text-center">
                  ✓ Ticket enviado correctamente
                </p>
              )}
              {emailError && (
                <p className="text-xs text-red-500 text-center">{emailError}</p>
              )}
            </div>
          )}

          {/* WhatsApp */}
          {tab === 'telefono' && (
            <div className="space-y-2">
              <div className="flex gap-2">
                <input
                  type="tel"
                  value={telefono}
                  onChange={e => setTelefono(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleWhatsApp()}
                  placeholder="55 1234 5678"
                  className="flex-1 h-11 px-3 rounded-xl border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
                />
                <button
                  onClick={handleWhatsApp}
                  disabled={!telefono.trim()}
                  className="h-11 px-4 bg-green-600 hover:bg-green-700 disabled:bg-slate-200 disabled:text-slate-400 text-white text-sm font-semibold rounded-xl transition-colors"
                >
                  Enviar
                </button>
              </div>
              <p className="text-xs text-slate-400 text-center">Abre WhatsApp con el ticket listo para enviar</p>
            </div>
          )}

          {/* Bottom row */}
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={onClose}
              className="h-10 rounded-xl border border-slate-200 text-sm text-slate-600 hover:bg-slate-50 transition-colors"
            >
              Cerrar
            </button>
            <button
              onClick={onNuevaVenta}
              className="h-10 rounded-xl bg-violet-600 hover:bg-violet-700 text-white text-sm font-semibold transition-colors"
            >
              Nueva venta
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
