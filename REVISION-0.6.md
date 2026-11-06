# Revisión de Cesta Clara 0.6 · 29 de octubre de 2026

## Fallos resueltos

La búsqueda anterior se centraba en categorías de DIA y dos fichas de carne de Mercadona. Una cesta completa podía evitar consultar otras cadenas. Las ocho cadenas tienen ahora un plan de consulta por lista; la caché registra qué se intentó en cada una y sus errores.

«Filete» singular no se normalizaba de forma compatible con «filetes». Ahora filete, filetes, bistec y escalope comparten corte; las etiquetas añojo se admiten para vacuno. No se amplía una petición específica de ternera sin aceptación.

Las fichas de picada que no correspondían al corte ya no llenan los descartes de una búsqueda de filetes. La marca de Consum se extrae por separado y también se busca.

## Prueba del ejemplo del usuario

Entrada conservada, sin cambiar cantidades:

```text
1 kg filete vacuno
4l de leche
```

La instantánea de 209 productos o formatos contiene cestas completas en DIA, Mercadona, Carrefour, Alcampo, Eroski y Consum. Lidl dispone de un filete compatible, pero falta una leche con precio válido; ALDI aporta leche y su ficha de filete no publica un precio verificable. No se interpreta esto como ausencia del producto en tienda.

Los productos de peso variable se marcan como aproximados. La zona zona de prueba continúa sin confirmar; se conservan las zonas de origen zona de prueba en Carrefour y zona de prueba en Alcampo. El resultado es una comparación de referencias recientes, sin garantía de precio local o stock.

## Consulta y estados de las fuentes

- Consulta las ocho cadenas autorizadas, aunque DIA ya complete la cesta.
- Máximo de tres tiendas trabajando a la vez, con escritura del resultado serializada para no perder observaciones.
- Consulta dirigida con presupuestos de páginas y tiempo; índices públicos, categorías y fichas. Respeta robots.txt, pausas y bloqueos.
- Estados separados: sin consultar, permiso pendiente, bloqueo, zona requerida, error, precio no publicado y consulta sin resultados.
- Reintento individual y botón para consultar todas. Caché automática de 15 minutos por lista y requisitos.
- Un error no actualiza la fecha de un precio guardado; una cesta incompleta no gana.
- Las pestañas temporales se cierran al terminar; no se cierran pestañas del usuario.

El índice de categorías y las muestras no constituyen catálogos completos. El descubrimiento de nuevas categorías puede no localizar todos los productos y requiere nuevas pruebas por familias.

## Dictado

Botón «Dictar lista», español de España, inicio y parada explícitos, texto provisional separado del definitivo y protección frente a duplicados. El dictado añade productos sin borrar el borrador; no lanza la comparación.

Admite «siguiente producto», «nueva línea» y porcentajes hablados como «noventa y siete por ciento». Informa de permiso denegado, ausencia de micrófono, falta de soporte y error de red. Cerrar el panel aborta la captura. El límite de longitud detiene el dictado sin truncar requisitos.

Se usa el servicio de voz del navegador, que puede procesar el audio por Internet. No hay Grok ni un modelo de ML añadido; Cesta Clara guarda texto, no audio. El dictado requiere validación con un micrófono físico en Chrome.

## Validación y límites

- 116 pruebas automáticas: interpretación, cortes y especies, composición, cantidades, precios, importadores, MCP, panel, dictado y servicio de fondo.
- Regresión del ejemplo exacto: seis cestas completas en la muestra real y exclusión de carne picada, cerdo y casquería.
- Regresión del servicio de fondo: consulta Mercadona aunque DIA ya complete una cesta; registra resultados de las ocho tiendas; un bloqueo no impide otras consultas ni renueva precios anteriores.
- Pruebas de voz con API simulada: diez casos de inicio, texto, duplicados, parada, permisos, ausencia de soporte, cierre, porcentajes, longitud y cancelación antes de recibir permiso.
- Fuentes públicas verificadas por HTTP o navegación real, incluyendo fichas de Mercadona y Consum, categorías de Carrefour y Alcampo, y categorías HTML de DIA, Eroski y Lidl. ALDI se comprobó sin inventar un precio ausente.
- El panel se ejecuta en jsdom con su HTML y JavaScript de producción. La prueba completa instalada en el Chrome del usuario y el micrófono físico siguen pendientes por las limitaciones del control automático disponible.
- Worker validado como ESM y extensión construida en la carpeta de instalación. Los ZIP excluyen .git, node_modules, runtime, credenciales y artefactos de desarrollo.
- No se han desplegado estos cambios al MCP alojado, que conserva 0.4. El MCP local anuncia 0.6 y comparte la nueva instantánea, interpretación y cálculo.
