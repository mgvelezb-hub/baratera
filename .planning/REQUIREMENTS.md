# Requirements: Baratera OS — Papelería La Más Baratera

**Defined:** 2026-05-22
**Core Value:** La dueña ve en tiempo real cuánto hay en stock, cuánto se vendió y por qué canal, y recibe alertas automáticas en WhatsApp antes de que algo salga mal.

## v1 Requirements

### Authentication & Roles

- [ ] **AUTH-01**: Dueña puede iniciar sesión con email + contraseña (Supabase Auth)
- [ ] **AUTH-02**: Sistema maneja 3 roles: dueña (admin total), cajero (solo POS), operador (OMS + WMS)
- [ ] **AUTH-03**: Sesión persiste entre recargas; logout limpia cookie HttpOnly
- [ ] **AUTH-04**: Rutas protegidas redirigen a /login si no hay sesión activa

### WMS — Almacén y Stock

- [ ] **WMS-01**: Cada movimiento de stock se registra en stock_ledger como registro append-only (timestamp + tipo + canal + qty_antes + qty_después + usuario_id); nunca se edita ni elimina
- [ ] **WMS-02**: stock_disponible se calcula siempre en tiempo real: stock_fisico − SUM(reservas WHERE estado='pendiente')
- [ ] **WMS-03**: Cada SKU tiene stock_minimo + lead_time_proveedor_dias configurables; cuando stock_disponible < stock_minimo se genera alerta WA a dueña + borrador de PO automático
- [ ] **WMS-04**: Flujo de recepción de mercancía compara cantidad esperada (PO) vs cantidad real recibida; si hay delta positivo se genera alerta WA antes de subir al inventario
- [ ] **WMS-05**: Dashboard de stock muestra semáforo por SKU (verde: >mínimo×1.5 / amarillo: entre mínimo y mínimo×1.5 / rojo: <mínimo), ordenable por semáforo
- [ ] **WMS-06**: Cada cambio de precio de SKU queda registrado inmutablemente: precio_anterior + precio_nuevo + usuario_id + timestamp

### OMS — Gestión de Pedidos

- [ ] **OMS-01**: Pedido tiene ciclo de vida completo: nuevo → confirmado → en_preparación → listo → enviado → entregado → completado; cancelado es posible en cualquier estado antes de enviado
- [ ] **OMS-02**: Creación de pedido ejecuta reserva atómica en una sola transacción SQL: verificar stock + restar stock_disponible + crear pedido; rollback total si cualquier paso falla
- [ ] **OMS-03**: Pricing engine recibe (cliente_id, sku, qty) y consulta tipo_cliente + umbral_mayoreo + promoción_activa_crm para devolver precio_final + tipo_precio
- [ ] **OMS-04**: Si tipo de entrega = foráneo: campo dirección es obligatorio + fecha_entrega estimada = hoy + días_envío; si tipo = CDMX: solo pickup o entrega local sin campo dirección obligatorio
- [ ] **OMS-05**: Job cron verifica pedidos en estado 'nuevo' sin pago confirmado después de 24hrs → llama POST /pedidos/:id/cancelar → stock liberado automáticamente
- [ ] **OMS-06**: Cada pedido registra canal_origen (wa / tiktok / webapp / pos / telefono); visible en tabla de pedidos y reportes
- [ ] **OMS-07**: Cuando se crea pedido foráneo, sistema envía WA a dueña con resumen: canal, cliente, productos, total, dirección

### POS — Punto de Venta Físico

