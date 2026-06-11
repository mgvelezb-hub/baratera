-- migration-configuracion.sql
-- Tablas: configuracion (ajustes editables del negocio) + auditoria (log append-only).
-- Correr UNA VEZ en el SQL editor de Supabase (después de migration-roles.sql).

-- ── configuracion: key-value con JSONB ──────────────────────────
create table if not exists configuracion (
  clave          text primary key,
  valor          jsonb not null default '{}'::jsonb,
  actualizado_en timestamptz not null default now()
);

alter table configuracion enable row level security;

-- Lectura para cualquier usuario autenticado (ticket, banner de mantenimiento,
-- categorías). Escritura solo vía service role (API del developer).
drop policy if exists "configuracion_select_authenticated" on configuracion;
create policy "configuracion_select_authenticated"
  on configuracion for select
  to authenticated
  using (true);

-- Seed con los valores hardcodeados actuales
insert into configuracion (clave, valor) values
  (
    'negocio',
    '{
      "nombre": "La Más Baratera",
      "direccion1": "Calle Mesones 123, 2º piso (mano izquierda)",
      "direccion2": "Col. Centro, Cuauhtémoc, 06000, CDMX",
      "web": "lamasbaratera.com.mx",
      "telefono": "5619952549",
      "footer1": "¡Gracias por su compra!",
      "footer2": "Vuelva pronto",
      "footer3": "Estimado cliente, por favor revise su mercancia antes de salir de la tienda. NO HAY CAMBIOS NI DEVOLUCIONES de ningun producto"
    }'
  ),
  (
    'alertas',
    '{ "email": "lamasbaratera@gmail.com" }'
  ),
  (
    'inventario',
    '{
      "categorias": ["Cuadernos", "Escritura", "Corrección", "Arte y manualidades", "Oficina", "Escolar", "Tecnología", "Otro"],
      "semaforo_factor": 1.5,
      "colores": [
        { "nombre": "Rojo",     "hex": "#ef4444" }, { "nombre": "Naranja",  "hex": "#f97316" },
        { "nombre": "Amarillo", "hex": "#eab308" }, { "nombre": "Verde",    "hex": "#22c55e" },
        { "nombre": "Azul",     "hex": "#3b82f6" }, { "nombre": "Morado",   "hex": "#a855f7" },
        { "nombre": "Rosa",     "hex": "#ec4899" }, { "nombre": "Negro",    "hex": "#1e293b" },
        { "nombre": "Blanco",   "hex": "#f8fafc" }, { "nombre": "Gris",     "hex": "#94a3b8" },
        { "nombre": "Café",     "hex": "#92400e" }, { "nombre": "Turquesa", "hex": "#06b6d4" }
      ]
    }'
  ),
  (
    'mantenimiento',
    '{ "activo": false, "mensaje": "Sistema en mantenimiento. Las ventas están pausadas por unos minutos." }'
  )
on conflict (clave) do nothing;

-- ── auditoria: log append-only de acciones del panel ─────────────
create table if not exists auditoria (
  id            uuid primary key default gen_random_uuid(),
  accion        text not null,          -- 'rol.cambiado', 'datos.reset', 'config.editada', ...
  detalle       jsonb not null default '{}'::jsonb,
  usuario_email text,
  creado_en     timestamptz not null default now()
);

-- RLS habilitado SIN policies → solo accesible con service role (API developer)
alter table auditoria enable row level security;
