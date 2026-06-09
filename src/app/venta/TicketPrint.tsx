'use client'

import { useRef, useState } from 'react'
import { Printer, Mail, X } from 'lucide-react'
import { formatMXN, pluralUnidad } from '@/lib/utils'
import type { PaymentData } from './PaymentModal'

export interface TicketItem {
  nombre:          string
  cantidadCajas:   number
  cantidadPiezas:  number
  unidad:          string
  subtotal:        number
  colorNombre?:    string | null
  ahorro?:         number
  ahorroCaja?:     number
  ahorroMayoreo?:  number
}

interface Props {
  items:        TicketItem[]
  total:        number
  payment:      PaymentData
  hora:         string
  onClose:      () => void
  onNuevaVenta: () => void
}

type Tab = 'imprimir' | 'correo'

// @page se inyecta dinámicamente en openPrint con el alto exacto del contenido.
const PRINT_CSS = `
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    font-family: 'Courier New', Courier, monospace;
    font-size: 11px;
    line-height: 1.35;
    padding: 0 2mm;
    color: #000;
  }
`

function Row({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', ...style }}>
      {children}
    </div>
  )
}

function Divider() {
  return <div style={{ borderTop: '1px dashed #000000', margin: '5px 0' }} />
}

// ── Shared print helper ──────────────────────────────────────────
// @page height se calcula dinámicamente DENTRO del popup para que
// siempre quepa en una sola página sin importar el tamaño del pedido.
// Popup a 400px de ancho; el print usa 50mm ≈ 189px → el contenido
// es más alto en print. Factor ×2 + 40mm de buffer cubre la diferencia.
function openPrint(bodyHtml: string, css = PRINT_CSS): void {
  const win = window.open('', '_blank', 'width=400,height=3000')
  if (!win) return
  win.document.write(
    '<!DOCTYPE html><html><head>' +
    '<meta charset="utf-8"><title>Ticket</title>' +
    '<style>' + css + '</style>' +
    '</head><body>' + bodyHtml + '</body></html>'
  )
  win.document.close()
  win.onafterprint = () => setTimeout(() => win.close(), 1500)
  const go = () => {
    // Medir a 204px (= 54mm a 96dpi) — el ancho real del area imprimible en print.
    // Así el wrapping de texto refleja cómo se verá en papel y el alto es preciso.
    win.document.body.style.cssText = 'width:204px!important;overflow:hidden'
    const h = win.document.body.scrollHeight
    win.document.body.style.cssText = ''
    const heightMm = Math.ceil(h * 0.265) + 25
    const pageStyle = win.document.createElement('style')
    pageStyle.textContent = `@page { size: 58mm ${heightMm}mm; margin: 2mm; }`
    win.document.head.appendChild(pageStyle)
    win.focus()
    win.print()
  }
  if (win.document.readyState === 'complete') {
    setTimeout(go, 80)
  } else {
    win.addEventListener('load', () => setTimeout(go, 80), { once: true })
  }
}

