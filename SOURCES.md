# Fuentes de Cesta Clara · revisión 0.6

Validación: 29 de octubre de 2026. Muestra de 209 productos o formatos en ocho cadenas. No supone cobertura completa del catálogo nacional ni confirma precios locales para el zona de prueba.

## Descubrimiento y extracción

| Cadena | Descubrimiento de la lista | Extracción |
| --- | --- | --- |
| DIA | Índice de 275 categorías públicas | Estado incrustado contrastado con representación estructurada; ingredientes de fichas seleccionadas |
| Mercadona | Sitemap público | Descripción, precio, formato e ingredientes de la ficha en navegador |
| Carrefour | Categorías públicas y enlaces de navegación | Tarjetas y fichas en navegador; mínimos de compra |
| Alcampo | Categorías públicas y enlaces de navegación | Nombre, precio, formato y disponibilidad de tarjetas en navegador |
| Lidl | Índice de 75 categorías públicas | Datos de tarjetas incrustados; contraste de precios, moneda y vigencia |
| ALDI | Sitemap público de productos | Estado público, precio actual y fechas; fichas sin precio quedan fuera |
| Eroski | Índice de 2.006 enlaces públicos de navegación | Precio de tarjeta contrastado con métricas; composición en fichas seleccionadas |
| Consum | Sitemap público de productos | Título, marca, precio y formato de la ficha principal en navegador |

Índices públicos utilizados:

- [Mercadona](https://tienda.mercadona.es/sitemap.xml).
- [ALDI](https://www.aldi.es/sitemaps/.aldi-nord-sitemap-products.xml).
- [Consum](https://tienda.consum.es/sitemap_product_es.xml).

Se verificaron las rutas de robots.txt. Mercadona excluye sus APIs y categorías; el descubrimiento usa su sitemap y páginas /product permitidas. Las consultas HTTP de Carrefour y Alcampo devolvieron 403, por lo que se usa su navegación normal en Chrome. No se eluden desafíos, bloqueos, autenticación o protecciones.

La consulta tiene pausas y presupuesto de páginas/tiempo. Puede encontrar solo parte del catálogo. No obtener una oferta verificable no demuestra ausencia del producto en la tienda.

## Comprobaciones de esta revisión

- Se consultaron categorías reales de vacuno y leche de DIA y Eroski.
- Se extrajeron 20 observaciones válidas de la categoría pública [Carne de Lidl](https://www.lidl.es/c/carne/a10092771). La categoría declara vacuno para «Filete de aguja»; se conserva esa evidencia de especie.
- [Filete de ALDI](https://www.aldi.es/producto/filete-de-aguja-de-vacuno-601570600.html): la ficha consultada no publicaba un precio actual verificable. No se le asignó un precio.
- [Filetes de Mercadona](https://tienda.mercadona.es/product/8936/filetes-vacuno-anojo-plancha-bandeja): lectura de la ficha pública, 420 g aproximados y 7,98 € en la consulta.
- [Vacuno de Carrefour](https://www.carrefour.es/supermercado/frescos/carne/vacuno/cat190010/c) y [Vacuno de Alcampo](https://www.compraonline.alcampo.es/categories/Frescos/Carne/Vacuno/OC1304): lectura de tarjetas reales. Se excluyó un filete marcado sin disponibilidad en Alcampo.
- Consum: lectura de filete 991567 y leche 12559 desde su ficha principal. La marca se recoge por separado del nombre y participa en la búsqueda.

Estos importes documentan la consulta de ese día; no se renuevan al abrir la extensión. Cada observación conserva URL, fecha, formato, canal, condiciones y hash de evidencia. En navegador, el hash corresponde a campos de producto extraídos, sin guardar HTML de sesión, cuenta o carrito.

## Compatibilidad de productos

«Vacuno» acepta denominaciones bovinas como añojo; «ternera» mantiene su requisito más específico salvo aceptación expresa. Filetes, picada y carne para guisar no son intercambiables. Hígado, cerdo, mezclas y preparados no entran como filete de vacuno.

Un mínimo de carne requiere evidencia explícita en ingredientes. El título, un porcentaje nutricional o una suposición no lo acreditan. La muestra no contiene una oferta verificada al 97% que pueda afirmarse como solución general.

Se usan envases completos y se conservan mínimos de compra. Para productos al peso o con peso aproximado se indica estimación. Un producto agotado, un precio condicionado o una promoción fuera de vigencia no completa una cesta.

## Zonas y canales

CP solicitado: zona de prueba. En las validaciones se mostró zona de prueba en Carrefour y zona de prueba en Alcampo; se guardan como sourcePostcode, sin sustituirlos por el CP solicitado. locationVerified sigue siendo false.

Lidl y ALDI publican anuncios de tienda; otras fuentes exponen precios online. Se distinguen ambos canales. La comparación no garantiza precio final, envío, stock ni ahorro en una tienda concreta.

## Voz

El dictado usa Web Speech API del navegador, con inicio mediante botón y revisión del texto. El navegador puede procesar audio en un servicio remoto; no se promete funcionamiento sin conexión. Referencia: [SpeechRecognition, MDN](https://developer.mozilla.org/en-US/docs/Web/API/SpeechRecognition). Cesta Clara no guarda audio ni envía la lista a un modelo de IA.

La prueba automática simula eventos de reconocimiento; no sustituye la prueba de micrófono físico.

## Distribución

La extensión no se ha publicado en Chrome Web Store. El MCP alojado mantiene su publicación privada 0.4; esta revisión es local. La accesibilidad técnica y robots.txt no resuelven por sí solos las condiciones de reutilización comercial de las fuentes.

## Validación del flujo de cesta 0.7

El 29 de octubre se comprobó la adición por los controles públicos de Mercadona y un contador final de cuatro unidades de leche. Alcampo solicitó iniciar sesión. Estas observaciones validan esos flujos concretos; no validan todas las tiendas ni la extensión instalada. Véase REVISION-0.7.md.
