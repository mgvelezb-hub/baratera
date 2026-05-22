@AGENTS.md
# Baratera OS — CLAUDE.md

## Proyecto

Sistema de gestión multicanal para Papelería La Más Baratera. Integra WMS, OMS, POS físico, tienda online (WebApp), chatbot WhatsApp + TikTok, CRM con promociones automáticas, y dashboard de control.

## Stack

- **DB:** Supabase PostgreSQL + Realtime + Auth (Row Level Security por rol)
- **API:** Node.js + Express (Vercel Functions o Railway)
- **WebApp/Dashboard:** Next.js 14 App Router + Tailwind CSS + Recharts
- **POS:** React + Vite (PWA, Service Worker, IndexedDB)
- **Async:** Bull Queue + Redis (Upstash)
- **Chatbot:** Meta WA Business API + TikTok Business API v2 + OpenAI GPT-4o mini (fallback)
- **Deploy:** Vercel (WebApp/Dashboard)
- **Dinero:** DECIMAL(12,2) en DB, cálculos en centavos — nunca Float
- **Auth:** Supabase Auth + JWT + HttpOnly cookie

## Reglas Críticas del Schema

- **Stock ledger:** `stock_ledger` es append-only — NUNCA editar ni eliminar registros; solo INSERT
- **stock_disponible:** siempre calculado = stock_fisico − SUM(reservas WHERE estado='pendiente') — nunca columna estática
- **Reserva atómica:** `BEGIN → verificar stock → restar stock_disponible → crear pedido → COMMIT`; si falla cualquier paso → `ROLLBACK` total
- **Cliente universal:** `telefono` es la clave única de cliente en todos los canales (WMS/OMS/POS/WebApp/Chatbot)
- **canal_origen:** ENUM obligatorio en cada pedido: `wa | tiktok | webapp | pos | telefono`
- **Roles:** `duena` (admin total) | `cajero` (solo POS) | `operador` (OMS + WMS)

## Estado actual del desarrollo

### Fase 1 — WMS MVP (activa)
- `/inventario` — lista de productos con semáforo de stock
- `/inventario/[id]` — detalle + historial de movimientos
- Modales: agregar producto, levantar inventario, movimiento manual
- Schema: `productos` + `stock_ledger` en Supabase
- Deploy: Vercel

### Próximas fases
Ver `.planning/ROADMAP.md` para las 8 fases completas.

## GSD Workflow

- Modo: YOLO (auto-aprobar)
- Granularidad: Standard
- Ejecución: Paralela

## Vocabulario del negocio

- "Mayoreo" = venta al por mayor (precio especial por cantidad)
- "Menudeo" = venta unitaria (precio regular)
- "Dueña" = administradora con acceso total
- "Cajero" = empleado de mostrador
- "Foráneo" = pedido de fuera de CDMX (requiere envío)
- "CDMX" = pedido local
- "SKU" = producto individual en inventario
- "PO" = Purchase Order (orden de compra a proveedor)
- "Corte de caja" = cierre de turno con conteo de efectivo
