---
gsd_state_version: 1.0
milestone: v1.0
milestone_name: baratera-os-v1
status: ready_to_plan
stopped_at: Project initialized
last_updated: "2026-05-22"
last_activity: 2026-05-22 — Project initialized from modulos_completos_todos.html
progress:
  total_phases: 8
  completed_phases: 0
  total_plans: 0
  completed_plans: 0
  percent: 0
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-05-22)

**Core value:** La dueña ve en tiempo real cuánto hay en stock, cuánto se vendió y por qué canal, y recibe alertas automáticas en WhatsApp antes de que algo salga mal.
**Current focus:** Phase 1 — Fundación

## Current Position

Phase: 1 of 8 (fundacion)
Plan: Not started
Status: Ready to plan
Last activity: 2026-05-22

Progress: [░░░░░░░░░░] 0%

## Performance Metrics

**Velocity:**

- Total plans completed: 0
- Average duration: —
- Total execution time: 0 hours

## Accumulated Context

### Decisions

- Architecture: Supabase PostgreSQL + Realtime + Auth como base
- Monorepo: API Node.js + Next.js WebApp/Dashboard + React Vite POS
- Phase order: Fundación → WMS → OMS → POS → WebApp → Chatbot → CRM → Dashboard
- Async: Bull Queue + Redis para webhooks y crons
- Identity: Teléfono como clave universal de cliente en todos los canales
- Stock: Ledger append-only, nunca editar — solo agregar movimientos

### Pending Todos

- [ ] Crear proyecto en Supabase y obtener connection strings
- [ ] Verificar cuenta de WhatsApp Business API activa
- [ ] Confirmar dominio/URL para WebApp pública
- [ ] Revisar credenciales TikTok Business API

### Blockers/Concerns

- WhatsApp Business API requiere número verificado y cuenta Meta Business
- TikTok Business API v2 requiere cuenta de negocio verificada
- Impresora Epson requiere prueba física de compatibilidad ESC/POS

## Deferred Items

| Category | Item | Status | Deferred At |
|----------|------|--------|-------------|
| v2 | Pasarela de pago Stripe/MercadoPago | Pago por transferencia en v1 | Init |
| v2 | Exportación PDF/Excel | DB disponible para exportar en v2 | Init |
| v2 | Multi-sucursal | Una ubicación en v1 | Init |
| v2 | Facturación CFDI/SAT | Requiere integrador certificado | Init |
| v2 | Alertas de tendencias | Necesita histórico de al menos 4 semanas | Init |

## Session Continuity

Last session: initialization
Stopped at: Project initialized — ready to plan Phase 1
Resume file: Run `/gsd-discuss-phase 1` or `/gsd-plan-phase 1`
