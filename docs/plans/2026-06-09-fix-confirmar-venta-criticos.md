# Fix confirmarVenta — Bugs Críticos C1 + C2 + C3

**Fecha:** 2026-06-09  
**Archivo objetivo:** `src/app/venta/VentaClient.tsx`  
**Función objetivo:** `confirmarVenta()` (~línea 782)

---

## Contexto del problema

La función `confirmarVenta` en VentaClient.tsx tiene 3 bugs críticos que pueden causar pérdida de datos de inventario en ventas multi-color:

- **C3** — La validación verifica cada color individualmente pero no la suma total vs `stock_fisico`. Permite vender más unidades de las que existen.
- **C2** — El loop de update de stock lee `actual.stock_fisico` del array `actuales` (fetched antes del loop) sin mutarlo tras cada iteración. El segundo item del mismo producto parte del stock stale, borrando la deducción anterior.
- **C1** — El update del color usa `coloresMap` (state cargado al montar el componente) en vez de `coloresActuales` (frescos de DB, fetched en esta misma función). Si otra sesión cambió el stock entre mount y confirm, la deducción es incorrecta.

---

## Tarea 1: Fix C3 — Validar total acumulado por producto antes del loop

**Objetivo:** Antes del loop de validación individual, calcular la suma de piezas por `producto_id` y rechazar si supera el `stock_fisico`.

**Archivos a modificar:**
- `src/app/venta/VentaClient.tsx` — añadir bloque de validación acumulada antes de la línea 797

**Implementación:**

Insertar esto ANTES del comentario `// Stock validation` (~línea 796):

```typescript
// C3: Validar que el total de piezas por producto no excede stock_fisico
const totalPiezasPorProducto = new Map<string, number>()
for (const item of carrito) {
  const id = item.producto.id
  totalPiezasPorProducto.set(id, (totalPiezasPorProducto.get(id) ?? 0) + piezasReales(item))
}
for (const [productoId, totalPiezas] of totalPiezasPorProducto) {
  const actual = actuales?.find(p => p.id === productoId)
  if (actual && actual.stock_fisico < totalPiezas) {
    setError(`Sin stock suficiente: ${actual.nombre} (necesitas ${totalPiezas} pzas, hay ${actual.stock_fisico})`)
    setConfirmando(false)
    return
  }
}
```

**Verificación:**
- [ ] Cart con un producto [Rojo×4 + Azul×4] donde `stock_fisico=5` → venta BLOQUEADA con mensaje claro
- [ ] Cart con un producto [Rojo×2 + Azul×2] donde `stock_fisico=5` → venta PERMITIDA
- [ ] Cart con un solo color donde `stock color < piezas` → sigue siendo bloqueada por el loop original

---

## Tarea 2: Fix C1 — Agregar `id` al select de coloresActuales

**Objetivo:** El campo `id` es necesario para hacer el UPDATE en `producto_colores`. Actualmente el select no lo incluye, obligando a usar `coloresMap` stale.

**Archivos a modificar:**
- `src/app/venta/VentaClient.tsx` — modificar la query de `coloresActuales` en la línea ~793

**Implementación:**

Cambiar línea ~793 de:
```typescript
supabase.from('producto_colores').select('producto_id, nombre, stock').in('producto_id', productoIds),
```
a:
```typescript
supabase.from('producto_colores').select('id, producto_id, nombre, stock').in('producto_id', productoIds),
```

**Verificación:**
- [ ] TypeScript no emite errores (el campo `id` ahora está en el resultado)
- [ ] El valor `colorRow.id` en la Tarea 3 resuelve correctamente

---

## Tarea 3: Fix C1 — Usar coloresActuales en lugar de coloresMap en el update

**Objetivo:** En el loop de update (~línea 880), reemplazar `coloresMap.get(...)` por `coloresActuales?.find(...)` para que la deducción parta del stock real al momento de confirmar.

**Archivos a modificar:**
- `src/app/venta/VentaClient.tsx` — modificar línea ~881

**Implementación:**

Cambiar línea ~881 de:
```typescript
const colorRow = (coloresMap.get(item.producto.id) ?? []).find(c => c.nombre === item.colorNombre)
```
a:
```typescript
const colorRow = coloresActuales?.find(c => c.producto_id === item.producto.id && c.nombre === item.colorNombre)
```

**Verificación:**
- [ ] TypeScript no emite errores
- [ ] Al confirmar una venta con color, el stock de `producto_colores` se decrementa correctamente
- [ ] Si `coloresActuales` es null (error de red), `colorRow` es undefined → el `if (colorRow)` lo maneja sin crash

---

## Tarea 4: Fix C2 — Mutar stock_fisico en memoria tras cada deducción

**Objetivo:** Después de actualizar `stock_fisico` en DB para un item, actualizar también el objeto `actual` en memoria para que la siguiente iteración del mismo producto parta del valor ya decrementado.

**Archivos a modificar:**
- `src/app/venta/VentaClient.tsx` — añadir una línea después del UPDATE de productos (~línea 877)

**Implementación:**

Después de la línea:
```typescript
await supabase.from('productos').update({ stock_fisico: nuevoStock }).eq('id', item.producto.id)
```

Agregar:
```typescript
actual.stock_fisico = nuevoStock  // C2: mutar en memoria para evitar lectura stale en siguiente iteración
```

**Verificación:**
- [ ] Venta con [Rojo×5 + Azul×3] sobre producto con `stock_fisico=10` → DB queda en `2` (no en `7`)
- [ ] El `stock_ledger` registra `qty_antes` correcto para cada item:
  - Primer item: `qty_antes=10`, `qty_despues=5`
  - Segundo item: `qty_antes=5`, `qty_despues=2`
- [ ] Venta de un solo color sigue funcionando igual

---

## Orden de ejecución

1. Tarea 1 (C3 validación) — independiente
2. Tarea 2 (C1 select id) — debe ir antes de Tarea 3
3. Tarea 3 (C1 coloresActuales) — depende de Tarea 2
4. Tarea 4 (C2 mutate) — independiente

Tareas 1 y 2+3 pueden ejecutarse en paralelo. Tarea 4 en paralelo con ambas.

---

## Verificación final

Después de aplicar todos los fixes, ejecutar build:
```bash
node node_modules/next/dist/bin/next build
```
Debe compilar sin errores TypeScript.
