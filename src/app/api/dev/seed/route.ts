import { NextResponse } from 'next/server'
import { createClient }      from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { logAudit } from '@/lib/audit'

async function verifyDeveloper() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || user.app_metadata?.role !== 'developer') return null
  return user
}

// Datos demo identificables por el prefijo [DEMO] — para probar flujos
// completos. Se eliminan con el reset de Productos/Proveedores o borrando
// manualmente los registros con prefijo.

const PRODUCTOS_DEMO = [
  { nombre: '[DEMO] Cuaderno profesional 100h', sku: 'DEMO-001', precio_menudeo: 32, precio_mayoreo: 26, umbral_mayoreo: 12, precio_caja: 290, piezas_por_caja: 10, stock: 45, stock_minimo: 20, unidad: 'pza', categoria: 'Cuadernos',
    colores: [{ nombre: 'Rojo', hex: '#ef4444', stock: 15 }, { nombre: 'Azul', hex: '#3b82f6', stock: 20 }, { nombre: 'Verde', hex: '#22c55e', stock: 10 }] },
  { nombre: '[DEMO] Bolígrafo punto fino',      sku: 'DEMO-002', precio_menudeo: 8,  precio_mayoreo: 5.5, umbral_mayoreo: 24, precio_caja: 110, piezas_por_caja: 24, stock: 96, stock_minimo: 48, unidad: 'pza', categoria: 'Escritura',
    colores: [{ nombre: 'Negro', hex: '#1e293b', stock: 48 }, { nombre: 'Azul', hex: '#3b82f6', stock: 48 }] },
  { nombre: '[DEMO] Lápiz #2 hexagonal',        sku: 'DEMO-003', precio_menudeo: 6,  precio_mayoreo: 4,   umbral_mayoreo: 36, precio_caja: null, piezas_por_caja: null, stock: 150, stock_minimo: 50, unidad: 'pza', categoria: 'Escritura', colores: [] },
  { nombre: '[DEMO] Corrector líquido 9ml',     sku: 'DEMO-004', precio_menudeo: 18, precio_mayoreo: null, umbral_mayoreo: null, precio_caja: null, piezas_por_caja: null, stock: 8, stock_minimo: 10, unidad: 'pza', categoria: 'Corrección', colores: [] },
  { nombre: '[DEMO] Resma papel carta 500h',    sku: 'DEMO-005', precio_menudeo: 145, precio_mayoreo: 125, umbral_mayoreo: 5, precio_caja: null, piezas_por_caja: null, stock: 22, stock_minimo: 8, unidad: 'resma', categoria: 'Oficina', colores: [] },
  { nombre: '[DEMO] Marcatextos pastel',        sku: 'DEMO-006', precio_menudeo: 15, precio_mayoreo: 11,  umbral_mayoreo: 12, precio_caja: 160, piezas_por_caja: 12, stock: 30, stock_minimo: 24, unidad: 'pza', categoria: 'Escritura',
    colores: [{ nombre: 'Amarillo', hex: '#eab308', stock: 12 }, { nombre: 'Rosa', hex: '#ec4899', stock: 10 }, { nombre: 'Turquesa', hex: '#06b6d4', stock: 8 }] },
  { nombre: '[DEMO] Tijeras escolares 5"',      sku: 'DEMO-007', precio_menudeo: 25, precio_mayoreo: null, umbral_mayoreo: null, precio_caja: null, piezas_por_caja: null, stock: 3, stock_minimo: 6, unidad: 'pza', categoria: 'Escolar', colores: [] },
  { nombre: '[DEMO] Pegamento en barra 21g',    sku: 'DEMO-008', precio_menudeo: 14, precio_mayoreo: 10,  umbral_mayoreo: 20, precio_caja: 240, piezas_por_caja: 24, stock: 60, stock_minimo: 24, unidad: 'pza', categoria: 'Escolar', colores: [] },
]

export async function POST() {
  const caller = await verifyDeveloper()
  if (!caller) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const admin = createAdminClient()
  const resumen = { productos: 0, colores: 0, ledger: 0, proveedores: 0, adeudos: 0, costos: 0 }

  // Evitar duplicados si ya se sembró antes
  const { data: existentes } = await admin
    .from('productos')
    .select('id')
    .like('nombre', '[DEMO]%')
    .limit(1)

  if (existentes && existentes.length > 0) {
    return NextResponse.json(
      { error: 'Ya hay datos demo sembrados. Borra los productos [DEMO] primero (reset Productos).' },
      { status: 409 },
    )
  }

  // ── Proveedor demo + adeudo ─────────────────────────────────
  const { data: prov } = await admin
    .from('proveedores')
    .insert({ nombre: '[DEMO] Distribuidora Papelera Centro' })
    .select('id')
    .single()

  if (prov) {
    resumen.proveedores = 1
    const vence = new Date(Date.now() + 14 * 86400000).toISOString().split('T')[0]
    const { error } = await admin.from('adeudos').insert({
      proveedor_id:      prov.id,
      descripcion:       '[DEMO] Pedido cuadernos y bolígrafos',
      monto:             4850,
      fecha_vencimiento: vence,
      estado:            'pendiente',
    })
    if (!error) resumen.adeudos = 1
  }

  // ── Productos + colores + ledger (levantamiento inicial) ────
  for (const p of PRODUCTOS_DEMO) {
    const { data: prod, error } = await admin
      .from('productos')
      .insert({
        nombre:          p.nombre,
        sku:             p.sku,
        precio_menudeo:  p.precio_menudeo,
        precio_mayoreo:  p.precio_mayoreo,
        umbral_mayoreo:  p.umbral_mayoreo,
        precio_caja:     p.precio_caja,
        piezas_por_caja: p.piezas_por_caja,
        stock_fisico:    p.stock,
        stock_minimo:    p.stock_minimo,
        unidad:          p.unidad,
        categoria:       p.categoria,
        activo:          true,
      })
      .select('id')
      .single()

    if (error || !prod) continue
    resumen.productos++

    if (p.colores.length > 0) {
      const { error: colError } = await admin.from('producto_colores').insert(
        p.colores.map(c => ({
          producto_id: prod.id,
          nombre:      c.nombre,
          hex:         c.hex,
          stock:       c.stock,
        })),
      )
      if (!colError) resumen.colores += p.colores.length
    }

    const { error: ledError } = await admin.from('stock_ledger').insert({
      producto_id: prod.id,
      tipo:        'levantamiento_inventario',
      qty_antes:   0,
      qty_despues: p.stock,
      notas:       '[DEMO] Levantamiento inicial de datos demo',
      canal:       'manual',
      proveedor_id: prov?.id ?? null,
    })
    if (!ledError) resumen.ledger++
  }

  // ── Costos fijos demo ────────────────────────────────────────
  const { error: costosError } = await admin.from('costos_fijos').insert([
    { nombre: '[DEMO] Renta local',     monto: 8500, categoria: 'renta',     periodo: 'mensual', activo: true },
    { nombre: '[DEMO] Luz e internet',  monto: 1200, categoria: 'servicios', periodo: 'mensual', activo: true },
  ])
  if (!costosError) resumen.costos = 2

  await logAudit('datos.seed', resumen, caller.email)
  return NextResponse.json({ ok: true, resumen })
}
