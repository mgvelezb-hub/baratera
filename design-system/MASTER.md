# Design System: Baratera OS
*Papelería La Más Baratera — Sistema de Gestión Multicanal*
*Generated: 2026-05-22 | ui-ux-pro-max*

---

## Design Philosophy

**Operational Clarity First.** Cada interfaz tiene un trabajo específico. La dueña necesita ver alertas y actuar. El cajero necesita cobrar rápido. El cliente necesita comprar sin fricción. El diseño sirve a la operación — no al contrario.

**Tres modos de interfaz:**
1. **Operacional** (Dashboard + WMS + OMS) — data-dense, dark mode opcional, información densa pero ordenada
2. **Transaccional** (POS) — touch-first, alto contraste, flujo lineal sin distracciones
3. **Público** (WebApp) — mobile-first, flat design, orientado a conversión

---

## Color System

### Paleta de módulos (del HTML spec — preservar)

| Módulo | Token | 50 (bg) | 200 (accent) | 600 (text) | 800 (dark) |
|--------|-------|---------|-------------|-----------|-----------|
| WMS | `--p` | `#EEEDFE` | `#AFA9EC` | `#534AB7` | `#3C3489` |
| OMS | `--t` | `#E1F5EE` | `#5DCAA5` | `#0F6E56` | `#085041` |
| POS | `--a` | `#FAEEDA` | `#EF9F27` | `#854F0B` | `#633806` |
| WebApp | `--t` | `#E1F5EE` | `#5DCAA5` | `#0F6E56` | `#085041` |
| Chatbot | `--b` | `#E6F1FB` | `#85B7EB` | `#185FA5` | `#0C447C` |
| CRM | `--pk` | `#FBEAF0` | `#ED93B1` | `#993556` | `#72243E` |
| Dashboard | `--b` | `#E6F1FB` | `#85B7EB` | `#185FA5` | `#0C447C` |

### Paleta semántica global

| Rol | Hex | Uso |
|-----|-----|-----|
| `--color-success` | `#0F6E56` | Stock OK, pedido completado, pago confirmado |
| `--color-warning` | `#854F0B` | Stock bajo (amarillo), descuento pendiente |
| `--color-danger` | `#DC2626` | Stock rojo, PIN inválido, alerta crítica |
| `--color-info` | `#185FA5` | Pedidos nuevos, notificaciones, chat |
| `--color-neutral-bg` | `#F8FAFC` | Background de páginas (modo claro) |
| `--color-neutral-900` | `#0F172A` | Texto principal |
| `--color-neutral-600` | `#475569` | Texto secundario / muted |
| `--color-neutral-200` | `#E2E8F0` | Borders, separadores |
| `--color-surface` | `#FFFFFF` | Cards, modales |

### Dashboard dark mode

| Rol | Hex |
|-----|-----|
| `--dark-bg` | `#020617` |
| `--dark-surface` | `#0F172A` |
| `--dark-surface-2` | `#1E293B` |
| `--dark-text` | `#F8FAFC` |
| `--dark-muted` | `#94A3B8` |
| `--dark-border` | `#334155` |
| `--dark-success` | `#22C55E` |

---

## Typography

### Sistema tipográfico por interfaz

| Interfaz | Heading | Body | Razón |
|----------|---------|------|-------|
| Dashboard/Admin | `Inter` | `Inter` | Máxima legibilidad de datos, monospace números |
| POS | `Inter` | `Inter` | Claridad en touch, sin serifa, rápido de leer |
| WebApp público | `Rubik` | `Nunito Sans` | Friendly + retail, conversión, amigable |

### Escalas tipográficas

```css
/* Admin/POS (Inter) */
--text-xs:   0.75rem;   /* 12px — chips, labels, timestamps */
--text-sm:   0.875rem;  /* 14px — tabla, meta texto */
--text-base: 1rem;      /* 16px — body text (mínimo móvil) */
--text-lg:   1.125rem;  /* 18px — títulos de sección */
--text-xl:   1.25rem;   /* 20px — KPI numbers */
--text-2xl:  1.5rem;    /* 24px — page titles */
--text-3xl:  1.875rem;  /* 30px — KPI grandes */

/* WebApp (Rubik headings / Nunito Sans body) */
--heading-sm:  1.25rem;  /* 20px — card titles */
--heading-md:  1.5rem;   /* 24px — section headers */
--heading-lg:  2rem;     /* 32px — hero */
--body-price:  1.5rem;   /* 24px — precio prominente */
```

