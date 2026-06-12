// Catálogo de permisos granulares del sistema.
// Cada clave corresponde a un check real en la UI — si agregas una clave
// nueva aquí, debes usarla con can('clave') en el componente que protege.

export const GRUPOS_LISTA = [
  'Inventario',
  'POS / Venta',
  'Clientes',
  'Corte de caja',
  'Proveedores',
  'Costos fijos',
  'Dashboard',
] as const

export type PermisoGrupo = typeof GRUPOS_LISTA[number]

export interface PermisoDef {
  key:   string
  grupo: PermisoGrupo
  label: string
}

export const PERMISOS_CATALOGO: PermisoDef[] = [
  // Inventario
  { key: 'inventario.ver',     grupo: 'Inventario',    label: 'Ver productos e historial' },
  { key: 'inventario.entrada', grupo: 'Inventario',    label: 'Entrada de compra' },
  { key: 'inventario.agregar', grupo: 'Inventario',    label: 'Agregar productos nuevos' },
  { key: 'inventario.editar',  grupo: 'Inventario',    label: 'Editar y eliminar productos' },
  { key: 'inventario.ajuste',  grupo: 'Inventario',    label: 'Ajustes de stock y devoluciones' },
  { key: 'inventario.costos',  grupo: 'Inventario',    label: 'Ver proveedor y precio de compra' },
  // POS / Venta
  { key: 'venta.pos',          grupo: 'POS / Venta',   label: 'Acceder al punto de venta' },
  { key: 'venta.historial',    grupo: 'POS / Venta',   label: 'Ver historial de ventas' },
  { key: 'venta.cancelar',     grupo: 'POS / Venta',   label: 'Cancelar o anular ventas' },
  { key: 'venta.cupon',        grupo: 'POS / Venta',   label: 'Aplicar cupones de descuento' },
  // Clientes
  { key: 'clientes.ver',       grupo: 'Clientes',      label: 'Ver lista y perfil de clientes' },
  { key: 'clientes.crear',     grupo: 'Clientes',      label: 'Crear nuevos clientes' },
  { key: 'clientes.editar',    grupo: 'Clientes',      label: 'Editar y eliminar clientes' },
  // Corte de caja
  { key: 'corte.ver',          grupo: 'Corte de caja', label: 'Ver corte de caja' },
  { key: 'corte.editar',       grupo: 'Corte de caja', label: 'Cerrar y editar cortes' },
  // Proveedores
  { key: 'proveedores.ver',    grupo: 'Proveedores',   label: 'Ver proveedores y adeudos' },
  { key: 'proveedores.editar', grupo: 'Proveedores',   label: 'Crear y editar proveedores' },
  { key: 'proveedores.pago',   grupo: 'Proveedores',   label: 'Registrar pagos a proveedores' },
  // Costos fijos
  { key: 'costos.ver',         grupo: 'Costos fijos',  label: 'Ver costos fijos' },
  { key: 'costos.editar',      grupo: 'Costos fijos',  label: 'Agregar y editar costos fijos' },
  // Dashboard
  { key: 'dashboard.ver',      grupo: 'Dashboard',     label: 'Ver dashboard y métricas' },
]

export const TODAS_LAS_CLAVES = PERMISOS_CATALOGO.map(p => p.key)

export type Permisos = Record<string, boolean>

export function todosLosPermisos(): Permisos {
  return Object.fromEntries(TODAS_LAS_CLAVES.map(k => [k, true]))
}

// Mapeo de respaldo: se usa cuando la tabla `roles` aún no existe en Supabase
// o cuando el rol asignado al usuario no tiene fila en la tabla.
export const ROLES_FALLBACK: Record<string, string[]> = {
  developer: TODAS_LAS_CLAVES,
  admin:     TODAS_LAS_CLAVES,
  encargado: [
    'inventario.ver', 'inventario.entrada', 'inventario.agregar',
    'venta.pos', 'venta.historial', 'venta.cupon',
    'clientes.ver', 'clientes.crear',
    'corte.ver',
    'proveedores.ver',
    'dashboard.ver',
  ],
  cajero: [
    'inventario.ver',
    'venta.pos', 'venta.cupon',
    'clientes.ver', 'clientes.crear',
  ],
}

// Usuarios sin rol asignado se comportan como cajero
export const PERMISOS_SIN_ROL = ROLES_FALLBACK.cajero

export function permisosDesdeLista(claves: string[]): Permisos {
  return Object.fromEntries(claves.map(k => [k, true]))
}