- [ ] **POS-01**: Interfaz web ejecutable en Chrome del local; busca producto por texto (input) o escaneo de barcode (Web Serial API / campo de texto si no hay lector serial)
- [ ] **POS-02**: Si cantidad en carrito ≥ umbral_mayoreo del SKU, precio cambia automáticamente a mayoreo sin intervención del cajero, con indicador visual claro
- [ ] **POS-03**: Campo "aplicar descuento" bloqueado por defecto; al hacer clic pide PIN; si PIN válido habilita descuento; si PIN inválido envía POST /alertas con descuento_no_auth → WA a dueña
- [ ] **POS-04**: Botón "cobrar" registra método de pago (efectivo / transferencia), crea venta en ventas_pos con cajero_id + timestamp, y descuenta stock en ledger
- [ ] **POS-05**: Al cerrar venta, genera comando ESC/POS a impresora Epson térmica vía Print.js o biblioteca de impresión térmica compatible
- [ ] **POS-06**: "Cerrar turno" pide al cajero el efectivo contado en caja; sistema calcula monto esperado; si delta > umbral configurable, envía alerta WA a dueña con diferencia
- [ ] **POS-07**: Campo teléfono capturado en checkout del POS se asocia al perfil CRM del cliente enriqueciendo el historial; campo opcional
- [ ] **POS-08**: POS funciona como PWA con Service Worker que cachea catálogo localmente; si cae el internet el POS sigue operando; sincroniza stock y ventas cuando regresa la red

### WebApp — Tienda Online

- [ ] **WEBAPP-01**: Página pública /catalogo muestra grid de ~50 SKUs con foto, nombre, precio, y badge de stock (Disponible / Últimas N unidades / Sin stock + fecha estimada de reabasto)
- [ ] **WEBAPP-02**: Cuando cantidad seleccionada en carrito ≥ umbral_mayoreo del SKU, precio cambia automáticamente a precio mayoreo con indicador visual
- [ ] **WEBAPP-03**: Checkout captura: nombre + teléfono + tipo_entrega (CDMX/foráneo) + dirección (obligatoria si foráneo); teléfono identifica al cliente en CRM
- [ ] **WEBAPP-04**: Al confirmar pedido: POST /pedidos → si éxito: envía WA de confirmación al número capturado + notificación a dueña; si error de stock: muestra alternativa con fecha estimada
- [ ] **WEBAPP-05**: Supabase Realtime subscription en tabla productos actualiza badges de stock en todos los navegadores conectados cuando POS o chatbot realizan venta, sin F5
- [ ] **WEBAPP-06**: Meta tags + Open Graph en cada página de producto para que links compartidos en TikTok/WA muestren imagen y precio correctamente
- [ ] **WEBAPP-07**: Diseño y experiencia mobile-first (>90% del tráfico llega desde móvil vía link en WA o TikTok)

### Chatbot — WhatsApp + TikTok

- [ ] **CHAT-01**: Motor de intención capa 1 con regex + keywords detecta 7 intents: catálogo / precio_sku / hacer_pedido / estado_pedido / dirección / horarios / otro; costo $0
- [ ] **CHAT-02**: Motor de intención capa 2 invoca GPT-4o mini solo si capa 1 falla; system prompt clasifica en los mismos intents; costo ~$0.001/mensaje
- [ ] **CHAT-03**: Antes de confirmar cualquier pedido, sistema ejecuta GET /disponibilidad/:sku/:qty; si disponible confirma; si no, calcula fecha con lead_time + envío_foráneo y la comunica al cliente
- [ ] **CHAT-04**: Flujo de slot-filling mantiene estado de conversación en Redis; captura secuencialmente: SKU → cantidad → nombre → tipo_entrega → dirección si foráneo → confirmación
- [ ] **CHAT-05**: En cada sesión de chatbot, GET /clientes/:tel verifica si el cliente existe; si existe carga historial y promoción activa; si no existe crea perfil nuevo en CRM
- [ ] **CHAT-06**: Si usuario de TikTok no sigue la cuenta (API no permite DM), responde en comentario público con texto de producto + número de WhatsApp para continuar
- [ ] **CHAT-07**: Si intención no es reconocida 2 veces consecutivas en la misma sesión, envía POST /notificaciones/wa a dueña con mensaje "Cliente [nombre] necesita atención manual"
- [ ] **CHAT-08**: Toda conversación se registra en tabla conversaciones: timestamp + canal + telefono + mensaje + intent_detectado para análisis y mejora continua
- [ ] **CHAT-09**: Webhooks de Meta y TikTok responden 200 OK en <5 segundos; el procesamiento real del mensaje ocurre en Bull Queue de forma asíncrona

