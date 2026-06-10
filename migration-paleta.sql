-- Actualiza la paleta de colores en configuracion.inventario.colores
-- Corre en Supabase: Dashboard → SQL Editor → Run

UPDATE configuracion
SET valor = jsonb_set(
  COALESCE(valor, '{}'::jsonb),
  '{colores}',
  '[
    {"nombre":"Rojo","hex":"#DC1414"},
    {"nombre":"Blanco","hex":"#FFFFFF"},
    {"nombre":"Fiusha","hex":"#FF0090"},
    {"nombre":"Gris","hex":"#969696"},
    {"nombre":"Verde bandera","hex":"#006838"},
    {"nombre":"Verde limón","hex":"#9ACD32"},
    {"nombre":"Café","hex":"#8B5A2B"},
    {"nombre":"Amarillo Neon","hex":"#DCFF00"},
    {"nombre":"Rosa pastel","hex":"#FFD1DC"},
    {"nombre":"Rosa mexicano","hex":"#E4007C"},
    {"nombre":"Café claro","hex":"#C19A6B"},
    {"nombre":"Café fuerte","hex":"#5C3310"},
    {"nombre":"Naranja neón","hex":"#FF6600"},
    {"nombre":"Naranja","hex":"#FF8C00"},
    {"nombre":"Carne","hex":"#FFCC99"},
    {"nombre":"Morado","hex":"#800080"},
    {"nombre":"Azul aqua","hex":"#00C0D2"},
    {"nombre":"Rosa bebé","hex":"#FFB6C1"},
    {"nombre":"Negro","hex":"#000000"},
    {"nombre":"Azul fuerte","hex":"#0000C8"},
    {"nombre":"Crema","hex":"#FFF5DC"},
    {"nombre":"Amarillo fuerte","hex":"#FFD500"},
    {"nombre":"Salmón","hex":"#FA8072"},
    {"nombre":"Turquesa","hex":"#40E0D0"},
    {"nombre":"Obispo","hex":"#872657"},
    {"nombre":"Azul claro","hex":"#87CEEB"},
    {"nombre":"Amarillo limón","hex":"#FFF44F"},
    {"nombre":"Verde pistache","hex":"#93C572"},
    {"nombre":"Azul rey","hex":"#4169E1"},
    {"nombre":"Lila","hex":"#C8A2C8"},
    {"nombre":"Rosa metálico","hex":"#EA979A"},
    {"nombre":"Palo de rosa","hex":"#DAA8A8"},
    {"nombre":"Amarillo mango","hex":"#FFBE1E"},
    {"nombre":"Rosa","hex":"#FF69B4"},
    {"nombre":"Surtido color fuerte","hex":"#FF0000","gradient":"conic-gradient(from 0deg, #FF0000, #FF6600, #FFCC00, #33CC33, #0066FF, #9900CC, #FF0000)"},
    {"nombre":"Surtido color pastel","hex":"#FFD1DC","gradient":"conic-gradient(from 0deg, #FFD1DC, #FFDAB9, #FFFACD, #B5EAD7, #B0C4DE, #E6B0FF, #FFD1DC)"},
    {"nombre":"Surtido colores intensos","hex":"#FF4500","gradient":"conic-gradient(from 0deg, #FF0000, #FF4500, #FF8800, #00BB00, #0000DD, #8800AA, #FF0000)"},
    {"nombre":"Surtido","hex":"#9400D3","gradient":"conic-gradient(from 0deg, #FF0000, #FF8C00, #FFD500, #00A550, #4169E1, #8B008B, #FF0000)"}
  ]'::jsonb
)
WHERE clave = 'inventario';
