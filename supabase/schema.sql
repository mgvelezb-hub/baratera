-- ============================================================
-- BARATERA OS — Schema v1 (WMS MVP)
-- Ejecutar en: Supabase Dashboard → SQL Editor
-- ============================================================

-- Extensión para UUID
create extension if not exists "uuid-ossp";

-- ============================================================
-- TABLA: productos
-- ============================================================
create table if not exists productos (
  id            uuid primary key default uuid_generate_v4(),
  nombre        text not null,
  descripcion   text,
  sku           text unique,
  precio_menudeo  numeric(12,2) not null default 0,
  precio_mayoreo  numeric(12,2),
  umbral_mayoreo  integer,           -- cantidad mínima para precio mayoreo
  stock_fisico    integer not null default 0,
  stock_minimo    integer not null default 5,
  unidad          text not null default 'pza',  -- pza, kg, lt, caja, etc.
  categoria       text,
  activo          boolean not null default true,
  imagen_url      text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

-- ============================================================
-- TABLA: stock_ledger (append-only — NUNCA UPDATE/DELETE)
-- ============================================================
create table if not exists stock_ledger (
  id            uuid primary key default uuid_generate_v4(),
  producto_id   uuid not null references productos(id) on delete restrict,
  tipo          text not null check (tipo in (
    'levantamiento_inventario',
    'entrada_compra',
    'salida_venta_manual',
    'ajuste_positivo',
    'ajuste_negativo',
    'devolucion'
  )),
  qty_antes     integer not null,
  qty_despues   integer not null,
  diferencia    integer not null generated always as (qty_despues - qty_antes) stored,
  notas         text,
  canal         text default 'manual',  -- manual, wa, pos, webapp, tiktok
  usuario_id    uuid references auth.users(id),
  created_at    timestamptz not null default now()
);

-- RLS: solo lectura después de insert (no update/delete)
alter table stock_ledger enable row level security;
alter table productos enable row level security;

-- Políticas: usuario autenticado tiene acceso total por ahora
-- (en Fase 1 completa se afinarán los roles)
create policy "Autenticados pueden leer productos"
  on productos for select
  to authenticated
  using (true);

create policy "Autenticados pueden insertar productos"
  on productos for insert
  to authenticated
  with check (true);

create policy "Autenticados pueden actualizar productos"
  on productos for update
  to authenticated
  using (true);

create policy "Autenticados pueden leer ledger"
  on stock_ledger for select
  to authenticated
  using (true);

create policy "Autenticados pueden insertar en ledger"
  on stock_ledger for insert
  to authenticated
  with check (true);

-- PROHIBIDO: update y delete en stock_ledger por diseño (ledger append-only)
-- No se crean políticas para UPDATE/DELETE

-- ============================================================
-- FUNCIÓN: actualizar updated_at automáticamente
-- ============================================================
create or replace function actualizar_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger productos_updated_at
  before update on productos
  for each row execute function actualizar_updated_at();

-- ============================================================
-- ÍNDICES para performance
-- ============================================================
create index if not exists idx_stock_ledger_producto on stock_ledger(producto_id, created_at desc);
create index if not exists idx_productos_activo on productos(activo);
create index if not exists idx_productos_categoria on productos(categoria);

-- ============================================================
-- VISTA: resumen de stock con semáforo
-- ============================================================
create or replace view vista_stock as
select
  p.id,
  p.nombre,
  p.sku,
  p.stock_fisico,
  p.stock_minimo,
  p.unidad,
  p.categoria,
  p.precio_menudeo,
  p.precio_mayoreo,
  p.umbral_mayoreo,
  p.activo,
  case
    when p.stock_fisico < p.stock_minimo then 'rojo'
    when p.stock_fisico < (p.stock_minimo * 1.5) then 'amarillo'
    else 'verde'
  end as semaforo,
  (select count(*) from stock_ledger sl where sl.producto_id = p.id) as total_movimientos,
  (select sl.created_at from stock_ledger sl where sl.producto_id = p.id order by sl.created_at desc limit 1) as ultimo_movimiento
from productos p
where p.activo = true
order by
  case
    when p.stock_fisico < p.stock_minimo then 1
    when p.stock_fisico < (p.stock_minimo * 1.5) then 2
    else 3
  end,
  p.nombre;

-- ============================================================
-- DATOS DE PRUEBA (opcional — comentar si no se necesita)
-- ============================================================
-- insert into productos (nombre, sku, precio_menudeo, precio_mayoreo, umbral_mayoreo, stock_fisico, stock_minimo, unidad, categoria)
-- values
--   ('Cuaderno Profesional 100h', 'CUA-100H', 25.00, 20.00, 12, 0, 10, 'pza', 'Cuadernos'),
--   ('Plumas Bic Azul', 'PLA-BIC-AZ', 6.00, 4.50, 10, 0, 20, 'pza', 'Escritura'),
--   ('Corrector Pelikan', 'COR-PEL', 18.00, 15.00, 6, 0, 8, 'pza', 'Corrección'),
--   ('Tijeras Escolar', 'TIJ-ESC', 30.00, 24.00, 6, 0, 5, 'pza', 'Manualidades');
