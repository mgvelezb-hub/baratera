# Roadmap: Baratera OS

**8 phases** | **52 requirements mapped** | All v1 requirements covered ✓

| # | Phase | Goal | Requirements | Success Criteria |
|---|-------|------|--------------|-----------------|
| 1 | Fundación | Schema, auth, API base | AUTH-01..04 | 4 |
| 2 | WMS Core | Inventario + ledger + semáforo | WMS-01..06 | 5 |
| 3 | OMS Core | Ciclo de pedidos + reserva atómica | OMS-01..07 | 5 |
| 4 | POS | Punto de venta físico + PWA offline | POS-01..08 | 6 |
| 5 | WebApp | Tienda online + Realtime | WEBAPP-01..07 | 5 |
| 6 | Chatbot | WhatsApp + TikTok automatizado | CHAT-01..09 | 6 |
| 7 | CRM | Clientes + promociones automáticas | CRM-01..08 | 5 |
| 8 | Dashboard | Control central + alertas en tiempo real | DASH-01..08 | 6 |

---

## Phase 1: Fundación

**Goal:** Schema completo en Supabase, autenticación con 3 roles, y API base Node.js lista para servir los módulos siguientes.

**Requirements:** AUTH-01, AUTH-02, AUTH-03, AUTH-04

**Success criteria:**
1. Dueña puede iniciar sesión y llegar al dashboard protegido
2. Cajero puede iniciar sesión y solo accede a rutas POS
3. Schema de Supabase tiene tablas: productos, stock_ledger, pedidos, clientes, ventas_pos, conversaciones, alertas, promociones_reglas, promociones_activas
4. API base responde GET /health con 200 OK

**Tech stack:**
- Supabase PostgreSQL (schema + migraciones)
- Supabase Auth (JWT + HttpOnly cookie)
- Node.js + Express (API)
- Prisma o Supabase client para queries

**UI hint:** no (auth screens only)

---

## Phase 2: WMS — Almacén y Stock

**Goal:** Sistema de inventario con ledger inmutable, cálculo de stock en tiempo real, alertas de reorden y dashboard semáforo.

**Requirements:** WMS-01, WMS-02, WMS-03, WMS-04, WMS-05, WMS-06

**Success criteria:**
1. Cada movimiento de stock crea un registro en stock_ledger y nunca se modifica
2. stock_disponible mostrado en pantalla se recalcula y coincide con la fórmula (stock_fisico − reservas_pendientes)
3. Cuando stock_disponible cae por debajo del mínimo, llega WA a dueña y aparece borrador de PO en el sistema
4. Tabla de stock muestra semáforo correcto (verde/amarillo/rojo) para cada SKU
5. Historial de precios registra cada cambio con usuario y timestamp

**Tech stack:**
- Supabase PostgreSQL (stock_ledger append-only)
- Supabase Realtime (suscripción en tabla productos)
- Node.js API (endpoints de movimientos, recepción, reorden)
- React dashboard (semáforo, historial)

**UI hint:** yes

---

## Phase 3: OMS — Gestión de Pedidos

**Goal:** Ciclo de vida completo de pedidos con reserva atómica, pricing engine mayoreo/menudeo, routing CDMX/foráneo, y notificaciones automáticas.

**Requirements:** OMS-01, OMS-02, OMS-03, OMS-04, OMS-05, OMS-06, OMS-07

**Success criteria:**
1. Crear pedido cuando hay stock disponible reserva el stock y crea el pedido en una sola transacción SQL
2. Crear pedido cuando no hay stock suficiente hace rollback y devuelve error con stock actual
3. Cliente mayorista recibe precio mayoreo automáticamente al superar el umbral de cantidad
4. Pedido foráneo exige dirección y calcula fecha estimada; pedido CDMX no exige dirección
5. Pedido en estado 'nuevo' sin pago tras 24hrs se cancela automáticamente y el stock se libera

**Tech stack:**
- PostgreSQL transactions (BEGIN/COMMIT)
- Node.js + Express (pricing engine, ciclo de vida)
- Supabase Realtime (tabla pedidos en vivo)
- Bull Queue (cron job de cancelación automática)

**UI hint:** yes

---

## Phase 4: POS — Punto de Venta Físico

**Goal:** Aplicación web para el local que funciona offline, con búsqueda de producto, precios automáticos, PIN de descuento, corte de caja y ticket impreso.

**Requirements:** POS-01, POS-02, POS-03, POS-04, POS-05, POS-06, POS-07, POS-08

**Success criteria:**
1. Cajero puede buscar un producto por nombre y agregarlo al carrito desde Chrome
2. Precio cambia a mayoreo automáticamente cuando la cantidad supera el umbral, sin que el cajero haga nada
3. Intentar aplicar descuento con PIN inválido envía WA a dueña y bloquea el descuento
4. Completar venta descuenta el stock en ledger y crea registro en ventas_pos
5. Botón "imprimir ticket" envía comando ESC/POS a la impresora Epson
6. Si internet se cae, el POS sigue funcionando y sincroniza las ventas al reconectarse

