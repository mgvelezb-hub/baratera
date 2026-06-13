import React from 'react'
import { Document, Page, Text, View, Image, StyleSheet } from '@react-pdf/renderer'
import { montoALetras } from '@/lib/utils'

interface Item {
  nombre:          string
  cantidadCajas:   number
  cantidadPiezas:  number
  unidad:          string
  subtotal:        number
  colorNombre?:    string | null
  sku?:            string | null
  cantidad?:       number
  precioUnitario?: number
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
  fecha?:         string | null
  cajero?:        string | null
  numeroTicket?:  string | null
  clienteNombre?: string | null
  clienteNumero?: string | null
  logoSrc?:       string | null
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

function fmtNum(n: number): string {
  return new Intl.NumberFormat('es-MX').format(n)
}

const S = StyleSheet.create({
  page:      { fontFamily: 'Courier', fontSize: 9, color: '#000000', padding: 14, backgroundColor: '#FFFFFF' },
  center:    { textAlign: 'center' },
  bold:      { fontFamily: 'Courier-Bold' },
  row:       { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  divider:   { borderTopWidth: 0.5, borderTopColor: '#000000', marginTop: 5, marginBottom: 5 },
  logo:      { width: 110, height: 116, objectFit: 'contain', alignSelf: 'center', marginBottom: 6, borderRadius: 6 },
  title:     { fontFamily: 'Courier-Bold', fontSize: 13, textAlign: 'center', letterSpacing: 1, marginBottom: 6 },
  subText:   { fontSize: 8, textAlign: 'center' },
  itemName:  { fontFamily: 'Courier-Bold', fontSize: 9 },
  totalLine: { fontFamily: 'Courier-Bold', fontSize: 12 },
  footer:    { fontSize: 7.5, textAlign: 'center', color: '#333333' },
  mb1:       { marginBottom: 2 },
  mb2:       { marginBottom: 4 },
  mt1:       { marginTop: 3 },
})

export default function TicketPDF({
  items, total, payment, hora, fecha, cajero, numeroTicket,
  clienteNombre, clienteNumero, logoSrc, negocio,
}: TicketPDFInput) {
  const metodoLabel =
    payment.metodo === 'efectivo'        ? 'Efectivo'
    : payment.metodo === 'tarjeta'       ? 'Tarjeta'
    : payment.metodo === 'transferencia' ? 'Transferencia SPEI'
    : 'Efectivo + Tarjeta'

  const sinDesglose =
    payment.montoEfectivo === 0 && payment.montoTarjeta === 0 && payment.montoTransferencia === 0

  return (
    <Document>
      <Page size={[200, 1000]} style={S.page}>

        {/* Logo */}
        {logoSrc ? <Image src={logoSrc} style={S.logo} /> : null}

        {/* Negocio */}
        <Text style={[S.subText, S.mb1]}>{negocio.direccion1}</Text>
        <Text style={[S.subText, S.mb1]}>{negocio.direccion2}</Text>
        <Text style={[S.subText, S.mb1]}>{negocio.web}</Text>
        <Text style={[S.subText, S.mb2]}>CEL. +52 {negocio.telefono}</Text>

        {/* Título */}
        <Text style={S.title}>NOTA DE VENTA</Text>

        {/* Datos de la nota */}
        {numeroTicket ? (
          <View style={[S.row, S.mb1]}>
            <Text>Nota no.:</Text>
            <Text style={S.bold}>{numeroTicket}</Text>
          </View>
        ) : null}
        <View style={[S.row, S.mb1]}>
          <Text>Fecha:</Text>
          <Text>{fecha ?? hora}</Text>
        </View>
        {clienteNombre ? (
          <View style={[S.row, S.mb1]}>
            <Text>Cliente {clienteNumero ?? ''}</Text>
            <Text style={S.bold}>{clienteNombre.toUpperCase()}</Text>
          </View>
        ) : null}
        {cajero ? (
          <View style={[S.row, S.mb1]}>
            <Text>Atendido por:</Text>
            <Text>{cajero}</Text>
          </View>
        ) : null}

        <View style={S.divider} />

        {/* Encabezado columnas */}
        <View style={S.row}>
          <Text style={[S.bold, { fontSize: 8 }]}>Cant. · Descripción</Text>
          <Text style={[S.bold, { fontSize: 8 }]}>Importe</Text>
        </View>

        {/* Items */}
        {items.map((item, i) => {
          const cantidad = item.cantidad ?? item.cantidadPiezas
          const uPieza   = item.unidad === 'caja' ? 'pza' : item.unidad
          const precioU  = item.precioUnitario ?? (cantidad > 0 ? item.subtotal / cantidad : item.subtotal)
          const nombre   = [item.nombre, item.colorNombre].filter(Boolean).join(' / ')
          return (
            <View key={i} style={S.mt1}>
              <Text style={S.itemName}>
                {item.sku ? `[${item.sku}] ` : ''}{nombre}
              </Text>
              <View style={S.row}>
                <Text style={{ fontSize: 8, maxWidth: 120 }}>{fmtNum(cantidad)} {uPieza} × {fmt(precioU)}</Text>
                <Text style={{ fontSize: 8 }}>{fmt(item.subtotal)}</Text>
              </View>
            </View>
          )
        })}

        <View style={S.divider} />

        {/* Total */}
        {payment.cuponPct && payment.descuento ? (
          <View style={[S.row, S.mb1]}>
            <Text style={{ fontSize: 8 }}>Descuento {payment.cuponPct}% Off</Text>
            <Text style={{ fontSize: 8 }}>−{fmt(payment.descuento)}</Text>
          </View>
        ) : null}
        <View style={S.row}>
          <Text style={S.totalLine}>TOTAL</Text>
          <Text style={S.totalLine}>{fmt(total)}</Text>
        </View>

        {/* Desglose de pago */}
        {payment.montoEfectivo > 0 && (
          <View style={[S.row, S.mt1]}><Text>Efectivo</Text><Text>{fmt(payment.montoEfectivo)}</Text></View>
        )}
        {payment.montoTarjeta > 0 && (
          <View style={[S.row, S.mt1]}><Text>Tarjeta</Text><Text>{fmt(payment.montoTarjeta)}</Text></View>
        )}
        {payment.montoTransferencia > 0 && (
          <View style={[S.row, S.mt1]}><Text>Transferencia</Text><Text>{fmt(payment.montoTransferencia)}</Text></View>
        )}
        {sinDesglose && (
          <View style={[S.row, S.mt1]}><Text>Pago</Text><Text>{metodoLabel}</Text></View>
        )}
        {payment.cambio > 0 && (
          <View style={[S.row, S.mt1]}><Text style={S.bold}>Cambio</Text><Text style={S.bold}>{fmt(payment.cambio)}</Text></View>
        )}

        {/* Total en letras */}
        <Text style={[S.subText, { marginTop: 6 }]}>{montoALetras(total)}</Text>

        <View style={S.divider} />

        {/* Footer */}
        <Text style={[{ fontFamily: 'Courier-Bold', fontSize: 10, textAlign: 'center', marginBottom: 4 }]}>{negocio.footer1}</Text>
        {negocio.footer3 ? <Text style={S.footer}>{negocio.footer3}</Text> : null}

        {/* Pie: fecha + cajero */}
        <View style={[S.row, { marginTop: 8 }]}>
          <Text style={{ fontSize: 7.5 }}>{fecha ?? hora}</Text>
          {cajero ? <Text style={{ fontSize: 7.5 }}>{cajero}</Text> : null}
        </View>

      </Page>
    </Document>
  )
}