### Google Fonts Import

```css
/* Admin/Dashboard/POS */
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap');

/* WebApp pública */
@import url('https://fonts.googleapis.com/css2?family=Nunito+Sans:wght@300;400;500;600;700&family=Rubik:wght@300;400;500;600;700&display=swap');
```

---

## Spacing & Layout

```css
/* Base: 4px grid */
--space-1:  0.25rem;   /*  4px */
--space-2:  0.5rem;    /*  8px */
--space-3:  0.75rem;   /* 12px */
--space-4:  1rem;      /* 16px */
--space-5:  1.25rem;   /* 20px */
--space-6:  1.5rem;    /* 24px */
--space-8:  2rem;      /* 32px */
--space-10: 2.5rem;    /* 40px */

/* Border radius */
--radius-sm: 4px;     /* chips, badges */
--radius-md: 8px;     /* cards, botones */
--radius-lg: 12px;    /* modales, sidebars */
--radius-xl: 16px;    /* drawers */
--radius-full: 9999px; /* pills, avatares */
```

### Breakpoints

| Nombre | Width | Uso |
|--------|-------|-----|
| `sm` | 375px | iPhone SE — mínimo móvil |
| `md` | 768px | iPad / tablet |
| `lg` | 1024px | Laptop / POS desktop |
| `xl` | 1280px | Dashboard fullscreen |
| `2xl` | 1440px | Large display |

---

## Component Patterns

### KPI Card (Dashboard)

```
┌─────────────────────────────────────┐
│ 📦 Ventas hoy          [⚠ 3 alertas] │
│                                      │
│  $4,280 MXN                         │
│  ↑ 12% vs ayer                      │
│                                      │
│  POS $2,100 · WA $1,600 · Web $580  │
└─────────────────────────────────────┘
```
- Altura fija: `h-32` (128px)
- Número principal: `text-3xl font-bold`
- Desglose por canal: `text-xs text-muted`
- Hover: `shadow-md` + `cursor-pointer`

### Stock Semáforo Row (WMS/Dashboard)

```
● Cuaderno Profesional    12 uds    mín 10    +2 días
● Plumas Bic Azul          3 uds    mín 15    +5 días   [Crear PO]
● Corrector Pelikan       18 uds    mín 8     +1 día
```
- Verde: `bg-emerald-500` — stock > mínimo × 1.5
- Amarillo: `bg-amber-400` — entre mínimo y mínimo × 1.5
- Rojo: `bg-red-500` — stock < mínimo → fila con `bg-red-50`

### Chip de Canal

```html
<!-- Estilos por canal -->
<span class="chip-wa">WA</span>      <!-- verde teal -->
<span class="chip-tiktok">TikTok</span> <!-- negro -->
<span class="chip-pos">POS</span>    <!-- amber -->
<span class="chip-web">Web</span>    <!-- blue -->
<span class="chip-tel">Tel</span>    <!-- gray -->
```

### Botón de acción primario

```css
/* Tamaño mínimo touch 44×44px */
.btn-primary {
  min-height: 44px;
  min-width: 44px;
  padding: 0 16px;
  border-radius: var(--radius-md);
  font-weight: 600;
  cursor: pointer;
  transition: all 150ms ease;
}
```

### Alert Feed Item

```
[●] CRÍTICO · descuento_no_auth · hace 2 min
    Cajero intentó aplicar 15% sin PIN válido
    Importe: $340 · Cajero: María G.
    [Resolver] [Ver en POS]
```
- `critical`: borde rojo `border-red-500`, bg `bg-red-50`
- `warning`: borde amber `border-amber-400`, bg `bg-amber-50`

---

## Iconografía

