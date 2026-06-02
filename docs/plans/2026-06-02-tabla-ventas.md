# Plan: Tabla `ventas` — Revenue real en Baratera OS

**Fecha:** 2026-06-02  
**Objetivo:** Registrar cada venta como entidad completa con `ventas` + `venta_items`, y migrar el dashboard a datos reales en lugar de la estimación por `stock_ledger`.

---

## Contexto

Actualmente `confirmarVenta()` solo escribe en `stock_ledger` y actualiza `stock_fisico`. El dashboard calcula ingresos estimados como `qty_delta × precio_menudeo`, que no captura precios de caja ni mayoreo. El ticket promedio se calcula como `ingresosHoy / rows_ledger` (un ledger row por producto, no por venta).

---

## Archivos a modificar/crear

| Archivo | Cambio |
|---------|--------|
| `supabase/migration-ventas.sql` | Nuevo — DDL para producción (usuario lo corre en Supabase) |
| `src/lib/types.ts` | Agregar tipos `Venta`, `VentaItem` |
| `src/app/venta/VentaClient.tsx` | `confirmarVenta()`: insertar en `ventas` + `venta_items` antes del loop ledger |
| `src/app/dashboard/page.tsx` | Queries de ingresos → tabla `ventas`; ticketPromedio = COUNT real |

---

## Tarea 1: SQL Migration — Crear tablas en Supabase

**Objetivo:** Definir `ventas` + `venta_items` con RLS, constraints e índices.

**Archivo a crear:** `supabase/migration-ventas.sql`

**SQL:**
```sql
-- ventas: una fila por transacción completa en el POS
CREATE TABLE ventas (
  id              UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  total           DECIMAL(12,2) NOT NULL CHECK (total > 0),
  metodo          TEXT          NOT NULL CHECK (metodo IN ('efectivo', 'tarjeta', 'mixto')),
  monto_efectivo  DECIMAL(12,2) NOT NULL DEFAULT 0,
  monto_tarjeta   DECIMAL(12,2) NOT NULL DEFAULT 0,
  cambio          DECIMAL(12,2) NOT NULL DEFAULT 0,
  cajero_id       UUID          REFERENCES auth.users(id),
  created_at      TIMESTAMPTZ   NOT NULL DEFAULT now()
);

-- venta_items: una fila por producto en la transacción
CREATE TABLE venta_items (
  id              UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  venta_id        UUID          NOT NULL REFERENCES ventas(id) ON DELETE CASCADE,
  producto_id     UUID          NOT NULL REFERENCES productos(id),
  cantidad        INT           NOT NULL CHECK (cantidad > 0),
  precio_unitario DECIMAL(12,2) NOT NULL CHECK (precio_unitario > 0),
  subtotal        DECIMAL(12,2) NOT NULL CHECK (subtotal > 0),
  created_at      TIMESTAMPTZ   NOT NULL DEFAULT now()
);

-- RLS
ALTER TABLE ventas      ENABLE ROW LEVEL SECURITY;
ALTER TABLE venta_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "authenticated read ventas"
  ON ventas FOR SELECT TO authenticated USING (true);
CREATE POLICY "authenticated insert ventas"
  ON ventas FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "authenticated read venta_items"
  ON venta_items FOR SELECT TO authenticated USING (true);
CREATE POLICY "authenticated insert venta_items"
  ON venta_items FOR INSERT TO authenticated WITH CHECK (true);

-- Índices para queries comunes del dashboard
CREATE INDEX idx_ventas_created_at      ON ventas(created_at DESC);
CREATE INDEX idx_venta_items_venta_id   ON venta_items(venta_id);
CREATE INDEX idx_venta_items_producto   ON venta_items(producto_id);
```

**Verificación:**
- [ ] Tablas creadas en Supabase sin errores
- [ ] RLS activo — autenticado puede insertar y leer
- [ ] Índices creados

---

## Tarea 2: Agregar tipos a `lib/types.ts`

**Objetivo:** Tipos TypeScript para `Venta` y `VentaItem`.

**Archivo:** `src/lib/types.ts` — agregar al final

**Código:**
```typescript
export interface Venta {
  id:             string
  total:          number
  metodo:         'efectivo' | 'tarjeta' | 'mixto'
  monto_efectivo: number
  monto_tarjeta:  number
  cambio:         number
  cajero_id:      string | null
  created_at:     string
}

export interface VentaItem {
  id:              string
  venta_id:        string
  producto_id:     string
  cantidad:        number
  precio_unitario: number
  subtotal:        number
  created_at:      string
  productos?:      { nombre: string; unidad: string }
}
```

**Verificación:**
- [ ] `npx tsc --noEmit` sin errores nuevos

---

## Tarea 3: Actualizar `confirmarVenta()` en VentaClient.tsx

**Objetivo:** Insertar en `ventas` + `venta_items` antes del loop de `stock_ledger`. Si falla la inserción de `ventas`, abortar con error (no continuar al ledger).

