# Revisión de Cesta Clara 0.5 · 29 de octubre de 2026

## Problemas corregidos
El intérprete anterior descartaba productos fuera de una lista cerrada y no retenía atributos de composición. Ahora cada línea tiene una identidad, petición estructurada y estado; las preguntas y las respuestas se relacionan con esa línea.

El extractor de Mercadona podía seleccionar el primer h1 cuando una ficha se abría sobre otra. Se selecciona la descripción de la última ficha y se extraen sus ingredientes desde el bloque correspondiente. Hay una prueba de regresión con dos fichas superpuestas.

No se presentan precios de fichas parecidas como cumplimiento de un 97% mínimo. Se exige un porcentaje explícito asociado a la especie en ingredientes; un porcentaje de proteínas, grasas o un rótulo del nombre no constituye prueba.

## Casos de aceptación
| Entrada o situación | Resultado comprobado |
| --- | --- |
| Un kilo de ternera picada, 97% carne o más | 1 kg; picada; ternera; mínimo 97% |
| Un kilo de ternera | Pregunta por el corte y conserva la línea |
| Respuesta: «picada con un mínimo de 97% de carne» | Añade corte y porcentaje, sin ignorar la respuesta |
| Ternera picada 97% sin cantidad | Pregunta por la cantidad; no convierte 97% en 97 kg |
| Carne de ternera 96,9% frente a mínimo 97% | Excluida |
| Carne de ternera 97%, 98% o 100% en ingredientes | Compatible con el mínimo |
| Composición ausente | Ficha visible sin verificar; fuera del total |
| Mezcla con cerdo o hamburguesa en vez de picada | Excluida |
| Vacuno en vez de ternera | Requiere aceptación; conserva el mínimo |
| Una duda pendiente junto a productos con precio | Cesta incompleta; sin ganador |
| Precio barato al 90% frente a uno más caro que cumple | Solo el producto compatible participa |
| Kilo y medio; leche de avena; yogur sin azúcar | Se conserva el contexto de una sola línea |

## Datos reales
Se consultó por HTTP la categoría de carne picada de DIA y cinco fichas de ingredientes, con precio e identidad cruzados entre representaciones públicas. La consulta devolvió 24 observaciones que se deduplicaron por URL; la instantánea pasa de 115 a 134 productos/formatos.

La ficha pública [DIA 261239](https://www.dia.es/carnes/hamburguesas-carne-picada-y-albondigas/p/261239) acredita 90% de vacuno; no cumple un mínimo de 97%. También se comprobó mediante navegación la ficha [Mercadona 2868](https://tienda.mercadona.es/product/2868/preparado-carne-picada-vacuno-bandeja), cuyos ingredientes visibles indican 90%. Una ficha sin ingredientes no se da por válida por su aspecto.

No se ha encontrado ni inventado una oferta real al 97% para completar esta prueba. Los casos de 97%, 98% y 100% son fixtures de prueba, exclusivamente dentro de tests.

## Diseño
Referencia visual: el uso sencillo del verde y del blanco en Mercadona, con identidad propia. Logo original de cesta con marca de verificación, SVG y PNG en cuatro tamaños. Sin copiar marcas ni sus símbolos.

Se han eliminado tarjetas repetidas y texto comercial secundario. El panel usa lista revisada, preguntas junto al producto y una tabla convencional de precios. Se preserva la distinción entre subtotal y cesta completa.

Auditoría Refactoring UI actual: **6/8 verificaciones, 8/10**. Verificados por código: escala de espaciado, anchura limitada, separación entre grupos, jerarquía de etiquetas/valores, contraste y uso sobrio de bordes/profundidad. Quedan pendientes la comprobación visual de jerarquía en Chrome a anchura real y su revisión en escala de grises; no se contabilizan como aprobadas sin verla renderizada.

Contrastes calculados: blanco sobre verde 6,21:1; texto principal 15,15:1; texto secundario sobre blanco 6,18:1; avisos 6,59:1. Controles con altura mínima 44 px, foco visible, pestañas con flechas/Home/End, estados de carga, avisos accesibles y HTML externo tratado como texto.

## Pruebas y límites
- Suite automatizada: 91 pruebas; motor, cantidades, requisitos, composición, importadores, comparación, MCP HTTP/stdio, panel DOM y servicio de fondo.
- Las pruebas del panel ejecutan el HTML y JavaScript de producción en jsdom.
- Las pruebas del servicio de fondo importan la extensión construida con APIs de Chrome simuladas, incluyendo búsqueda automática, permisos y caché de consultas.
- El scraping de DIA sí se ejecutó contra la fuente real. Se preservan fecha y origen; no se renuevan fechas de consultas fallidas.
- La prueba instalada y la revisión visual completa no se han podido ejecutar. El acceso al servidor local agotó el tiempo de espera y el navegador de pruebas rechazó file:// por su política de protocolos. No se eludió ese bloqueo.
- La búsqueda por petición cubre DIA y dos fichas de carne de Mercadona; el resto de las cadenas mantiene su actualización anterior. No es cobertura exhaustiva.
- Intérprete local basado en reglas y requisitos; no es un modelo de ML entrenado. Las formulaciones no comprendidas pueden requerir corregir la línea.
- No se han desplegado estos cambios al MCP alojado, que conserva la publicación 0.4.