**Tech stack:**
- React + Vite (PWA, mobile/desktop)
- Service Worker (offline)
- IndexedDB (cache local de catálogo + ventas pendientes)
- Web Serial API (barcode scanner)
- Print.js (ticket ESC/POS)

**UI hint:** yes

---

## Phase 5: WebApp — Tienda Online

**Goal:** Tienda pública mobile-first con catálogo en tiempo real, checkout, confirmación por WhatsApp y SEO para links en TikTok/WA.

**Requirements:** WEBAPP-01, WEBAPP-02, WEBAPP-03, WEBAPP-04, WEBAPP-05, WEBAPP-06, WEBAPP-07

**Success criteria:**
1. Catálogo muestra badge de stock correcto para cada SKU y se actualiza en tiempo real sin recargar
2. Al agregar 10+ unidades de un SKU con umbral mayoreo, el precio cambia a mayoreo con indicador visual
3. Checkout de pedido foráneo exige dirección y calcula fecha estimada
4. Al confirmar pedido, el cliente recibe WA de confirmación en el número que ingresó
5. Link compartido en WhatsApp o TikTok muestra imagen y precio del producto (Open Graph)

**Tech stack:**
- Next.js 14 App Router (SSR + ISR para SEO)
- Tailwind CSS (mobile-first)
- Supabase Realtime (badges de stock)
- Vercel (deploy + CDN México)

**UI hint:** yes

---

## Phase 6: Chatbot — WhatsApp + TikTok

**Goal:** Chatbot multicanal que detecta intenciones, maneja conversaciones con slot-filling, valida stock en tiempo real y escala a atención manual automáticamente.

**Requirements:** CHAT-01, CHAT-02, CHAT-03, CHAT-04, CHAT-05, CHAT-06, CHAT-07, CHAT-08, CHAT-09

**Success criteria:**
1. Cliente puede pedir un producto por WhatsApp y el bot captura SKU + cantidad + nombre + dirección sin perder el hilo
2. Bot verifica disponibilidad antes de confirmar y comunica fecha estimada si no hay stock
3. Mensaje llega al webhook, el sistema responde 200 OK en <5s, y el mensaje se procesa correctamente
4. Cliente de TikTok que no sigue la cuenta recibe respuesta en comentario con número de WhatsApp
5. Si bot no reconoce la intención 2 veces, la dueña recibe WA con nombre del cliente para atención manual

**Tech stack:**
- Meta WhatsApp Business API (webhook)
- TikTok Business API v2 (comentarios)
- Bull Queue + Redis (mensajes asíncronos)
- OpenAI GPT-4o mini (fallback de intent)
- Supabase (log de conversaciones)

**UI hint:** no (backend + webhooks)

---

## Phase 7: CRM — Clientes y Promociones

**Goal:** Sistema de clientes unificado por teléfono con motor de reglas de promociones automáticas, reactivación y broadcast segmentado.

**Requirements:** CRM-01, CRM-02, CRM-03, CRM-04, CRM-05, CRM-06, CRM-07, CRM-08

**Success criteria:**
1. Cliente que compra por WA, POS y WebApp tiene el mismo registro en la DB identificado por teléfono
2. Motor de reglas aplica promoción automáticamente cuando cliente cumple la condición configurada
3. Chatbot incluye promoción activa del cliente en cada cotización sin intervención manual
4. Dueña crea una regla de promoción desde el dashboard y queda activa para nuevas compras
5. Cron de 9am envía WA de reactivación a clientes inactivos con más de N días sin comprar

**Tech stack:**
- Supabase DB + triggers (motor de reglas)
- Node cron (node-cron)
- Meta WA API (broadcast)
- Bull Queue (batch de envíos con rate limit)

**UI hint:** yes

---

## Phase 8: Dashboard — Control Central

**Goal:** Dashboard mobile-first con KPIs en tiempo real, feed de alertas accionables, OMS embed, tabla de stock semáforo, panel CCTV y notificaciones push.

**Requirements:** DASH-01, DASH-02, DASH-03, DASH-04, DASH-05, DASH-06, DASH-07, DASH-08

**Success criteria:**
1. Dashboard muestra ventas del día desglozadas por canal y se actualiza automáticamente
2. Alerta de descuento no autorizado aparece en el feed en menos de 10 segundos después del evento
3. Dueña puede cambiar estado de un pedido desde el dashboard en el móvil
4. Celular bloqueado recibe notificación push cuando llega alerta de tipo "critical"
5. Tabla de stock está ordenada por semáforo (rojos primero) y permite crear PO con un clic
6. Panel CCTV muestra el feed de cámaras del local sin salir del dashboard

**Tech stack:**
- Next.js App Router (ruta protegida /admin)
- Recharts (gráficas de ventas)
- Supabase Realtime subscriptions
- Web Push API (alertas críticas)
- Hikvision iframe API (CCTV)

**UI hint:** yes

---

*Roadmap created: 2026-05-22*
*Source: modulos_completos_todos.html — 7 módulos especificados*
