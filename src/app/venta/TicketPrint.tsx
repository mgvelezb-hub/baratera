'use client'

import { useRef, useState, useEffect } from 'react'
import { Printer, Mail, X, Share2, Download, Loader2, Copy } from 'lucide-react'
import { formatMXN, pluralUnidad } from '@/lib/utils'
import type { PaymentData } from './PaymentModal'
import { useConfig } from '@/lib/hooks/useConfig'

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
  items:             TicketItem[]
  total:             number
  payment:           PaymentData
  hora:              string
  onClose:           () => void
  onNuevaVenta:      () => void
  numeroTicket?:     string | null
  clienteNombre?:    string | null
  clienteNumero?:    string | null
  clienteTelefono?:  string | null
}

type Tab = 'imprimir' | 'correo' | 'compartir'

// ════════════════════════════════════════════════════════════════
// CONFIGURACIÓN DE IMPRESIÓN — todo lo ajustable vive aquí.
//
// PAPER_MM   → ancho del rollo. Si cambias a impresora de 80mm,
//              solo cambia este número.
// MARGIN_MM  → margen lateral del texto. Las térmicas de 58mm
//              suelen imprimir solo ~48mm centrados; 4mm por lado
//              deja el texto dentro del área imprimible (50mm).
//              Si ves texto cortado a la derecha, sube a 5.
// BUFFER_MM  → colchón vertical extra al final del ticket. Si el
//              ticket sale cortado abajo, sube este número. Si la
//              impresora alimenta demasiado papel en blanco, bájalo.
// MM_PER_PX  → constante física del navegador: CSS define que
//              1 pulgada = 96px = 25.4mm. NO la cambies.
// ════════════════════════════════════════════════════════════════
const PAPER_MM  = 58
const MARGIN_MM = 4
const BUFFER_MM = 8
const MM_PER_PX = 25.4 / 96               // ≈ 0.2646 mm por píxel
const PAPER_PX  = Math.round(PAPER_MM / MM_PER_PX) // ≈ 219 px

// El @page (tamaño de hoja) se inyecta dinámicamente en openPrint
// con el alto exacto del contenido ya medido.
const PRINT_CSS = `
  * { margin: 0; padding: 0; box-sizing: border-box; }
  html, body { width: ${PAPER_MM}mm; }
  body {
    font-family: 'Courier New', Courier, monospace;
    font-size: 11px;
    line-height: 1.45;
    padding: 0 ${MARGIN_MM}mm;
    color: #000;
    /* Fuerza a Chrome a imprimir fondos negros (las barras del logo) */
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
  /* Evita que un texto largo SIN espacios (URLs, códigos) se salga
     del papel y rompa el layout: lo parte donde sea necesario. */
  p, div, span { overflow-wrap: anywhere; }
`

function Row({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', ...style }}>
      {children}
    </div>
  )
}

function Divider() {
  return <div style={{ borderTop: '1px dashed #000000', margin: '7px 0' }} />
}

// ════════════════════════════════════════════════════════════════
// openPrint — imprime el HTML del ticket en papel térmico.
//
// CÓMO FUNCIONA (paso a paso):
//
// 1. Crea un <iframe> INVISIBLE dentro de la misma página (antes
//    era un popup con window.open — los popups los bloquea el
//    navegador y window.print() en popups tiene timing frágil).
//    El iframe se crea con ancho EXACTO de 219px = 58mm, así el
//    navegador acomoda el texto (los saltos de línea) igualito a
//    como se verá en el papel. WYSIWYG real.
//
// 2. Espera a que las fuentes terminen de cargar (doc.fonts.ready).
//    Este era uno de los bugs: si mides la altura ANTES de que la
//    fuente cargue, el texto se mide con otra fuente, la altura
//    sale mal, y el ticket se corta.
//
// 3. Mide la altura real del contenido (scrollHeight, en px) y la
//    convierte a milímetros: px × 0.2646 = mm. Le suma BUFFER_MM
//    de colchón.
//
// 4. Inyecta la regla @page con ese alto exacto:
//       @page { size: 58mm 142mm; margin: 0 }
//    Esto le dice a Chrome "la hoja mide esto" → TODO cabe en UNA
//    sola página, no hay paginación, no hay cortes. Y como el
//    margen va en el CSS (padding del body) y no en la impresora,
//    Chrome pre-llena papel y márgenes en el diálogo: ya no hay
//    que acomodarlos a mano.
//
// 5. Llama print() y al terminar elimina el iframe.
// ════════════════════════════════════════════════════════════════
function openPrint(bodyHtml: string, css = PRINT_CSS): void {
  const iframe = document.createElement('iframe')
  iframe.setAttribute('aria-hidden', 'true')
  iframe.style.cssText =
    'position:fixed;right:0;bottom:0;border:0;visibility:hidden;' +
    `width:${PAPER_PX}px;height:0;`
  document.body.appendChild(iframe)

  const doc = iframe.contentDocument
  const win = iframe.contentWindow
  if (!doc || !win) { iframe.remove(); return }

  doc.open()
  doc.write(
    '<!DOCTYPE html><html><head>' +
    '<meta charset="utf-8"><title>Ticket</title>' +
    '<style>' + css + '</style>' +
    '</head><body>' + bodyHtml + '</body></html>'
  )
  doc.close()

  // Limpieza: quita el iframe al cerrar el diálogo de impresión.
  // El timer de 60s es un respaldo por si onafterprint no dispara.
  let cleaned = false
  const cleanup = () => {
    if (cleaned) return
    cleaned = true
    iframe.remove()
  }
  win.onafterprint = () => setTimeout(cleanup, 500)
  setTimeout(cleanup, 60_000)

  const go = async () => {
    // Paso 2: esperar fuentes. Si falla (fuente de sistema), seguimos.
    try { await doc.fonts.ready } catch { /* ok */ }

    // Paso 3: medir. El body ya mide 58mm de ancho por el CSS,
    // así que scrollHeight es la altura REAL que tendrá en papel.
    const contentPx = doc.body.scrollHeight
    const heightMm  = Math.ceil(contentPx * MM_PER_PX) + BUFFER_MM

    // Paso 4: definir la "hoja" del tamaño exacto del ticket.
    const pageStyle = doc.createElement('style')
    pageStyle.textContent = `@page { size: ${PAPER_MM}mm ${heightMm}mm; margin: 0; }`
    doc.head.appendChild(pageStyle)

    // Paso 5: imprimir.
    win.focus()
    win.print()
  }

  if (doc.readyState === 'complete') {
    void go()
  } else {
    win.addEventListener('load', () => void go(), { once: true })
  }
}

