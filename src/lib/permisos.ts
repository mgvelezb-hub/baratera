// Catálogo de permisos granulares del sistema.
// Cada clave corresponde a un check real en la UI — si agregas una clave
// nueva aquí, debes usarla con can('clave') en el componente que protege.

export interface PermisoDef {
  key:   string
  grupo: 'Inventario' | 'Venta' | 'Administración'
  label: string
}

export const PERMISOS_CATALOGO: PermisoDef[] = [
  // Inventario
  { key: 'inventario.ver',     grupo: 'Inventario', label: 'Ver inventario e historial' },
  { key: 'inventario.entrada', grupo: 'Inventario', label: 'Entrada de compra' },
  { key: 'inventario.agregar', grupo: 'Inventario', label: 'Agregar productos nuevos' },
  { key: 'inventario.editar',  grupo: 'Inventario', label: 'Editar y eliminar productos' },
  { key: 'inventario.ajuste',  grupo: 'Inventario', label: 'Ajustes de stock y devoluciones' },
  { key: 'inventario.costos',  grupo: 'Inventario', label: 'Ver proveedor y precio de compra' },
  // Venta
  { key: 'venta.pos',          grupo: 'Venta',          label: 'Punto de venta (POS)' },
  // Administración
  { key: 'corte.ver',          grupo: 'Administración', label: 'Corte de caja' },
  { key: 'proveedores.ver',    grupo: 'Administración', label: 'Proveedores y adeudos' },
  { key: 'costos.ver',         grupo: 'Administración', label: 'Costos fijos' },
  { key: 'dashboard.ver',      grupo: 'Administración', label: 'Dashboard' },
]

export const TODAS_LAS_CLAVES = PERMISOS_CATALOGO.map(p => p.key)

export type Permisos = Record<string, boolean>

export function todosLosPermisos(): Permisos {
  return Object.fromEntries(TODAS_LAS_CLAVES.map(k => [k, true]))
}

// Mapeo de respaldo: se usa cuando la tabla `roles` aún no existe en Supabase
// o cuando el rol asignado al usuario no tiene fila en la tabla.
// Refleja el comportamiento hardcodeado previo a la migración.
export const ROLES_FALLBACK: Record<string, string[]> = {
  developer: TODAS_LAS_CLAVES,
  admin:     TODAS_LAS_CLAVES,
  encargado: ['inventario.ver', 'inventario.entrada', 'inventario.agregar', 'venta.pos'],
  cajero:    ['inventario.ver', 'venta.pos'],
}

// Usuarios sin rol asignado se comportan como cajero
export const PERMISOS_SIN_ROL = ROLES_FALLBACK.cajero

export function permisosDesdeLista(claves: string[]): Permisos {
  return Object.fromEntries(claves.map(k => [k, true]))
}
