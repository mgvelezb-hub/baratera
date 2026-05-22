# Baratera OS — Papelería La Más Baratera

## What This Is

Sistema de gestión multicanal para Papelería La Más Baratera — integra inventario (WMS), pedidos (OMS), punto de venta físico (POS), tienda online (WebApp), chatbot de ventas (WhatsApp + TikTok), CRM con promociones automáticas y dashboard de control. La dueña opera todo desde su celular sin depender de Excel ni estar físicamente en el local.

## Core Value

La dueña ve en tiempo real cuánto hay en stock, cuánto se vendió y por qué canal, y recibe alertas automáticas en WhatsApp antes de que algo salga mal.

## Requirements

### Validated

(None yet — ship to validate)

### Active

**Fundación (Phase 1)**
- [ ] Auth con roles (dueña / cajero / operador)
- [ ] Schema completo en Supabase (stock, pedidos, clientes, canales)
- [ ] API base Node.js + Express

**WMS — Almacén (Phase 2)**
- [ ] Stock ledger append-only
- [ ] stock_disponible en tiempo real
- [ ] Punto de reorden + alertas WA
- [ ] Recepción de mercancía con validación vs PO
- [ ] Semáforo verde/amarillo/rojo por SKU
- [ ] Historial de precios inmutable

**OMS — Pedidos (Phase 3)**
- [ ] Ciclo de vida completo de pedido
- [ ] Reserva atómica de stock (transacción SQL)
- [ ] Pricing engine mayoreo/menudeo/promo
- [ ] Routing CDMX vs foráneo
- [ ] Cancelación automática tras 24hrs sin pago
- [ ] Canal_origen en cada pedido
- [ ] Notificación WA a dueña por pedido foráneo

**POS — Punto de venta físico (Phase 4)**
- [ ] Interfaz web Chrome con búsqueda + barcode
- [ ] Precio automático por cantidad
- [ ] Descuento con PIN + alerta si inválido
- [ ] Registro de venta en ledger + ventas_pos
- [ ] Impresión de ticket Epson ESC/POS
- [ ] Corte de caja con comparación real vs esperado
- [ ] Campo teléfono opcional para CRM
- [ ] PWA offline (Service Worker + IndexedDB)

**WebApp — Tienda online (Phase 5)**
- [ ] Catálogo público con badge de stock en tiempo real
- [ ] Precio dinámico mayoreo en carrito
- [ ] Checkout con tipo_entrega + dirección si foráneo
- [ ] Confirmación WA al cliente + notificación a dueña
- [ ] Supabase Realtime para badges sin F5
- [ ] SEO + Open Graph para TikTok/WA
- [ ] Mobile-first

**Chatbot — WhatsApp + TikTok (Phase 6)**
- [ ] Motor de intención capa 1 (regex + keywords)
- [ ] Motor de intención capa 2 (GPT-4o mini fallback)
- [ ] Validación de disponibilidad antes de confirmar
- [ ] Slot-filling para capturar pedido completo
- [ ] Identificación de cliente por teléfono
- [ ] Edge case TikTok (no sigue = respuesta en comentario)
- [ ] Fallback manual → alerta WA a dueña
- [ ] Log de conversaciones
- [ ] Webhook 200 OK < 5s + procesamiento asíncrono

**CRM — Clientes y Promociones (Phase 7)**
- [ ] Teléfono como clave única universal (todos los canales)
- [ ] Perfil completo con LTV, historial, canal preferido
- [ ] Motor de reglas ejecutado en cada compra
- [ ] Reglas configurables desde dashboard sin código
- [ ] Consulta de promoción activa en cada sesión chatbot
- [ ] Reactivación automática de clientes inactivos
- [ ] Broadcast segmentado con rate limit Meta
- [ ] Vista de cliente con timeline por canal

**Dashboard + Alertas (Phase 8)**
- [ ] Header KPIs: ventas_hoy + desglose por canal + alertas activas
- [ ] Tabla de stock con semáforo y botón crear PO
- [ ] OMS embed con filtros y cambio de estado
- [ ] Feed de alertas en tiempo real (tipo + severidad + resolver)
- [ ] Panel CCTV iframe Hikvision
- [ ] CRM quick view + broadcast
- [ ] Mobile-first PWA con push notifications
- [ ] Supabase Realtime en todas las secciones

### Out of Scope

- Facturación CFDI/SAT — complejidad fiscal fuera de v1
- App nativa iOS/Android — WebApp + PWA son suficientes para el 90% del uso
- Multi-sucursal — negocio de una sola ubicación en v1
- Integración con POS existente — sistema nuevo desde cero
- Pasarela de pago en línea (Stripe/MercadoPago) — pago por transferencia en v1
- Reportes avanzados PDF/Excel — los datos estarán en DB para exportar en v2

## Context

- **Negocio:** Papelería física con ventas en local + WhatsApp + TikTok + futura tienda online
- **Escala:** ~50 SKUs, operación de 1-3 personas (dueña + cajero(s))
- **Canales actuales:** WhatsApp manual, TikTok Shop (sin sistema), POS en papel o Excel
- **Problema principal:** Sin visibilidad de inventario, sin historial de clientes, sin alertas de stock bajo
- **Prioridad de la dueña:** Control de caja y alertas en tiempo real desde el celular
- **Clientes:** Mezcla de mayoristas y menudeo; teléfono es la identidad universal
- **Envíos:** CDMX (entrega local) + foráneo (paquetería con dirección)

## Constraints

- **Tech Stack:** Supabase (PostgreSQL + Realtime + Auth) — serverless, sin admin de servidor
- **Frontend:** Next.js 14 App Router (WebApp + Dashboard) + React Vite PWA (POS)
- **Backend:** Node.js + Express API en Vercel Functions o Railway
- **Messaging:** Meta WhatsApp Business API + TikTok Business API v2 (requiere cuentas verificadas)
- **Async:** Bull Queue + Redis (upstash o Railway) para webhooks y crons
- **AI:** OpenAI GPT-4o mini solo como fallback de chatbot (~$0.001/mensaje)
- **Dinero:** DECIMAL(12,2) en DB, cálculos en centavos — nunca Float
- **Offline:** POS debe funcionar sin internet con sincronización posterior
- **Seguridad:** PINs hasheados, no almacenar en texto plano; JWT HttpOnly cookies

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Supabase vs Postgres propio | Supabase da Realtime + Auth + Row Level Security out of the box | — Pending |
| Monorepo vs multi-repo | Código compartido (types, utils) + deployment simplificado | — Pending |
| Bull Queue para webhooks | Webhooks Meta/TikTok requieren 200 OK < 5s; procesamiento asíncrono | — Pending |
| Teléfono como clave universal | Cliente que compra por WA, TikTok y POS es el mismo registro | — Pending |
| Stock ledger append-only | Nunca editar/borrar — solo agregar movimientos (como ERPNext) | — Pending |

---
*Last updated: 2026-05-22 after initialization from modulos_completos_todos.html*

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd-transition`):
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `/gsd-complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state
