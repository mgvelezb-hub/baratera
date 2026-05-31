# Product

## Register

product

## Users

**Dueña** — administradora de la papelería. Opera principalmente desde su celular (Android/iPhone), de pie detrás del mostrador o en movimiento. Consulta KPIs entre ventas, recibe alertas en WhatsApp, revisa inventario antes de hacer pedidos a proveedores. No tiene formación técnica pero sí criterio comercial agudo. El celular es su herramienta de control total.

**Cajero/empleado** — atiende el mostrador desde una tablet o computadora del local. Su pantalla es el POS: busca producto, agrega al carrito, cobra. No necesita ver KPIs ni alertas avanzadas. Necesita touch targets generosos y flujos sin fricción para no hacer esperar al cliente.

## Product Purpose

Baratera OS es el sistema operativo de Papelería La Más Baratera, CDMX. Reemplaza Excel, WhatsApp personal y el POS mal configurado con un sistema único que da a la dueña visibilidad de inventario en tiempo real, control de pedidos multicanal (WhatsApp + TikTok + mostrador + tienda online), alertas antes de que algo salga mal, y un chatbot que vende mientras ella descansa.

El éxito se ve así: la dueña sabe cuánto hay en stock sin ir al almacén, sabe cuánto se vendió y por qué canal, y recibe una alerta de WhatsApp antes de quedarse sin un producto de alta rotación.

## Brand Personality

Confiable. Directa. Rápida.

La app no impresiona, hace el trabajo. Cuando la dueña abre el dashboard, ve datos reales, no loading spinners ni ilustraciones vacías. Cuando el cajero busca un producto, lo encuentra antes de que el cliente termine de preguntar. La interfaz está ahí para quitarse del camino.

Tono en UX copy: español mexicano directo. Sin gerundios corporativos. "Stock bajo" no "Notificación de nivel de inventario insuficiente". "Confirmar pedido" no "Proceder con la transacción".

## Anti-references

- **Linear / Notion / SaaS genérico** — sidebar oscuro, tipografía neutral, azul/morado corporativo, sensación de que fue diseñado en San Francisco para startups. Baratera OS es para una papelería en el Centro Histórico de CDMX.
- **Shopify Admin** — tablas pesadas, verde corporativo, sensación de marketplace gringo. Esta es una herramienta local para un negocio local.
- **Hoja de cálculo visual** — grids sin jerarquía, colores de Excel, sensación de que el sistema podría reemplazarse con un Google Sheet.

## Design Principles

1. **Los datos mandan** — el número de stock, el total de venta, la alerta activa. La UI encuadra los datos, nunca compite con ellos. Ningún elemento decorativo si no agrega información.

2. **Dos usuarios, una pantalla** — cada vista debe funcionar para la dueña escaneando en su iPhone y para el cajero tocando en una tablet de 10 pulgadas. Touch targets mínimos de 44px. Nunca comprometer la legibilidad del cajero por la elegancia del dashboard.

3. **Un vistazo, una decisión** — semáforo de stock, KPIs del día, feed de alertas. La dueña toma decisiones sin leer párrafos. La jerarquía visual lleva el ojo al número crítico primero.

4. **Velocidad sobre elegancia** — sin animaciones que retrasen la interacción. Las transiciones existen para orientar, no para deleitar. Cada microsegundo en POS es un cliente esperando.

5. **Hecho para el Centro** — no corporate, no SaaS genérico. El sistema refleja la energía de un local de papelería en CDMX: directo, con color suficiente para navegar rápido, sin barniz corporativo.

## Accessibility & Inclusion

- WCAG 2.1 AA como mínimo
- Touch targets: 44×44px mínimo en todos los controles interactivos (crítico para cajero en tablet y dueña con uñas en celular)
- Contraste: 4.5:1 en texto normal, 3:1 en texto grande y elementos de UI
- Alertas de stock (semáforo) no deben depender solo del color — incluir ícono o etiqueta de texto
- El POS debe funcionar con una mano (dueña sosteniendo producto en la otra)
