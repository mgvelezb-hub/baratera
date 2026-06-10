import { NextRequest, NextResponse } from 'next/server'
import { createClient }      from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { logAudit }          from '@/lib/audit'

interface FilaImportada {
  nombre:            string
  color?:            string
  existencia_cajas:  number
  existencia_piezas: number
  piezas_por_caja?:  number
  contenido_paquete?: number
  precio_menudeo:    number
  precio_mayoreo?:   number
  precio_caja?:      number
}

const COLOR_HEX: Record<string, string> = {
  rojo:      '#ef4444', azul:       '#3b82f6', verde:    '#22c55e',
  amarillo:  '#eab308', naranja:    '#f97316', morado:   '#a855f7',
  violeta:   '#8b5cf6', rosa:       '#ec4899', negro:    '#1e293b',
  blanco:    '#f8fafc', gris:       '#94a3b8', cafe:     '#92400e',
  café:      '#92400e', dorado:     '#d97706', plateado: '#cbd5e1',
  turquesa:  '#14b8a6', celeste:    '#38bdf8', beige:    '#fef9c3',
  lila:      '#c084fc', terracota:  '#c2410c', menta:    '#a7f3d0',
}

function hexColor(nombre: string): string {
  return COLOR_HEX[nombre.toLowerCase().trim()] ?? '#94a3b8'
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || user.app_metadata?.role !== 'developer') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { filas }: { filas: FilaImportada[] } = await req.json()

  if (!Array.isArray(filas) || filas.length === 0) {
    return NextResponse.json({ error: 'Sin datos para importar' }, { status: 400 })
  }

  const admin    = createAdminClient()
  const creados: string[]                              = []
  const errores: Array<{ nombre: string; error: string }> = []

  // Group rows by product name
  const groups = new Map<string, FilaImportada[]>()
  for (const fila of filas) {
    const nombre = fila.nombre?.trim()
    if (!nombre) continue
    if (!groups.has(nombre)) groups.set(nombre, [])
    groups.get(nombre)!.push(fila)
  }

  // Skip products that already exist
  const nombres = Array.from(groups.keys())
  const { data: existentes } = await admin
    .from('productos')
    .select('nombre')
    .in('nombre', nombres)

  const existentesSet = new Set((existentes ?? []).map((p: { nombre: string }) => p.nombre))

  for (const [nombre, rows] of groups) {
    if (existentesSet.has(nombre)) {
      errores.push({ nombre, error: 'Ya existe — omitido' })
      continue
    }

    const primera = rows[0]
    const ppc = primera.piezas_por_caja || primera.contenido_paquete || null
    const tieneColores = rows.some(f => f.color?.trim())

    // Calculate total stock in piezas
    let stockTotal = 0
    if (tieneColores) {
      for (const row of rows) {
        const ppcR = row.piezas_por_caja || row.contenido_paquete || 0
        stockTotal += (row.existencia_cajas || 0) * ppcR + (row.existencia_piezas || 0)
      }
    } else {
      const ppcR = ppc || 0
      stockTotal = (primera.existencia_cajas || 0) * ppcR + (primera.existencia_piezas || 0)
    }

    const { data: producto, error: prodError } = await admin
      .from('productos')
      .insert({
        nombre,
        precio_menudeo:  primera.precio_menudeo,
        precio_mayoreo:  primera.precio_mayoreo  || null,
        precio_caja:     primera.precio_caja     || null,
        piezas_por_caja: ppc                     || null,
        stock_fisico:    stockTotal,
        stock_minimo:    5,
        unidad:          'pza',
      })
      .select()
      .single()

    if (prodError || !producto) {
      errores.push({ nombre, error: prodError?.message ?? 'Error al insertar' })
      continue
    }

    if (tieneColores) {
      let stockAcum = 0
      for (const row of rows) {
        const colorNombre = row.color?.trim()
        if (!colorNombre) continue
        const ppcR        = row.piezas_por_caja || row.contenido_paquete || 0
        const stockPiezas = (row.existencia_cajas || 0) * ppcR + (row.existencia_piezas || 0)

        const { data: colorRow } = await admin
          .from('producto_colores')
          .insert({ producto_id: producto.id, nombre: colorNombre, hex: hexColor(colorNombre), stock: stockPiezas })
          .select()
          .single()

        if (colorRow && colorRow.stock_minimo === undefined) {
          await admin.from('producto_colores').update({ stock_minimo: null }).eq('id', colorRow.id)
        }

        if (stockPiezas > 0) {
          await admin.from('stock_ledger').insert({
            producto_id:    producto.id,
            tipo:           'levantamiento_inventario',
            qty_antes:      stockAcum,
            qty_despues:    stockAcum + stockPiezas,
            notas:          `Importación Excel — color ${colorNombre}`,
            canal:          'importacion_excel',
            usuario_id:     user.id,
            color_variante: colorNombre,
          })
          stockAcum += stockPiezas
        }
      }
    } else if (stockTotal > 0) {
      await admin.from('stock_ledger').insert({
        producto_id: producto.id,
        tipo:        'levantamiento_inventario',
        qty_antes:   0,
        qty_despues: stockTotal,
        notas:       'Importación Excel — stock inicial',
        canal:       'importacion_excel',
        usuario_id:  user.id,
      })
    }

    creados.push(nombre)
  }

  await logAudit(
    'datos.importados',
    { creados: creados.length, omitidos: errores.filter(e => e.error.includes('Ya existe')).length, errores: errores.filter(e => !e.error.includes('Ya existe')).length },
    user.email ?? undefined,
  )

  return NextResponse.json({ creados: creados.length, errores })
}
