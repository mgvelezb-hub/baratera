# POS — Page-Specific Design Overrides
*Overrides MASTER.md — solo aplican a la interfaz de Punto de Venta*

## Contexto
Interfaz en Chrome del local, usada por cajeros en PC de escritorio con pantalla táctil opcional. Opera offline. Flujo lineal: buscar → agregar → cobrar.

## Color Override

```css
/* POS usa paleta amber prominente */
--pos-primary: #854F0B;      /* --a600 */
--pos-accent: #EF9F27;       /* --a200 */
--pos-bg-header: #FAEEDA;    /* --a50 */

/* Precio mayoreo — diferenciador visual fuerte */
--pos-mayoreo: #0F6E56;      /* verde teal — "precio especial activo" */
--pos-mayoreo-bg: #E1F5EE;
```

## Layout

- **Full viewport** sin sidebar — máxima área de trabajo para el cajero
- **Split 60/40:** búsqueda + catálogo (60%) | carrito + cobro (40%)
- En pantalla < 1024px: tabs "Buscar" / "Carrito" alternables
- Botón "COBRAR" siempre visible, esquina inferior derecha, `h-16 w-full`

## Tipografía Override

- Precios en carrito: `text-2xl font-bold` — legibles de un vistazo
- Nombre de producto: `text-base font-medium` — claro en lista larga
- Precio mayoreo: `text-lg font-bold text-green-700` + badge "MAYOREO"

## Touch & Teclado

- Botón "COBRAR": `min-h-[64px]` — más grande que el estándar 44px
- Fila de producto en carrito: `min-h-[56px]` — fácil de tocar para eliminar
- Campo de búsqueda: siempre enfocado al entrar a la vista
- Tecla Enter en campo barcode: agrega producto al carrito

## Feedback Modal — PIN de Descuento

```
┌──────────────────────────────┐
│   🔒 PIN de Autorización     │
│                              │
│   ● ● ● ●  (4 dígitos)      │
│                              │
│   [1][2][3]                  │
│   [4][5][6]  numpad          │
│   [7][8][9]                  │
│      [0]                     │
│                              │
│         [Cancelar]           │
└──────────────────────────────┘
```
- Error de PIN: shake animation + borde rojo + borrar campos
- 3 intentos fallidos: bloquear 5 min + alerta WA inmediata

## Corte de Caja Modal

```
┌──────────────────────────────────────┐
│  Cerrar Turno — María G.             │
│                                      │
│  Sistema esperaba:   $4,280.00       │
│  Tú contaste:        [ $_______ ]    │
│                                      │
│  Diferencia:         —               │
│                                      │
│  [Cancelar]        [Confirmar cierre]│
└──────────────────────────────────────┘
```
- Diferencia se muestra en rojo si negativa, verde si positiva
- Si |diferencia| > umbral configurable → alerta WA antes de confirmar

## PWA Offline Banner

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 ⚠ Sin conexión — Modo offline activo   
 Las ventas se sincronizarán al reconectar
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```
- Fondo: `bg-amber-100 border-amber-400`
- Fijo en top, sin ocultar contenido crítico

## Anti-patterns para POS
- No usar modales para confirmaciones simples (ej: "¿Seguro que quieres eliminar?") — usar undo en línea
- No mostrar más de 1 CTA principal visible al mismo tiempo
- No requerir scroll para llegar al botón "COBRAR"
