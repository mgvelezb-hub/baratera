# WebApp — Page-Specific Design Overrides
*Overrides MASTER.md — solo aplican a la tienda pública /catalogo*

## Contexto
Clientes llegan desde link compartido en WhatsApp o TikTok. 90%+ en móvil. Primera impresión = tarjeta del producto. Objetivo: ver precio, stock, y comprar en < 3 taps.

## Tipografía Override
- Heading: `Rubik` — friendly, retail, legible en móvil
- Body: `Nunito Sans` — warm, accesible, conversacional
- Precio: `Rubik text-2xl font-bold` — prominent
- Precio mayoreo activo: `text-green-700 text-xl font-bold` + badge "PRECIO MAYOREO"

## Product Card

```
┌────────────────────────────┐
│  [foto 1:1, lazy load]     │
│  ● Disponible              │ ← badge stock
├────────────────────────────┤
│  Cuaderno Profesional 100h │
│  $25.00 MXN                │
│  ┌──────────────────┐      │
│  │  − 1 +  Agregar  │      │
│  └──────────────────┘      │
└────────────────────────────┘
```

### Badge de Stock
| Estado | Color | Texto |
|--------|-------|-------|
| Disponible (> min×1.5) | `bg-green-100 text-green-700` | "Disponible" |
| Últimas N unidades | `bg-amber-100 text-amber-700` | "Últimas 3 unidades" |
| Sin stock | `bg-red-100 text-red-700` | "Sin stock · llega ~15 jun" |

## Precio Dinámico en Carrito

```
┌──────────────────────────────────────────┐
│  Plumas Bic Azul                         │
│  × 12 unidades                           │
│                                          │
│  ~~$6.00 c/u~~  →  $4.50 c/u  MAYOREO   │
│                          ↑ badge verde   │
│  Subtotal: $54.00 MXN                    │
└──────────────────────────────────────────┘
```
- Badge `MAYOREO`: `bg-green-500 text-white rounded-full text-xs px-2`
- Precio anterior tachado: `line-through text-neutral-400`

## Checkout Flow (3 pasos)

```
[1 Datos] → [2 Entrega] → [3 Confirmar]
```

**Paso 2 — Tipo de entrega:**
```
○ CDMX — Recojo en local / entrega local
  (sin campos adicionales)

○ Foráneo — Envío por paquetería
  Dirección de envío: [campo obligatorio]
  Estado / Ciudad: [selector]
  Fecha estimada: aprox. 3-5 días hábiles
```

## SEO / Open Graph

Cada página `/catalogo/[slug]` debe tener:
```html
<meta property="og:title" content="Cuaderno 100h - Papelería La Más Baratera" />
<meta property="og:image" content="[foto del producto]" />
<meta property="og:description" content="$25.00 MXN · Disponible · Envío a todo México" />
<meta property="og:url" content="https://baratera.mx/catalogo/cuaderno-100h" />
```
- Imagen OG: 1200×630px, producto centrado con fondo neutro

## Anti-patterns para WebApp
- No infinite scroll en catálogo — paginación con "Ver más" funciona mejor en móvil con links compartidos
- No mostrar precio mayoreo en listado — solo en detalle/carrito cuando aplique
- No formulario de registro obligatorio — checkout como invitado (teléfono = identidad)
- No spinner de página completa para cargar más productos — skeleton cards