export default function TicketPrint({ items, total, payment, hora, onClose, onNuevaVenta }: Props) {
  const ticketRef = useRef<HTMLDivElement>(null)
  const [tab,          setTab]          = useState<Tab>('imprimir')
  const [email,        setEmail]        = useState('')
  const [emailSending, setEmailSending] = useState(false)
  const [emailSent,    setEmailSent]    = useState(false)
  const [emailError,   setEmailError]   = useState('')

  const metodoLabel =
    payment.metodo === 'efectivo'        ? 'Efectivo'
    : payment.metodo === 'tarjeta'       ? 'Tarjeta'
    : payment.metodo === 'transferencia' ? 'Transferencia SPEI'
    : 'Efectivo + Tarjeta'

  function handlePrint(): void {
    const node = ticketRef.current
    if (!node) return
    openPrint(node.innerHTML)
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

  const TABS = [
    { id: 'imprimir', label: 'Imprimir', Icon: Printer },
    { id: 'correo',   label: 'Correo',   Icon: Mail    },
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

        {/* ── Ticket preview (innerHTML captured for print) ── */}
        <div className="flex-1 overflow-y-auto px-5 py-4">
          <div
            ref={ticketRef}
            style={{ fontFamily: "'Courier New', Courier, monospace", fontSize: '15px', lineHeight: 1.4, color: '#000', width: '100%' }}
          >
            {/* Logo tipográfico */}
            <div style={{ marginBottom: '5px' }}>
              <div style={{ background: '#000', height: '2px' }} />
              <div style={{ textAlign: 'center', padding: '5px 0' }}>
                <p style={{ fontSize: '11px', fontWeight: 'bold', letterSpacing: '4px', margin: 0 }}>PAPELERÍA</p>
                <p style={{ fontSize: '15px', fontWeight: 'bold', letterSpacing: '1px', lineHeight: 1.05, margin: 0 }}>LA MÁS</p>
                <p style={{ fontSize: '15px', fontWeight: 'bold', letterSpacing: '1px', lineHeight: 1.05, margin: 0 }}>BARATERA</p>
              </div>
              <div style={{ background: '#000', height: '2px' }} />
            </div>
            <p style={{ textAlign: 'center', fontSize: '11px', lineHeight: 1.3, marginBottom: '2px' }}>
              Calle Mesones 123, 2º piso (mano izquierda)<br />
              Col. Centro, Cuauhtémoc, 06000, CDMX
            </p>
            <p style={{ textAlign: 'center', fontSize: '11px', marginBottom: '2px' }}>lamasbaratera.com.mx</p>
            <p style={{ textAlign: 'center', fontSize: '11px', marginBottom: '2px' }}>5619952549</p>
            <p style={{ textAlign: 'center', fontSize: '12px', marginBottom: '4px' }}>{hora}</p>

            <Divider />

            {/* Items */}
            {items.map((item, i) => {
              const parts: string[] = []
              if (item.cantidadCajas  > 0) parts.push(`${item.cantidadCajas} ${pluralUnidad('caja', item.cantidadCajas)}`)
              if (item.cantidadPiezas > 0) {
                const uPzas = (item.cantidadCajas > 0 || item.unidad === 'caja') ? 'pza' : item.unidad
                parts.push(`${item.cantidadPiezas} ${pluralUnidad(uPzas, item.cantidadPiezas)}`)
              }
              const descripcion = [parts.join(' + '), item.colorNombre].filter(Boolean).join(' / ')
              return (
                <div key={i} style={{ marginBottom: '5px' }}>
                  <p style={{ fontWeight: 'bold' }}>{item.nombre}</p>
                  <Row>
                    <span>{descripcion}</span>
                    <span style={{ whiteSpace: 'nowrap' }}>{formatMXN(item.subtotal)}</span>
                  </Row>
                </div>
              )
            })}

            <Divider />

            {/* Total */}
            <Row style={{ fontSize: '16px', fontWeight: 'bold' }}>
              <span>TOTAL</span>
              <span style={{ whiteSpace: 'nowrap' }}>{formatMXN(total)}</span>
            </Row>

            <Divider />

            {/* Desglose de pago */}
            <Row>
              <span>Pago</span>
              <span style={{ whiteSpace: 'nowrap' }}>{metodoLabel}</span>
            </Row>
            {payment.montoEfectivo > 0 && (
              <Row>
                <span>Efectivo</span>
                <span style={{ whiteSpace: 'nowrap' }}>{formatMXN(payment.montoEfectivo)}</span>
              </Row>
            )}
            {payment.montoTarjeta > 0 && (
              <Row>
                <span>Tarjeta</span>
                <span style={{ whiteSpace: 'nowrap' }}>{formatMXN(payment.montoTarjeta)}</span>
              </Row>
            )}
            {payment.montoTransferencia > 0 && (
              <Row>
                <span>Transferencia</span>
                <span style={{ whiteSpace: 'nowrap' }}>{formatMXN(payment.montoTransferencia)}</span>
              </Row>
            )}
            {payment.cambio > 0 && (
              <Row style={{ fontWeight: 'bold' }}>
                <span>Cambio</span>
                <span style={{ whiteSpace: 'nowrap' }}>{formatMXN(payment.cambio)}</span>
              </Row>
            )}

            <Divider />
            
            <p style={{ textAlign: 'center', fontSize: '11px', fontWeight: 'bold' }}>Gracias por su compra</p>
            <p style={{ textAlign: 'center', fontSize: '11px' }}>Vuelva pronto</p>
            <p style={{ textAlign: 'center', fontSize: '10px' }}>!Bendiciones! Ez 34:26</p>
          </div>
        </div>

        {/* Actions */}
        <div className="border-t border-slate-100 p-4 space-y-3">

          {/* Tab selector */}
          <div className="grid grid-cols-2 gap-1 bg-slate-100 p-1 rounded-xl">
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
