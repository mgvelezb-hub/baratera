# Perfiles dinámicos con permisos granulares

**Fecha:** 2026-06-09

## Diseño

- Tabla `roles` en Supabase: `nombre` (clave en app_metadata), `etiqueta`, `descripcion`, `permisos` JSONB, `es_sistema`.
- Catálogo de 11 permisos granulares en `src/lib/permisos.ts` (las claves corresponden a checks reales en la UI).
- `useIsAdmin` lee el rol del usuario → busca su fila en `roles` → expone `can(key)` + flags legacy (`isAdmin`, `canEntrada`, `showCostos`) calculados desde permisos. **Fallback**: si la tabla no existe o el rol no se encuentra, usa el mapeo hardcodeado actual (la app no se rompe antes de correr la migración).
- `developer` siempre tiene todos los permisos (no editable, no eliminable). `admin` editable pero no eliminable. Roles custom: CRUD completo.
- Un rol solo se puede eliminar si ningún usuario lo tiene asignado.
- Sidebar: cada módulo declara su permiso (`inventario.ver`, `venta.pos`, `corte.ver`, etc). Configuraciones sigue siendo devOnly hardcodeado (seguridad).

## Catálogo de permisos

| Key | Grupo | Controla |
|-----|-------|----------|
| inventario.ver | Inventario | Módulo inventario + historial |
| inventario.entrada | Inventario | Entrada de compra |
| inventario.agregar | Inventario | Botón Agregar producto |
| inventario.editar | Inventario | Editar/eliminar producto |
| inventario.ajuste | Inventario | Ajustes de stock |
| inventario.costos | Inventario | Ver proveedor/precio compra |
| venta.pos | Venta | Módulo POS |
| corte.ver | Administración | Corte de caja |
| proveedores.ver | Administración | Proveedores y adeudos |
| costos.ver | Administración | Costos fijos |
| dashboard.ver | Administración | Dashboard (+ módulos Pronto) |

## Tareas

1. `migration-roles.sql` — tabla + RLS select authenticated + seed developer/admin/encargado/cajero
2. `src/lib/permisos.ts` — catálogo + mapeo legacy + tipos
3. `src/lib/hooks/useIsAdmin.ts` — fetch dinámico con caché 60s + fallback + `can()`
4. `src/app/api/dev/roles/route.ts` — GET/POST/PATCH/DELETE (verifyDeveloper, maneja 42P01 → migrationPending)
5. `src/app/api/dev/users/route.ts` — PATCH valida rol contra tabla (fallback legacy)
6. `Sidebar.tsx` — módulos con permiso key
7. `InventarioClient.tsx` + `ProductoDetailClient.tsx` — flags granulares
8. `RolesTab.tsx` (nuevo) + `ConfiguracionesClient.tsx` — tab Perfiles con CRUD + checkboxes por grupo; dropdown de usuarios alimentado por la tabla
9. Build + commit + push

## Verificación

- [ ] Build verde
- [ ] Sin migración corrida: app se comporta igual que hoy (fallback)
- [ ] Con migración: tab Perfiles lista 4 roles, permite crear/editar/borrar custom
- [ ] Cambiar un checkbox de encargado se refleja al recargar como encargado (simulación)