**Archivo:** `src/app/venta/VentaClient.tsx` — función `confirmarVenta()` líneas 461-527

**Lógica de precio_unitario:** `subtotalItem(item) / piezasReales(item)`. Si `piezasReales` es 0 (edge case), usar `precio_menudeo`.

**Código nuevo (insertar justo después de la validación de stock, antes del loop ledger):**
```typescript
// Insert venta header
const { data: ventaData, error: ventaError } = await supabase
  .from('ventas')
  .insert({
    total:          totalCarrito(carrito),
    metodo:         payment.metodo,
    monto_efectivo: payment.montoEfectivo,
    monto_tarjeta:  payment.montoTarjeta,
    cambio:         payment.cambio,
    cajero_id:      user?.id ?? null,
  })
  .select('id')
  .single()

if (ventaError || !ventaData) {
  setError('Error al registrar la venta. Intenta de nuevo.')
  setConfirmando(false)
  return
}

// Insert venta items
const ventaItems = carrito.map(item => {
  const piezas   = piezasReales(item)
  const subtotal = subtotalItem(item)
  return {
    venta_id:        ventaData.id,
    producto_id:     item.producto.id,
    cantidad:        piezas > 0 ? piezas : 1,
    precio_unitario: piezas > 0 ? subtotal / piezas : Number(item.producto.precio_menudeo),
    subtotal,
  }
})
await supabase.from('venta_items').insert(ventaItems)
```

**Verificación:**
- [ ] Hacer una venta de prueba y verificar que aparece en Supabase → `ventas`
- [ ] Verificar que los `venta_items` tienen cantidades y precios correctos
- [ ] Verificar que el ledger sigue escribiendo (flujo existente intacto)

---

## Tarea 4: Migrar dashboard a tabla `ventas`

**Objetivo:** Reemplazar las queries de ingresos basadas en `stock_ledger` con queries directas a `ventas`. El ticket promedio ahora es el promedio real de transacciones, no una aproximación.

**Archivo:** `src/app/dashboard/page.tsx`

**Queries a reemplazar (líneas ~80-107):**

_Antes:_
```typescript
supabase.from('stock_ledger')
  .select('qty_antes, qty_despues, productos(precio_menudeo)')
  .eq('tipo', 'salida_venta_manual')
  .gte('created_at', todayStart),
// ...semana y anterior también
```

_Después:_
```typescript
supabase.from('ventas').select('total, created_at').gte('created_at', todayStart),
supabase.from('stock_ledger').select('id').eq('tipo', 'entrada_compra').gte('created_at', todayStart),
supabase.from('ventas').select('total, created_at').gte('created_at', sevenAgo),
supabase.from('ventas').select('total').gte('created_at', fourteenAgo).lt('created_at', sevenAgo),
```

**KPI calculations actualizadas:**
```typescript
const ingresosHoy      = (ventasHoy ?? []).reduce((s, v) => s + Number(v.total), 0)
const ingresosSemana   = (ventasSemana ?? []).reduce((s, v) => s + Number(v.total), 0)
const ingresosAnterior = (ventasAnterior ?? []).reduce((s, v) => s + Number(v.total), 0)
const transaccionesHoy = ventasHoy?.length ?? 0
const ticketPromedio   = transaccionesHoy > 0 ? ingresosHoy / transaccionesHoy : 0
```

**Chart data actualizado:**
```typescript
const chartData: ChartDay[] = Array.from({ length: 7 }, (_, i) => {
  const d          = new Date(now.getTime() - (6 - i) * 86_400_000)
  const datePrefix = d.toISOString().split('T')[0]
  const dayVentas  = (ventasSemana ?? []).filter(v => v.created_at.startsWith(datePrefix))
  return {
    fecha:         d.toLocaleDateString('es-MX', { weekday: 'short', day: 'numeric' }),
    ingresos:      dayVentas.reduce((s, v) => s + Number(v.total), 0),
    transacciones: dayVentas.length,
  }
})
```

**Verificación:**
- [ ] Dashboard carga sin errores
- [ ] KPIs muestran datos (o $0 si no hay ventas en el período)
- [ ] `npx tsc --noEmit` sin errores
- [ ] `node node_modules/next/dist/bin/next build` pasa

---

## Orden de ejecución

1. Tarea 1 — SQL en Supabase (manual)
2. Tarea 2 — types.ts
3. Tarea 3 — VentaClient.tsx
4. Tarea 4 — dashboard/page.tsx
5. Build + deploy

## Post-implementación

- El `calcRevenue()` en dashboard puede eliminarse — ya no se usa
- El top movers sigue usando `stock_ledger` (correcto — mide movimiento de piezas, no ingresos)
- Ingresos aproximados en costos donut aún vienen de `stock_ledger(entrada_compra)` — eso es correcto (mide costo de mercancía, no ingresos)
