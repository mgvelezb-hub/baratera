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
  nombre:    string
  hex:       string
  gradient?: string   // conic-gradient para colores "Surtido"
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
      { nombre: 'Rojo',                   hex: '#DC1414' },
      { nombre: 'Blanco',                 hex: '#FFFFFF' },
      { nombre: 'Fiusha',                 hex: '#FF0090' },
      { nombre: 'Gris',                   hex: '#969696' },
      { nombre: 'Verde bandera',          hex: '#006838' },
      { nombre: 'Verde limón',            hex: '#9ACD32' },
      { nombre: 'Café',                   hex: '#8B5A2B' },
      { nombre: 'Amarillo Neon',          hex: '#DCFF00' },
      { nombre: 'Rosa pastel',            hex: '#FFD1DC' },
      { nombre: 'Rosa mexicano',          hex: '#E4007C' },
      { nombre: 'Café claro',             hex: '#C19A6B' },
      { nombre: 'Café fuerte',            hex: '#5C3310' },
      { nombre: 'Naranja neón',           hex: '#FF6600' },
      { nombre: 'Naranja',                hex: '#FF8C00' },
      { nombre: 'Carne',                  hex: '#FFCC99' },
      { nombre: 'Morado',                 hex: '#800080' },
      { nombre: 'Azul aqua',              hex: '#00C0D2' },
      { nombre: 'Rosa bebé',              hex: '#FFB6C1' },
      { nombre: 'Negro',                  hex: '#000000' },
      { nombre: 'Azul fuerte',            hex: '#0000C8' },
      { nombre: 'Crema',                  hex: '#FFF5DC' },
      { nombre: 'Amarillo fuerte',        hex: '#FFD500' },
      { nombre: 'Salmón',                 hex: '#FA8072' },
      { nombre: 'Turquesa',               hex: '#40E0D0' },
      { nombre: 'Obispo',                 hex: '#872657' },
      { nombre: 'Azul claro',             hex: '#87CEEB' },
      { nombre: 'Amarillo limón',         hex: '#FFF44F' },
      { nombre: 'Verde pistache',         hex: '#93C572' },
      { nombre: 'Azul rey',               hex: '#4169E1' },
      { nombre: 'Lila',                   hex: '#C8A2C8' },
      { nombre: 'Rosa metálico',          hex: '#EA979A' },
      { nombre: 'Palo de rosa',           hex: '#DAA8A8' },
      { nombre: 'Amarillo mango',         hex: '#FFBE1E' },
      { nombre: 'Rosa',                   hex: '#FF69B4' },
      { nombre: 'Surtido color fuerte',   hex: '#FF0000', gradient: 'conic-gradient(from 0deg, #FF0000, #FF6600, #FFCC00, #33CC33, #0066FF, #9900CC, #FF0000)' },
      { nombre: 'Surtido color pastel',   hex: '#FFD1DC', gradient: 'conic-gradient(from 0deg, #FFD1DC, #FFDAB9, #FFFACD, #B5EAD7, #B0C4DE, #E6B0FF, #FFD1DC)' },
      { nombre: 'Surtido colores intensos', hex: '#FF4500', gradient: 'conic-gradient(from 0deg, #FF0000, #FF4500, #FF8800, #00BB00, #0000DD, #8800AA, #FF0000)' },
      { nombre: 'Surtido',                hex: '#9400D3', gradient: 'conic-gradient(from 0deg, #FF0000, #FF8C00, #FFD500, #00A550, #4169E1, #8B008B, #FF0000)' },
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
