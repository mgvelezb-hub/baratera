-- migration-roles.sql
-- Tabla de perfiles dinámicos con permisos granulares.
-- Correr UNA VEZ en el SQL editor de Supabase.

create table if not exists roles (
  id          uuid primary key default gen_random_uuid(),
  nombre      text unique not null,            -- clave usada en app_metadata.role
  etiqueta    text not null,                   -- nombre legible en UI
  descripcion text,
  permisos    jsonb not null default '{}'::jsonb,  -- { "inventario.ver": true, ... }
  es_sistema  boolean not null default false,  -- true = no se puede eliminar
  creado_en   timestamptz not null default now()
);

alter table roles enable row level security;

-- Cualquier usuario autenticado puede LEER los roles (el hook los necesita).
-- Escritura solo vía service role (API del developer).
drop policy if exists "roles_select_authenticated" on roles;
create policy "roles_select_authenticated"
  on roles for select
  to authenticated
  using (true);

-- Seed con los 4 roles actuales y sus permisos vigentes
insert into roles (nombre, etiqueta, descripcion, permisos, es_sistema) values
  (
    'developer', 'Developer', 'Acceso total + módulo de configuraciones',
    '{"inventario.ver":true,"inventario.entrada":true,"inventario.agregar":true,"inventario.editar":true,"inventario.ajuste":true,"inventario.costos":true,"venta.pos":true,"corte.ver":true,"proveedores.ver":true,"costos.ver":true,"dashboard.ver":true}',
    true
  ),
  (
    'admin', 'Admin', 'Acceso total al negocio',
    '{"inventario.ver":true,"inventario.entrada":true,"inventario.agregar":true,"inventario.editar":true,"inventario.ajuste":true,"inventario.costos":true,"venta.pos":true,"corte.ver":true,"proveedores.ver":true,"costos.ver":true,"dashboard.ver":true}',
    true
  ),
  (
    'encargado', 'Encargado', 'Inventario (entrada y alta de productos) + POS, sin costos',
    '{"inventario.ver":true,"inventario.entrada":true,"inventario.agregar":true,"venta.pos":true}',
    false
  ),
  (
    'cajero', 'Cajero', 'Punto de venta y consulta de inventario',
    '{"inventario.ver":true,"venta.pos":true}',
    false
  )
on conflict (nombre) do nothing;
