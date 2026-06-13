# Impresión del ticket — Guía de configuración (driver + código)

> Documento para configurar la impresora térmica en la computadora del POS.
> Dáselo a Claude Code en esa máquina **junto con el archivo** `src/app/venta/TicketPrint.tsx`.

---

## 1. Cómo imprime este sistema (LEER PRIMERO)

**El código NO se comunica directamente con el driver de la impresora ni envía comandos ESC/POS.**
El POS corre en el **navegador** (Chrome) y la impresión se hace con el **diálogo de impresión del navegador** (`window.print()`), renderizando el ticket en un `<iframe>` invisible.

Consecuencia práctica:
- La impresora se configura como una **impresora normal del sistema operativo** (CUPS en macOS / cola de impresión en Windows) + ajustes en **Chrome**.
- Lo que el código controla es el **contenido y el tamaño de hoja** (vía CSS `@page`). Lo que el **driver/SO + Chrome** controlan es el papel físico, márgenes de hardware y si sale el diálogo o imprime directo.
- Para que salga bien, ambos lados deben coincidir: **58 mm de ancho, márgenes en "Ninguno", escala 100%, gráficos de fondo activados.**

---

## 2. Archivos del código relevantes

| Archivo | Qué contiene |
|---|---|
| `src/app/venta/TicketPrint.tsx` | **El archivo clave.** Toda la lógica de impresión: constantes de papel, CSS de impresión, función `openPrint()` (iframe + `window.print()` + `@page` dinámico) y el diseño del ticket. |
| `src/app/venta/VentaClient.tsx` | Dispara el ticket tras la venta y le pasa los datos (ítems, total, cliente, cajero, fecha). |
| `src/lib/config.ts` | Datos del negocio que salen en el ticket (dirección, teléfono, footer). Editables también en *Configuraciones*. |
| `public/logo-baratera.png` | Logo a color (solo para PDF/WhatsApp y correo; **el ticket impreso usa un wordmark de texto**, no esta imagen). |
| `src/app/globals.css` | Carga la tipografía redondeada **Fredoka** usada por el wordmark del logo en el ticket. |

Para configurar la impresora, con `TicketPrint.tsx` + este documento es suficiente.

---

## 3. Parámetros ajustables del código

En `src/app/venta/TicketPrint.tsx`, bloque **"CONFIGURACIÓN DE IMPRESIÓN"** (≈ línea 41):

```ts
const PAPER_MM  = 58   // ancho del rollo. Para impresora de 80mm → cambiar a 80
const MARGIN_MM = 4    // margen lateral del texto. Si se corta a la derecha → subir a 5–6
const BUFFER_MM = 8    // papel extra al final. Si se corta abajo → subir; si alimenta de más → bajar
```

- El **alto** de la hoja se calcula solo (mide el contenido y lo inyecta en `@page { size: 58mm <alto>mm }`), así no hay paginación ni cortes raros.
- `print-color-adjust: exact` ya está puesto para forzar que Chrome imprima las **barras/divisores negros**.
- El logo del ticket es **texto** (fuente Fredoka, en negro) — imprime nítido en blanco y negro; no depende de imágenes.

---

## 4. Configuración del DRIVER / Sistema operativo

### Identificar la impresora
- Anota **marca y modelo** de la térmica (ej. Epson TM-T20, Xprinter XP-58, Bixolon, etc.) y si es **58 mm** o **80 mm**.
- Si `PAPER_MM` (58) no coincide con tu rollo, ajusta la constante del código.

### macOS (CUPS)
1. Instala el driver del fabricante (o usa el genérico si la impresora es ESC/POS compatible).
2. *Ajustes del sistema → Impresoras y escáneres* → agrega la impresora.
3. En las opciones de la impresora define el **tamaño de papel personalizado** a **58 mm de ancho** (alto puede ser "rollo"/continuo).
4. Déjala como **impresora predeterminada** si solo se usa esa.

### Windows
1. Instala el driver del fabricante.
2. *Configuración → Bluetooth y dispositivos → Impresoras* → propiedades de la impresora.
3. Crea/selecciona un **tamaño de papel de 58 mm** (Preferencias de impresión → Tamaño de papel).
4. Predeterminada si aplica.

---

## 5. Configuración en CHROME (crítico)

La **primera vez** que se imprime, en el diálogo de Chrome:
- **Destino:** la impresora térmica.
- **Páginas:** Todas.
- **Diseño:** Vertical.
- **Más ajustes →**
  - **Tamaño de papel:** 58 mm (o el personalizado creado).
  - **Márgenes:** **Ninguno**.
  - **Escala:** **Predeterminada (100%)** — *no* "Ajustar al área".
  - **Gráficos de fondo:** **ACTIVADO** (si no, no salen las barras/divisores negros).

Chrome **recuerda** estos ajustes para esa impresora.

---

## 6. (Opcional) Impresión automática sin diálogo — "kiosk printing"

Si quieres que **al tocar "Imprimir" salga directo** sin el diálogo cada venta:

1. Cierra Chrome por completo.
2. Lánzalo con la bandera de kiosk-printing apuntando al POS:

   **macOS:**
   ```bash
   open -a "Google Chrome" --args --kiosk-printing
   ```
   **Windows (acceso directo → Destino):**
   ```
   "C:\Program Files\Google\Chrome\Application\chrome.exe" --kiosk-printing
   ```
3. La impresora térmica debe ser la **predeterminada del sistema** (kiosk-printing usa la default y omite el diálogo).

> Con `--kiosk-printing`, `window.print()` imprime de inmediato a la impresora predeterminada. Sin la bandera, siempre aparece el diálogo (comportamiento normal y seguro).

---

## 7. Checklist de problemas comunes

| Síntoma | Causa probable | Solución |
|---|---|---|
| Texto cortado a la derecha | Área imprimible < 50 mm | Sube `MARGIN_MM` a 5–6 en `TicketPrint.tsx` |
| Ticket cortado abajo | Falta colchón vertical | Sube `BUFFER_MM` (ej. 12) |
| Alimenta mucho papel en blanco al final | `BUFFER_MM` muy alto | Bájalo (ej. 4–6) |
| No salen las barras/divisores negros | "Gráficos de fondo" apagado | Actívalo en Chrome |
| El logo (texto redondeado) sale en otra fuente | Fredoka no cargó (sin internet) | Verifica conexión; cae a fuente del sistema como respaldo |
| Sale en una hoja tamaño carta enorme | Tamaño de papel mal en Chrome/driver | Pon papel 58 mm + márgenes "Ninguno" |
| Todo más chico/grande de lo debido | Escala ≠ 100% | Pon escala "Predeterminada (100%)" |

---

## 8. Resumen para configurar el driver

1. Instalar driver de la térmica (saber modelo y ancho real).
2. Crear papel **58 mm** en el SO y en Chrome.
3. Chrome: márgenes **Ninguno**, escala **100%**, **gráficos de fondo ON**.
4. (Opcional) `--kiosk-printing` + impresora predeterminada para imprimir sin diálogo.
5. Hacer una venta de prueba e imprimir. Si se corta, ajustar `MARGIN_MM` / `BUFFER_MM` en `src/app/venta/TicketPrint.tsx`.
