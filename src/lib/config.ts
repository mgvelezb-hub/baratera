// Configuración editable del negocio — tabla `configuracion` en Supabase.
// Los DEFAULTS son los valores hardcodeados previos a la migración: si la
// tabla no existe o una clave falta, la app se comporta exactamente igual.

export interface ConfigNegocio {
  nombre:     string
  direccion1: string
  direccion2: string
  web:        string
  telefono:   string
  footer1:    string
  footer2:    string
}

export interface ConfigAlertas {
  email: string
}

export interface ColorPaleta {
  nombre: string
  hex:    string
}

export interface ConfigInventario {
  categorias:      string[]
  subcategorias:   string[]
  semaforo_factor: number     // amarillo si stock < minimo * factor
  colores:         ColorPaleta[]
}

export interface ConfigMantenimiento {
  activo:  boolean
  mensaje: string
}

export interface AppConfig {
  negocio:       ConfigNegocio
  alertas:       ConfigAlertas
  inventario:    ConfigInventario
  mantenimiento: ConfigMantenimiento
}

export const CONFIG_DEFAULTS: AppConfig = {
  negocio: {
    nombre:     'La Más Baratera',
    direccion1: 'Calle Mesones 123, 2º piso (mano izquierda)',
    direccion2: 'Col. Centro, Cuauhtémoc, 06000, CDMX',
    web:        'lamasbaratera.com.mx',
    telefono:   '5619952549',
    footer1:    '¡Gracias por su compra!',
    footer2:    'Vuelva pronto',
  },
  alertas: {
    email: 'lamasbaratera@gmail.com',
  },
  inventario: {
    categorias:    ['Cuadernos', 'Escritura', 'Corrección', 'Arte y manualidades', 'Oficina', 'Escolar', 'Tecnología', 'Otro'],
    subcategorias: [],
    semaforo_factor: 1.5,
    colores: [
      { nombre: 'Rojo',     hex: '#ef4444' }, { nombre: 'Naranja',  hex: '#f97316' },
      { nombre: 'Amarillo', hex: '#eab308' }, { nombre: 'Verde',    hex: '#22c55e' },
      { nombre: 'Azul',     hex: '#3b82f6' }, { nombre: 'Morado',   hex: '#a855f7' },
      { nombre: 'Rosa',     hex: '#ec4899' }, { nombre: 'Negro',    hex: '#1e293b' },
      { nombre: 'Blanco',   hex: '#f8fafc' }, { nombre: 'Gris',     hex: '#94a3b8' },
      { nombre: 'Café',     hex: '#92400e' }, { nombre: 'Turquesa', hex: '#06b6d4' },
    ],
  },
  mantenimiento: {
    activo:  false,
    mensaje: 'Sistema en mantenimiento. Las ventas están pausadas por unos minutos.',
  },
}

export const CONFIG_CLAVES = Object.keys(CONFIG_DEFAULTS) as (keyof AppConfig)[]

// Mezcla filas de la tabla `configuracion` con los defaults (shallow por clave)
export function mergeConfig(rows: { clave: string; valor: unknown }[] | null): AppConfig {
  const out: AppConfig = structuredClone(CONFIG_DEFAULTS)
  for (const row of rows ?? []) {
    const clave = row.clave as keyof AppConfig
    if (clave in out && row.valor && typeof row.valor === 'object') {
      out[clave] = { ...out[clave], ...(row.valor as object) } as never
    }
  }
  return out
}
