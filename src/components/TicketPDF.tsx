import React from 'react'
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer'

interface Item {
  nombre:         string
  cantidadCajas:  number
  cantidadPiezas: number
  unidad:         string
  subtotal:       number
  colorNombre?:   string | null
}

interface Payment {
  metodo:              string
  montoEfectivo:       number
  montoTarjeta:        number
  montoTransferencia:  number
  cambio:              number
  cuponPct?:           number | null
  descuento?:          number | null
}

export interface TicketPDFInput {
  items:          Item[]
  total:          number
  payment:        Payment
  hora:           string
  numeroTicket?:  string | null
  clienteNombre?: string | null
  clienteNumero?: string | null
  negocio: {
    nombre:    string
    direccion1: string
    direccion2: string
    web:        string
    telefono:   string
    footer1:    string
    footer2:    string
    footer3?:   string
  }
}

function fmt(n: number): string {
  return new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(n)
}

function descripcionItem(item: Item): string {
  const parts: string[] = []
  if (item.cantidadCajas > 0) {
    parts.push(`${item.cantidadCajas} ${item.cantidadCajas === 1 ? 'caja' : 'cajas'}`)
  }
  if (item.cantidadPiezas > 0) {
    const u = item.cantidadCajas > 0 || item.unidad === 'caja' ? 'pza' : item.unidad
    parts.push(`${item.cantidadPiezas} ${u}`)
  }
  const desc = parts.join(' + ')
  return item.colorNombre ? `${desc} / ${item.colorNombre}` : desc
}

const S = StyleSheet.create({
  page:      { fontFamily: 'Courier', fontSize: 9, color: '#000000', padding: 14, backgroundColor: '#FFFFFF' },
  center:    { textAlign: 'center' },
  bold:      { fontFamily: 'Courier-Bold' },
  row:       { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  divider:   { borderTopWidth: 0.5, borderTopColor: '#000000', marginTop: 5, marginBottom: 5 },
  bar:       { backgroundColor: '#000000', height: 2 },
  headerSm:  { fontFamily: 'Courier-Bold', fontSize: 8, textAlign: 'center', letterSpacing: 3 },
  titleLg:   { fontFamily: 'Courier-Bold', fontSize: 13, textAlign: 'center', letterSpacing: 0.5 },
  subText:   { fontSize: 8, textAlign: 'center' },
  itemName:  { fontFamily: 'Courier-Bold', fontSize: 9 },
  totalLine: { fontFamily: 'Courier-Bold', fontSize: 12 },
  footer:    { fontSize: 7.5, textAlign: 'center', color: '#333333' },
  mb1:       { marginBottom: 2 },
  mb2:       { marginBottom: 4 },
  mb3:       { marginBottom: 6 },
})

export default function TicketPDF({
  items, total, payment, hora, numeroTicket, clienteNombre, clienteNumero, negocio,
}: TicketPDFInput) {
  const metodoLabel =
    payment.metodo === 'efectivo'        ? 'Efectivo'
    : payment.metodo === 'tarjeta'       ? 'Tarjeta'
    : payment.metodo === 'transferencia' ? 'Transferencia SPEI'
    : 'Efectivo + Tarjeta'

  return (
    <Document>
      <Page size={[200, 1000]} style={S.page}>

        {/* Header */}
        <View style={[S.bar, S.mb2]} />
        <Text style={[S.headerSm, S.mb1]}>PAPELERÍA</Text>
        <Text style={[S.titleLg, S.mb1]}>LA MÁS</Text>
        <Text style={[S.titleLg, S.mb2]}>BARATERA</Text>
        <View style={[S.bar, S.mb2]} />

        {/* Dirección */}
        <Text style={[S.subText, S.mb1]}>{negocio.direccion1}</Text>
        <Text style={[S.subText, S.mb1]}>{negocio.direccion2}</Text>
        <Text style={[S.subText, S.mb1]}>{negocio.web}</Text>
        <Text style={[S.subText, S.mb2]}>{negocio.telefono}</Text>

        {/* Hora + ticket */}
        {numeroTicket ? (
          <View style={[S.row, S.mb1]}>
            <Text style={{ fontSize: 8 }}>{hora}</Text>
            <Text style={[S.bold, { fontSize: 9 }]}>#{numeroTicket}</Text>
          </View>
        ) : (
          <Text style={[S.subText, S.mb1]}>{hora}</Text>
        )}

        {/* Cliente */}
        {clienteNombre && (
          <Text style={[{ fontSize: 8 }, S.mb1]}>
            {clienteNumero ? `${clienteNumero} — ` : ''}{clienteNombre}
          </Text>
        )}

        <View style={S.divider} />

        {/* Items */}
        {items.map((item, i) => (
          <View key={i} style={S.mb2}>
            <Text style={S.itemName}>{item.nombre}</Text>
            <View style={S.row}>
              <Text style={{ fontSize: 8, maxWidth: 110 }}>{descripcionItem(item)}</Text>
              <Text style={{ fontSize: 8 }}>{fmt(item.subtotal)}</Text>
            </View>
          </View>
        ))}

        <View style={S.divider} />

        {/* Total */}
        {payment.cuponPct && payment.descuento ? (
          <View style={[S.row, S.mb1]}>
            <Text style={{ fontSize: 8 }}>Descuento {payment.cuponPct}% Off</Text>
            <Text style={{ fontSize: 8 }}>−{fmt(payment.descuento)}</Text>
          </View>
        ) : null}
        <View style={[S.row, S.mb2]}>
          <Text style={S.totalLine}>TOTAL</Text>
          <Text style={S.totalLine}>{fmt(total)}</Text>
        </View>

        <View style={S.divider} />

        {/* Pago */}
        <View style={[S.row, S.mb1]}>
          <Text>Pago</Text>
          <Text>{metodoLabel}</Text>
        </View>
        {payment.montoEfectivo > 0 && (
          <View style={[S.row, S.mb1]}>
            <Text>Efectivo</Text>
            <Text>{fmt(payment.montoEfectivo)}</Text>
          </View>
        )}
        {payment.montoTarjeta > 0 && (
          <View style={[S.row, S.mb1]}>
            <Text>Tarjeta</Text>
            <Text>{fmt(payment.montoTarjeta)}</Text>
          </View>
        )}
        {payment.montoTransferencia > 0 && (
          <View style={[S.row, S.mb1]}>
            <Text>Transferencia</Text>
            <Text>{fmt(payment.montoTransferencia)}</Text>
          </View>
        )}
        {payment.cambio > 0 && (
          <View style={[S.row, S.mb2]}>
            <Text style={S.bold}>Cambio</Text>
            <Text style={S.bold}>{fmt(payment.cambio)}</Text>
          </View>
        )}

        <View style={S.divider} />

        {/* Footer */}
        <Text style={[S.footer, S.mb1]}>{negocio.footer1}</Text>
        <Text style={[S.footer, S.mb1]}>{negocio.footer2}</Text>
        {negocio.footer3 ? (
          <Text style={[S.footer, { fontSize: 7, marginTop: 6 }]}>{negocio.footer3}</Text>
        ) : null}

      </Page>
    </Document>
  )
}
