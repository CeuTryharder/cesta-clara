# Cesta Clara · Chrome y MCP · 0.9.4

Escribe o dicta tu lista, aclara cantidades y preferencias y compara productos compatibles entre ocho supermercados españoles. La extensión puede preparar cantidades en el carrito de una tienda compatible; nunca confirma ni paga el pedido.

Interpreta y calcula localmente mediante reglas, sin Grok ni llamadas a modelos remotos. El MCP permite utilizar el mismo motor desde un agente. Código original bajo [MIT](LICENSE).

## Instalar desde el código

Requiere Node.js 24 y Chrome 116 o posterior.

```sh
npm ci
npm run build:extension
```

En `chrome://extensions`, activa **Modo de desarrollador → Cargar descomprimida** y selecciona `dist/extension`. Abre Cesta Clara desde su icono, indica tu código postal y elige la preferencia de marca. Los permisos para consultar tiendas son opcionales y se solicitan cuando hacen falta.

Consulta [CHROME.md](CHROME.md) para voz, comparación y carritos, y [MCP.md](MCP.md) para conectar un agente. No hace falta un servidor para usar la extensión.

## Qué compara

DIA, Mercadona, Carrefour, Alcampo, Lidl, ALDI, Eroski y Consum. Usa categorías, sitemaps y fichas públicas, con límites de páginas, tiempo y descarga. Las cadenas que requieren navegador se consultan en Chrome. Un permiso pendiente, bloqueo o consulta parcial se indica por separado: no implica que la tienda no venda un producto.

Conserva cantidades, marca, corte, especie y composición. «1 kg de ternera picada, mínimo 97 % de carne» requiere una composición acreditada. Una duda se pregunta; no se elimina una condición para completar la cesta. La carne se elige por menor precio por kilo entre las opciones válidas revisadas. El importe usa envases completos, indicando exceso de cantidad y peso aproximado.

Incluye envío estándar, mínimos y rangos cuando dependen de la franja. Las reglas de envío tienen fecha de revisión y caducan. Si no hay información suficiente, una cesta está incompleta o los rangos se solapan, no inventa un ganador. Lidl y ALDI aportan precios anunciados de tienda física y no tienen cesta online de alimentación compatible.

## Datos y límites

Se incluye una muestra de 209 productos o formatos recogidos el 29 de octubre de 2026, con fechas y fuentes, sin zonas de las sesiones originales. Es una muestra histórica, no un catálogo vigente. Un precio de más de 24 horas, condicionado o caducado no completa una cesta. La cobertura y el precio local se confirman en la tienda.

Las consultas locales del MCP escriben en `runtime/`, ignorado por Git. La compilación rechaza zonas o campos privados en la muestra distribuible. No se incluyen cuentas de hosting ni datos de perfiles de navegador. Revisa [PRIVACY.md](PRIVACY.md), [SECURITY.md](SECURITY.md) y [NOTICE.md](NOTICE.md).

El dictado depende del servicio del navegador y puede enviar audio por Internet. La extensión conserva texto, no grabaciones. La interfaz ofrece borrado de datos locales y un diagnóstico limitado, sin lista ni URLs. [CONSUMO.md](CONSUMO.md) explica qué recursos se miden y cuáles no.

## Desarrollo y verificación

```sh
npm ci
npm test
npm run check:public
node scripts/validate-artifact.mjs
npm audit
```

`npm test` construye primero el Worker y la extensión en `dist/`. Las pruebas usan fixtures; no equivalen a verificar una compra real en todas las cadenas. La voz física y los carritos autenticados requieren comprobación manual. [REVISION-0.9.4.md](REVISION-0.9.4.md) describe el alcance de esta revisión.

Para actualizar una instalación desempaquetada en otra carpeta, usa `node scripts/build-extension.mjs --out /ruta/a/la/extension` y recarga la extensión en Chrome. Los datos existentes permanecen en su perfil hasta que los borres.

Consulta [CONTRIBUTING.md](CONTRIBUTING.md) antes de enviar cambios. La interfaz sigue el sistema documentado en [DESIGN.md](DESIGN.md), basado en criterios de Impeccable para interfaces de uso.
