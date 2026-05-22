# Dashboard — Page-Specific Design Overrides
*Overrides MASTER.md — solo aplican al Dashboard de control de la dueña*

## Contexto
La dueña opera desde el celular. Dark mode en interior del local. Actualización en tiempo real. Alertas críticas tienen prioridad visual máxima. No hay que hacer scroll para ver lo más importante.

## Layout Override

### Mobile (375px–767px) — Layout primario
```
┌──────────────────────────────┐
│  Baratera OS     [🔔 3]  [⚙] │
├──────────────────────────────┤
│  KPIs: $4,280 hoy | 7 pedidos│
│  POS $2.1k WA $1.6k Web $0.6k│
├──────────────────────────────┤
│  [Alertas (3)] [Stock] [OMS] │  ← tabs
├──────────────────────────────┤
│  ● CRÍTICO Descuento no auth │
│    Cajero María · $340 · 2min│
│    [Resolver]                │
│──────────────────────────────│
│  ● WARNING Stock rojo: Plumas│
│    3 uds restantes           │
│    [Crear PO]                │
└──────────────────────────────┘
```

### Desktop (1024px+) — Layout secundario
```
┌────────────────────────────────────────────────────────┐
│  KPI row: Ventas $4,280 | Canal breakdown | Alertas 3  │
├──────────────┬─────────────────┬───────────────────────┤
│  Stock (list)│  OMS (table)    │  Alertas feed (live)  │
│  semáforo    │  filterable     │  tipo+severidad+ts     │
│              │                 │                        │
├──────────────┴─────────────────┤                        │
│  CRM quick view                │                        │
│  Clientes nuevos · Top 5 mes   │                        │
└────────────────────────────────┴───────────────────────┘
```

## Dark Mode (default para dashboard)

```css
:root[data-theme="dark"] {
  --dash-bg: #020617;
  --dash-surface: #0F172A;
  --dash-surface-2: #1E293B;
  --dash-text: #F8FAFC;
  --dash-muted: #94A3B8;
  --dash-border: #334155;
}
```

**Regla:** Dashboard arranca en dark mode en móvil. Toggle en header para light mode.

## Alert Severities

```css
/* Critical */
.alert-critical {
  border-left: 4px solid #DC2626;
  background: rgba(220, 38, 38, 0.1);
}

/* Warning */
.alert-warning {
  border-left: 4px solid #F59E0B;
  background: rgba(245, 158, 11, 0.1);
}

/* Info */
.alert-info {
  border-left: 4px solid #3B82F6;
  background: rgba(59, 130, 246, 0.1);
}
```

## Realtime Indicators

- KPI number update: fade + scale 1.05 → 1 en 200ms
- Alerta nueva: slide-in desde derecha + vibración si móvil (`navigator.vibrate(50)`)
- Stock cambia a rojo: highlight row con bg-red-50/10 durante 2s
- Badge de alertas no leídas: `bg-red-500 text-white rounded-full text-xs`

## CCTV Panel

```
┌─────────────────────────────────────┐
│  Cámaras del local     [⛶ Fullscreen]│
│                                      │
│  [Hikvision iframe]                  │
│  cam1 / cam2 / cam3                  │
│                                      │
│  Última venta: hace 3 min            │
│  [Ver en grabación →]                │
└─────────────────────────────────────┘
```
- El link "Ver en grabación" abre el NVR en el timestamp de la última transacción
- iframe con `sandbox="allow-scripts allow-same-origin"` por seguridad

## Push Notifications

- Solo alertas de severidad `critical`
- Texto: `"[tipo] — [descripción breve]"` máx 60 chars
- Icono: logo de Baratera OS
- Vibración: `navigator.vibrate([200, 100, 200])`

## Anti-patterns para Dashboard
- No usar tablas de más de 6 columnas en móvil — colapsar en cards
- No paginación en feed de alertas — infinite scroll o "cargar más"
- No ocultar alertas detrás de clics adicionales — siempre visibles en tab activo