### CRM — Clientes y Promociones

- [ ] **CRM-01**: Teléfono es la clave única universal del cliente en todos los canales; GET /clientes/:tel busca o crea cliente; compra en WA + TikTok + POS = mismo registro
- [ ] **CRM-02**: Perfil de cliente incluye: nombre, teléfono, tipo (mayorista/menudeo), canal_origen, ltv, compras_mes_actual, monto_mes_actual, ultima_compra, tags[], notas
- [ ] **CRM-03**: Motor de reglas se ejecuta automáticamente en POST /clientes/:id/compra; evalúa cada regla activa; si condición se cumple crea registro en tabla promociones_activas
- [ ] **CRM-04**: Dueña puede crear/editar reglas desde el dashboard con condición configurable (ej: compras_mes ≥ N) + tipo de promoción + valor + fecha de vencimiento; sin escribir código
- [ ] **CRM-05**: En cada sesión de chatbot, GET /clientes/:tel/promocion-activa devuelve la promoción vigente si existe; chatbot la incluye automáticamente en la cotización
- [ ] **CRM-06**: Cron a las 9am evalúa clientes con ultima_compra < NOW() - INTERVAL configurable; envía mensaje WA de reactivación personalizado con nombre del cliente
- [ ] **CRM-07**: Dashboard permite broadcast segmentado: dueña filtra segmento (mayoristas/menudeo/inactivos) + escribe mensaje + revisa lista de destinatarios + confirma; sistema envía WA batch respetando rate limits de Meta
- [ ] **CRM-08**: Vista de cliente en dashboard muestra timeline cronológico de todas las compras por canal, total gastado, última compra, promociones usadas y canal preferido

### Dashboard — Control Central

- [ ] **DASH-01**: Header row muestra KPIs en tiempo real: ventas_hoy_total + desglose por canal (POS/WA/TikTok/Web) + pedidos_abiertos + alertas_activas sin resolver
- [ ] **DASH-02**: Tabla de stock muestra los ~50 SKUs con columnas: semáforo, nombre, stock_disponible, stock_mínimo, días_hasta_reabasto; ordenable por semáforo; botón "crear PO" por SKU
- [ ] **DASH-03**: Sección OMS embebida muestra tabla de pedidos con filtros por canal/estado/tipo; permite cambiar estado de pedido con clic y ver detalle completo
- [ ] **DASH-04**: Feed de alertas en tiempo real: cada alerta muestra tipo (descuento_no_auth/stock_rojo/corte_diferencia/pedido_foráneo/cancelación) + severidad (warning/critical) + timestamp + botón "resolver"
- [ ] **DASH-05**: Panel CCTV muestra iframe del NVR Hikvision vía Hik-Connect; campo "ver en grabación" lleva al timestamp exacto de la última transacción
- [ ] **DASH-06**: CRM quick view muestra: clientes nuevos hoy + clientes sin compra en N días configurables + top 5 compradores del mes + botón de broadcast segmentado
- [ ] **DASH-07**: Dashboard es mobile-first PWA; notificaciones push para alertas críticas cuando el celular está bloqueado (Web Push API)
- [ ] **DASH-08**: Supabase Realtime activo en todas las secciones; el dashboard se actualiza automáticamente con pedidos nuevos, ventas en POS y alertas generadas

## v2 Requirements

### Pagos en línea
- **PAY-01**: Pasarela de pago Stripe o MercadoPago en WebApp checkout
- **PAY-02**: Conciliación automática de transferencias bancarias

### Reportes avanzados
- **RPT-01**: Exportación de reportes a PDF y Excel
- **RPT-02**: Filtros por rango de fechas arbitrario en todas las vistas
- **RPT-03**: Dashboard de rentabilidad por SKU (margen bruto)

### Alertas de tendencias
- **TRND-01**: Alerta automática cuando SKU tiene tendencia de ventas inusual
- **TRND-02**: Predicción de reabasto basada en histórico de ventas

