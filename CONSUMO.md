# Consumo — revisión del 3 de noviembre de 2026

## Resultado medido

Prueba local en Windows con Node v24.19.0, 209 observaciones y 100 repeticiones por escenario después de calentamiento. Se fija el reloj a la muestra para que no caduquen los precios. No incluye red, navegación, reconocimiento de voz ni la extensión instalada en Chrome.

| Lista | Productos interpretados | Mediana | Percentil 95 | CPU media por cálculo |
| --- | ---: | ---: | ---: | ---: |
| 1 línea | 1 | 0,40 ms | 0,57 ms | 0,79 ms |
| 6 líneas | 6 | 3,08 ms | 3,40 ms | 3,28 ms |
| 30 líneas con repeticiones | 6 agrupados | 4,01 ms | 4,36 ms | 4,69 ms |

La instantánea serializada ocupa 206.852 bytes, unos 202 KiB. Es tamaño de datos JSON; no es RAM ni el espacio total de la extensión. La diferencia de heap de Node tras GC tampoco permite atribuir memoria a Chrome.

Reproducir: `node --expose-gc scripts/benchmark.mjs resultado.json`. Los resultados varían con el equipo y la carga. Estas cifras no prueban que el plugin completo sea ligero: queda pendiente medir CPU y RAM del navegador durante búsquedas reales.

## Costes encontrados y cambios

- El buscador podía ejecutar tres cadenas con navegador simultáneamente. Ahora una cola permite una sola página de consulta a la vez. Las ocho cadenas se siguen intentando; esperar turno consume parte del límite de tiempo y puede producir resultados parciales, que se identifican.
- Los recolectores recibían toda una respuesta antes de comprobar su tamaño. Ahora leen por bloques y cancelan al superar el presupuesto de bytes: 3 MB por defecto y 5 MB en determinados índices públicos. Los errores HTTP también cancelan el cuerpo. No impide el tráfico adicional que genere una página de supermercado.
- La caché de búsqueda sigue evitando repetir consultas automáticamente para la misma lista durante 15 minutos. El histórico conserva hasta 20 observaciones por SKU y las búsquedas hasta 30 claves; el número total de SKU puede crecer y aumentar almacenamiento y coste de lectura/escritura.
- Las actualizaciones automáticas solo se activan por decisión del usuario, con un lote de las tiendas autorizadas cada 15 minutos. El progreso de una operación en curso se consulta cada 1,5 segundos; no hay un nuevo temporizador de medición.

## Medir en el uso habitual

En **Tiendas → Consumo de la extensión → Ver consumo**, después de buscar, aparecen almacenamiento local, solicitudes HTTP, fallos, texto recibido por el recolector, páginas abiertas y duraciones recientes. La medición es local y sus agregados se guardan al terminar operaciones. El diagnóstico descargable incluye estos datos sin lista, cuentas ni URLs.

El texto medido no incluye imágenes, scripts, vídeos, compresión, cabeceras, tráfico de pestañas, voz ni preparación de carritos. Las duraciones son tiempo transcurrido, no tiempo de CPU. Los contadores empiezan con 0.8.6 y un cierre del worker durante la operación puede impedir guardarlos.

Para CPU y RAM reales, abre el administrador de tareas de Chrome con **Mayús + Esc** y compara: reposo con panel cerrado; panel abierto sin consultar; búsqueda en las ocho cadenas; preparación de cesta. Revisa tanto Cesta Clara como las pestañas de supermercados, porque parte del coste aparece en estas últimas. No cierres procesos durante la medición.

Fuentes de la plataforma: [almacenamiento de extensiones](https://developer.chrome.com/docs/extensions/reference/api/storage), [ciclo de vida del worker](https://developer.chrome.com/docs/extensions/develop/concepts/service-workers/lifecycle), [administrador de tareas de Chrome](https://support.google.com/chrome/answer/1385029). No se han concedido permisos de depuración o acceso a procesos para esta medición.
