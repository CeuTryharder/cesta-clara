# Cesta Clara para agentes

El MCP local comparte interpretación y cálculo con la extensión. El agente aporta la conversación; Cesta Clara devuelve hechos recogidos por scraping. No llama a modelos ni requiere una cuenta de Cesta Clara.

## Conectar

Requiere Node.js 24. Configura tu cliente para ejecutar `node` con la ruta absoluta a `scripts/mcp-stdio.mjs`. Adapta esta ruta ilustrativa:

```json
{"mcpServers":{"cesta-clara":{"command":"node","args":["C:/proyectos/cesta-clara/scripts/mcp-stdio.mjs"]}}}
```

No uses `npm run mcp` como comando del cliente: npm puede escribir mensajes que interfieran con JSON-RPC. El servidor usa stdio y no abre un puerto. La extensión y el MCP tienen almacenamientos independientes.

## Herramientas

- `estado_fuentes {}`: cobertura, fecha, zona y capacidad de actualización.
- `buscar_productos {"consulta":"leche","limite":10}`: productos observados, formatos y fuentes.
- `calcular_cesta {"lista":"6 litros de leche\n12 huevos","codigo_postal":"28001","aceptar_alternativas":true}`: cantidades y costes de una lista ilustrativa. Sustituye el código postal por el que indique la persona.
- `historial_producto {"supermercado":"DIA","sku":"608","limite":20}`: histórico local existente, sin inventarlo.
- `actualizar_precios {"codigo_postal":"28001"}`: scraping HTTP y escritura local. No actualiza las cadenas que requieren navegador. El parámetro omitido deja la zona sin especificar.

El refresco escribe exclusivamente en `runtime/snapshot.json` y `runtime/prices.sqlite`, ignorados por Git. Si no hay instantánea local se usa la muestra pública, conservando sus fechas históricas. No sobrescribe `data/dia-latest.json`. No hay actualización oculta ni admite URLs o comandos arbitrarios.

## Instrucciones para el agente

1. Consulta el estado de las fuentes antes de recomendar. Una muestra antigua no es un precio actual.
2. Conserva cantidades, marcas, corte, especie, composición y restricciones. Devuelve las preguntas de `clarifications` a la persona y reenvía la lista original con `respuestas`, usando el `lineId` real.
3. Pregunta la preferencia de marca: `preferencia_marca` admite `cualquiera`, `blanca` o `concreta`; para la última indica `marca`. No autorices sustituciones por tu cuenta.
4. Para ampliar ternera a vacuno hace falta `allowVacuno: true` confirmado. Un porcentaje mínimo no desaparece al responder otra duda.
5. `modalidad: "domicilio"` incluye envío estándar; `"presencial"` compara solo productos y no equivale a recogida online. Las tarifas pueden variar por franja y tienen fecha de revisión.
6. Usa `totalCents` solo cuando exista; `totalMinCents` y `totalMaxCents` expresan rangos. No conviertas `null` en cero. `winner` puede ser nulo. Cada pedido de un reparto lleva su propio envío y mínimo.
7. El cliente decide la autorización para la herramienta de refresco, que declara escritura y acceso externo. El MCP no prepara carritos ni compra: esas funciones pertenecen a Chrome.

## Worker opcional

`npm run build` genera un Worker de referencia en `dist/server/index.js`. `npm run dev` permite probarlo en `127.0.0.1:4173`. No se publica automáticamente ni incluye un endpoint personal o credenciales. Quien quiera alojarlo debe configurar autenticación, límites, registros y una muestra pública revisada. No expongas una instantánea personal como catálogo compartido.