**Librería:** [Lucide React](https://lucide.dev/) — SVG, 24×24px base

| Módulo | Ícono | Lucide name |
|--------|-------|-------------|
| WMS/Stock | 📦 | `Package` |
| OMS/Pedidos | 🛍️ | `ShoppingBag` |
| POS/Caja | 💰 | `CashRegister` / `Receipt` |
| WebApp/Tienda | 🌐 | `Globe` |
| Chatbot/WA | 💬 | `MessageCircle` |
| CRM/Clientes | 👥 | `Users` |
| Dashboard | 📊 | `LayoutDashboard` |
| Alerta | ⚠️ | `AlertTriangle` |
| Stock verde | ✅ | `CheckCircle2` |
| Stock rojo | 🔴 | `AlertCircle` |

**Regla:** Nunca usar emojis como íconos en UI — solo SVG de Lucide.

---

## Animaciones & Micro-interacciones

```css
/* Transiciones base */
--transition-fast: 150ms ease;       /* hover states, color changes */
--transition-normal: 250ms ease;     /* modales, drawers */
--transition-slow: 350ms ease;       /* page transitions */

/* Respeto a prefers-reduced-motion */
@media (prefers-reduced-motion: reduce) {
  * { animation-duration: 0.01ms !important; transition-duration: 0.01ms !important; }
}
```

**Micro-interacciones específicas:**
- Número de KPI actualizado: fade-in de 200ms (Realtime)
- Alerta nueva: slide-in desde la derecha, 250ms
- Stock cambia de color: transición de 300ms en el semáforo
- Botón loading: spinner reemplaza el texto, ancho fijo
- Corte de caja aprobado: animación de check verde

---

## UX Reglas Críticas

### Touch & Mobile (CRÍTICO)
- Mínimo `44×44px` en todos los targets táctiles
- `gap-2` mínimo entre botones adyacentes
- `touch-action: manipulation` en todos los botones
- `overscroll-behavior: contain` en listas largas
- `cursor-pointer` en todos los elementos clickeables

### Accesibilidad (CRÍTICO)
- Contraste mínimo `4.5:1` para texto normal
- `aria-label` en todos los botones de solo ícono
- `focus-visible` visible en todos los interactivos
- Semáforo de stock: nunca usar solo color — agregar texto (verde/amarillo/rojo)

### Feedback de estado
- Botón durante operación async: deshabilitar + mostrar spinner
- Error de validación: mensaje DEBAJO del campo, nunca en toast global
- Éxito de venta en POS: feedback visual obvio (verde, sonido opcional)
- Timeout de WebSocket: mostrar "Sin conexión" en banner, no en console

### Z-Index Scale
```css
--z-dropdown: 10;
--z-sticky: 20;
--z-overlay: 30;
--z-modal: 40;
--z-notification: 50;
--z-toast: 60;
```

---

## Charts & Datos (Recharts)

| Dato | Chart type | Razón |
|------|-----------|-------|
| Ventas por canal (hoy) | Bar horizontal | Comparación categórica, móvil-friendly |
| Tendencia de ventas (7 días) | Area chart | Tendencia + volumen |
| Stock por SKU | Bullet chart / barra | Actual vs mínimo |
| Pedidos por estado | Donut | Distribución rápida |

**Colores de charts:** usar paleta de módulos por canal (teal=OMS, amber=POS, etc.)

---

## Checklist Pre-Entrega (cada módulo)

### Visual
- [ ] Sin emojis como íconos (usar Lucide SVG)
- [ ] Hover states sin layout shift
- [ ] Colores de módulo correctos (tokens CSS)
- [ ] Contraste texto ≥ 4.5:1

### Interacción
- [ ] `cursor-pointer` en todos los clickeables
- [ ] `min-h-[44px]` en todos los botones
- [ ] Botones deshabilitados durante async
- [ ] `touch-action: manipulation` en botones POS

### Responsive
- [ ] Funciona en 375px (iPhone SE)
- [ ] No hay scroll horizontal en móvil
- [ ] Tablas con scroll horizontal contenido si necesario
- [ ] Navegación no tapa el contenido

### Realtime (Dashboard/WebApp/WMS)
- [ ] Loading skeleton mientras carga Realtime
- [ ] Indicador "Sin conexión" si WebSocket cae
- [ ] Datos no saltan de posición al actualizarse

---

*Design System generado: 2026-05-22*
*Herramienta: ui-ux-pro-max | Proyecto: Baratera OS*