export default function TicketPrint({ items, total, payment, hora, onClose, onNuevaVenta, numeroTicket, clienteNombre, clienteNumero, clienteTelefono }: Props) {
  const ticketRef = useRef<HTMLDivElement>(null)
  const [tab,          setTab]          = useState<Tab>(clienteTelefono ? 'compartir' : 'imprimir')
  const [email,        setEmail]        = useState('')
  const [emailSending, setEmailSending] = useState(false)
  const [emailSent,    setEmailSent]    = useState(false)
  const [emailError,   setEmailError]   = useState('')
  const [pdfUrl,       setPdfUrl]       = useState<string | null>(null)
  const [pdfLoading,   setPdfLoading]   = useState(false)
  const [pdfError,     setPdfError]     = useState('')
  const [copied,       setCopied]       = useState(false)
  const pdfFetched = useRef(false)

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

  const { config } = useConfig()
  const negocio = config.negocio

  // ── PDF generation for WhatsApp share ───────────────────────
  useEffect(() => {
    if (tab !== 'compartir' || pdfFetched.current) return
    pdfFetched.current = true
    setPdfLoading(true)
    setPdfError('')

    fetch('/api/ventas/ticket-pdf', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ items, total, payment, hora, numeroTicket, clienteNombre, clienteNumero, negocio }),
    })
      .then(async res => {
        const data = await res.json()
        if (!res.ok) throw new Error(data.error ?? 'Error al generar PDF')
        setPdfUrl(data.url as string)
      })
      .catch(err => {
        setPdfError(err instanceof Error ? err.message : 'Error al generar PDF')
        pdfFetched.current = false // allow retry
      })
      .finally(() => setPdfLoading(false))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab])

  function reintentarPDF() {
    pdfFetched.current = false
    setPdfUrl(null)
    setPdfError('')
    // toggle tab to re-trigger the effect
    setTab('imprimir')
    setTimeout(() => setTab('compartir'), 0)
  }

  async function copiarEnlace() {
    if (!pdfUrl) return
    await navigator.clipboard.writeText(pdfUrl)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const TABS = [
    { id: 'imprimir',   label: 'Imprimir',   Icon: Printer },
    { id: 'correo',     label: 'Correo',     Icon: Mail    },
    { id: 'compartir',  label: 'WhatsApp',   Icon: Share2  },
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
            <div style={{ marginBottom: '8px' }}>
              <div style={{ background: '#000', height: '2px' }} />
              <div style={{ textAlign: 'center', padding: '8px 0' }}>
                <p style={{ fontSize: '11px', fontWeight: 'bold', letterSpacing: '4px', margin: '0 0 3px' }}>PAPELERÍA</p>
                <p style={{ fontSize: '15px', fontWeight: 'bold', letterSpacing: '1px', lineHeight: 1.1, margin: 0 }}>LA MÁS</p>
                <p style={{ fontSize: '15px', fontWeight: 'bold', letterSpacing: '1px', lineHeight: 1.1, margin: 0 }}>BARATERA</p>
              </div>
              <div style={{ background: '#000', height: '2px' }} />
            </div>
            <p style={{ textAlign: 'center', fontSize: '11px', lineHeight: 1.45, marginBottom: '5px' }}>
              {negocio.direccion1}<br />
              {negocio.direccion2}
            </p>
            <p style={{ textAlign: 'center', fontSize: '11px', marginBottom: '4px' }}>{negocio.web}</p>
            <p style={{ textAlign: 'center', fontSize: '11px', marginBottom: '7px' }}>{negocio.telefono}</p>

            {/* Hora + Número de ticket en la misma línea */}
            {numeroTicket ? (
              <Row style={{ marginBottom: '4px' }}>
                <span style={{ fontSize: '11px' }}>{hora}</span>
                <span style={{ fontSize: '12px', fontWeight: 'bold', letterSpacing: '0.5px' }}>#{numeroTicket}</span>
              </Row>
            ) : (
              <p style={{ textAlign: 'center', fontSize: '12px', marginBottom: '4px' }}>{hora}</p>
            )}

            {/* Cliente */}
            {clienteNombre && (
              <p style={{ fontSize: '11px', marginBottom: '3px' }}>
                {clienteNumero
                  ? <><span style={{ fontFamily: 'monospace', fontWeight: 'bold' }}>{clienteNumero}</span>{' — '}</>
                  : null
                }
                {clienteNombre}
              </p>
            )}

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
                <div key={i} style={{ marginBottom: '7px' }}>
                  <p style={{ fontWeight: 'bold' }}>{item.nombre}</p>
                  <Row>
                    <span>{descripcion}</span>
                    <span style={{ whiteSpace: 'nowrap', paddingLeft: '6px' }}>{formatMXN(item.subtotal)}</span>
                  </Row>
                </div>
              )
            })}

            <Divider />

            {/* Total */}
            {payment.cuponPct && payment.descuento && (
              <Row style={{ fontSize: '11px' }}>
                <span>Descuento {payment.cuponPct}% Off</span>
                <span style={{ whiteSpace: 'nowrap' }}>−{formatMXN(payment.descuento)}</span>
              </Row>
            )}
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
            <p style={{ textAlign: 'center', fontSize: '11px', marginTop: '10px' }}>{negocio.footer1}</p>
            <p style={{ textAlign: 'center', fontSize: '11px' }}>{negocio.footer2}</p>
            <p style={{ textAlign: 'center', fontSize: '10px', marginTop: '10px' }}>{negocio.footer3}</p>
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

          {/* WhatsApp / Compartir */}
          {tab === 'compartir' && (
            <div className="space-y-2">
              {/* Destino */}
              {clienteTelefono && (
                <p className="text-xs text-slate-500 text-center">
                  Enviando a{' '}
                  <span className="font-mono font-semibold text-slate-700">{clienteTelefono}</span>
                  {clienteNombre ? ` · ${clienteNombre}` : ''}
                </p>
              )}

              {pdfLoading && (
                <div className="flex items-center justify-center gap-2 py-3 text-slate-500 text-sm">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Preparando ticket…
                </div>
              )}
              {pdfError && (
                <div className="space-y-2">
                  <p className="text-xs text-red-500 text-center">{pdfError}</p>
                  <button
                    onClick={reintentarPDF}
                    className="w-full h-10 rounded-xl border border-slate-200 text-sm text-slate-600 hover:bg-slate-50 transition-colors"
                  >
                    Reintentar
                  </button>
                </div>
              )}
              {pdfUrl && (
                <div className="space-y-2">
                  {clienteTelefono ? (
                    <a
                      href={`https://wa.me/52${clienteTelefono}?text=${encodeURIComponent(`Hola${clienteNombre ? ` ${clienteNombre}` : ''}, aquí está tu ticket de Papelería La Más Baratera 🛍️\n\n${pdfUrl}`)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="w-full h-12 flex items-center justify-center gap-2 bg-green-500 hover:bg-green-600 text-white text-sm font-bold rounded-xl transition-colors"
                    >
                      Enviar por WhatsApp
                    </a>
                  ) : (
                    <button
                      onClick={copiarEnlace}
                      className="w-full h-11 flex items-center justify-center gap-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-semibold rounded-xl transition-colors"
                    >
                      <Copy className="w-4 h-4" />
                      {copied ? '¡Copiado!' : 'Copiar enlace'}
                    </button>
                  )}
                  <a
                    href={pdfUrl}
                    download={`ticket-${numeroTicket ?? 'baratera'}.pdf`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full h-10 flex items-center justify-center gap-2 bg-slate-100 hover:bg-slate-200 text-slate-600 text-xs font-semibold rounded-xl transition-colors"
                  >
                    <Download className="w-3.5 h-3.5" />
                    Descargar PDF
                  </a>
                </div>
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