### Multi-sucursal
- **MSUC-01**: Soporte para múltiples ubicaciones con inventario independiente
- **MSUC-02**: Transferencias de stock entre sucursales

## Out of Scope

| Feature | Reason |
|---------|--------|
| Facturación CFDI / SAT | Complejidad fiscal, requiere integrador certificado — v2+ |
| App nativa iOS/Android | WebApp mobile-first + PWA cubren el 90% del uso en v1 |
| Multi-sucursal | Negocio de una ubicación en v1 |
| Stripe / MercadoPago | Pago por transferencia es el método actual; integración en v2 |
| Roles avanzados (equipo grande) | 3 roles (dueña/cajero/operador) son suficientes para la escala actual |
| Integración con POS existente | Sistema nuevo desde cero |
| Notificaciones email | WhatsApp es el canal preferido de la dueña; email en v2 |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| AUTH-01 | Phase 1 | Pending |
| AUTH-02 | Phase 1 | Pending |
| AUTH-03 | Phase 1 | Pending |
| AUTH-04 | Phase 1 | Pending |
| WMS-01 | Phase 2 | Pending |
| WMS-02 | Phase 2 | Pending |
| WMS-03 | Phase 2 | Pending |
| WMS-04 | Phase 2 | Pending |
| WMS-05 | Phase 2 | Pending |
| WMS-06 | Phase 2 | Pending |
| OMS-01 | Phase 3 | Pending |
| OMS-02 | Phase 3 | Pending |
| OMS-03 | Phase 3 | Pending |
| OMS-04 | Phase 3 | Pending |
| OMS-05 | Phase 3 | Pending |
| OMS-06 | Phase 3 | Pending |
| OMS-07 | Phase 3 | Pending |
| POS-01 | Phase 4 | Pending |
| POS-02 | Phase 4 | Pending |
| POS-03 | Phase 4 | Pending |
| POS-04 | Phase 4 | Pending |
| POS-05 | Phase 4 | Pending |
| POS-06 | Phase 4 | Pending |
| POS-07 | Phase 4 | Pending |
| POS-08 | Phase 4 | Pending |
| WEBAPP-01 | Phase 5 | Pending |
| WEBAPP-02 | Phase 5 | Pending |
| WEBAPP-03 | Phase 5 | Pending |
| WEBAPP-04 | Phase 5 | Pending |
| WEBAPP-05 | Phase 5 | Pending |
| WEBAPP-06 | Phase 5 | Pending |
| WEBAPP-07 | Phase 5 | Pending |
| CHAT-01 | Phase 6 | Pending |
| CHAT-02 | Phase 6 | Pending |
| CHAT-03 | Phase 6 | Pending |
| CHAT-04 | Phase 6 | Pending |
| CHAT-05 | Phase 6 | Pending |
| CHAT-06 | Phase 6 | Pending |
| CHAT-07 | Phase 6 | Pending |
| CHAT-08 | Phase 6 | Pending |
| CHAT-09 | Phase 6 | Pending |
| CRM-01 | Phase 7 | Pending |
| CRM-02 | Phase 7 | Pending |
| CRM-03 | Phase 7 | Pending |
| CRM-04 | Phase 7 | Pending |
| CRM-05 | Phase 7 | Pending |
| CRM-06 | Phase 7 | Pending |
| CRM-07 | Phase 7 | Pending |
| CRM-08 | Phase 7 | Pending |
| DASH-01 | Phase 8 | Pending |
| DASH-02 | Phase 8 | Pending |
| DASH-03 | Phase 8 | Pending |
| DASH-04 | Phase 8 | Pending |
| DASH-05 | Phase 8 | Pending |
| DASH-06 | Phase 8 | Pending |
| DASH-07 | Phase 8 | Pending |
| DASH-08 | Phase 8 | Pending |

**Coverage:**
- v1 requirements: 52 total
- Mapped to phases: 52
- Unmapped: 0 ✓

---
*Requirements defined: 2026-05-22*
*Last updated: 2026-05-22 after initial definition from modulos_completos_todos.html*
