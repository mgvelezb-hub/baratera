'use client'

import { useRef, useState } from 'react'
import { Printer, Mail, Phone, X } from 'lucide-react'
import { formatMXN } from '@/lib/utils'
import type { PaymentData } from './PaymentModal'

export interface TicketItem {
  nombre:         string
  cantidadCajas:  number
  cantidadPiezas: number
  unidad:         string
  subtotal:       number
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

// ── Print CSS — sin @page para que el driver use su tamaño
// configurado y no haya mismatch ni errores de impresión.
const PRINT_CSS = `
  * { margin: 0; padding: 0; box-sizing: border-box; }
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
  const [tab,      setTab]      = useState<Tab>('imprimir')
  const [email,    setEmail]    = useState('')
  const [telefono, setTelefono] = useState('')

  const metodoLabel = payment.metodo === 'efectivo' ? 'Efectivo'
    : payment.metodo === 'tarjeta' ? 'Tarjeta' : 'Efectivo + Tarjeta'

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

  // ── Email via mailto: ────────────────────────────────────────
  function handleEmail() {
    if (!email.trim()) return
    const lines = [
      'Papelería La Más Baratera',
      `Hora: ${hora}`,
      '─────────────────────────────',
      ...items.map(item => {
        const p: string[] = []
        if (item.cantidadCajas  > 0) p.push(`${item.cantidadCajas} cajas`)
        if (item.cantidadPiezas > 0) p.push(`${item.cantidadPiezas} piezas`)
        return `${item.nombre}  (${p.join(' + ')})  ${formatMXN(item.subtotal)}`
      }),
      '─────────────────────────────',
      `TOTAL: ${formatMXN(total)}`,
      `Forma de pago: ${metodoLabel}`,
      ...(payment.montoEfectivo > 0 ? [`Efectivo: ${formatMXN(payment.montoEfectivo)}`] : []),
      ...(payment.montoTarjeta  > 0 ? [`Tarjeta:  ${formatMXN(payment.montoTarjeta)}`]  : []),
      ...(payment.cambio        > 0 ? [`Cambio:   ${formatMXN(payment.cambio)}`]         : []),
      '',
      '¡Gracias por su compra! Vuelva pronto.',
    ]
    const subj = encodeURIComponent('Ticket de compra — Papelería La Más Baratera')
    const body = encodeURIComponent(lines.join('\n'))
    window.location.href = `mailto:${encodeURIComponent(email)}?subject=${subj}&body=${body}`
  }

  // ── SMS via sms: ─────────────────────────────────────────────
  function handleSMS() {
    if (!telefono.trim()) return
    const lines = [
      'La Más Baratera',
      `Total: ${formatMXN(total)} · ${metodoLabel}`,
      ...(payment.cambio > 0 ? [`Cambio: ${formatMXN(payment.cambio)}`] : []),
      '¡Gracias!',
    ]
    const body = encodeURIComponent(lines.join('\n'))
    window.location.href = `sms:${telefono}?body=${body}`
  }

  const TABS = [
    { id: 'imprimir',  label: 'Imprimir', Icon: Printer },
    { id: 'correo',    label: 'Correo',   Icon: Mail    },
    { id: 'telefono',  label: 'Teléfono', Icon: Phone   },
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
              if (item.cantidadCajas  > 0) parts.push(`${item.cantidadCajas} cajas`)
              if (item.cantidadPiezas > 0) parts.push(`${item.cantidadPiezas} piezas`)
              return (
                <div key={i} style={{ marginBottom: '4px' }}>
                  <p style={{ fontWeight: 'bold' }}>{item.nombre}</p>
                  <Row>
                    <span style={{ fontSize: '13px', color: '#000' }}>{parts.join(' + ')}</span>
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
            <div className="flex gap-2">
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleEmail()}
                placeholder="correo@ejemplo.com"
                className="flex-1 h-11 px-3 rounded-xl border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
              />
              <button
                onClick={handleEmail}
                disabled={!email.trim()}
                className="h-11 px-4 bg-violet-600 hover:bg-violet-700 disabled:bg-slate-200 disabled:text-slate-400 text-white text-sm font-semibold rounded-xl transition-colors"
              >
                Enviar
              </button>
            </div>
          )}

          {/* Teléfono */}
          {tab === 'telefono' && (
            <div className="flex gap-2">
              <input
                type="tel"
                value={telefono}
                onChange={e => setTelefono(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleSMS()}
                placeholder="+52 55 1234 5678"
                className="flex-1 h-11 px-3 rounded-xl border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
              />
              <button
                onClick={handleSMS}
                disabled={!telefono.trim()}
                className="h-11 px-4 bg-violet-600 hover:bg-violet-700 disabled:bg-slate-200 disabled:text-slate-400 text-white text-sm font-semibold rounded-xl transition-colors"
              >
                Enviar
              </button>
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
