# Revisión 0.8.1 · 30 de octubre de 2026

## Preparar cesta

Se corrigieron fallos en la navegación y reanudación:

- Chrome puede mostrar `about:blank` mientras `pendingUrl` ya apunta al producto. Se espera la carga antes de interpretar la página.
- El título puede aparecer antes que los controles del carro. Se espera la hidratación, incluyendo botones temporalmente deshabilitados.
- Pulsar Preparar para el mismo trabajo lo reanuda; si su pestaña se cerró, se recrea conservando los objetivos guardados.
- Una cesta completada solo se reabre. «Preparar otra compra igual» es una acción explícita que crea otro objetivo.
- Una adición pendiente tras un cierre o reinicio no se repite por tener un contador aún sin actualizar. Se espera la confirmación y se conserva la pausa si no llega.
- Si únicamente falla abrir el carrito final, se conserva el estado de productos ya preparados.
- El panel muestra progreso de inmediato, lleva el foco al estado y ofrece explicación y reintento cuando falla el inicio.

La automatización añade mediante controles de la ficha y comprueba cantidades; no confirma pedidos. Los avisos de sesión, zona o cantidades inciertas requieren revisar la tienda. Si una adición nunca se confirma, no se reenvía automáticamente: hay que comprobar o ajustar esa cantidad en origen. Lidl y ALDI siguen como precios anunciados en tienda física.

## Voz y uso

El panel empieza con un botón grande de dictado y tres pasos: lista, comparación y tienda. La marca se elige mediante tres botones. Código postal, número de tiendas y ajustes por producto quedan plegados. La cesta completa muestra una acción principal; las alternativas se despliegan.

Los comandos completos «comparar», «marca blanca», «cualquier marca», «marca Pascual», «deshacer» y «preparar cesta en DIA» se interpretan sin añadirlos a la lista. Una descripción como «4 litros de leche marca blanca» se conserva como producto. Las preguntas se pueden leer en voz alta y contestar con «Responder por voz». Las respuestas mantienen cantidades, corte, marcas elegidas por producto y requisitos de composición. Una respuesta inválida se puede corregir hablando de nuevo, sin crear un producto adicional; editar la lista descarta las preguntas anteriores.

La parada por comando espera el cierre del reconocimiento e ignora resultados tardíos para no reemplazar la orden elegida. La parada con el botón conserva la última transcripción pendiente. Los casos se comprueban con cierre asíncrono, como ocurre en el navegador.

Tras conceder el micrófono en la pestaña de Cesta Clara, la lista continúa allí para dictar. La primera autorización de una tienda solicitada por voz muestra un botón: el permiso de Chrome necesita un clic. Se preservan las respuestas de productos que no se han editado al añadir más dictado.

## Comprobaciones y límites

172 pruebas automáticas aprobadas. Incluyen 24 de carrito, 23 del panel y 20 de voz e intenciones. Las pruebas de integración serializan y ejecutan `cartPageStep`, la misma función inyectada en producción, sobre DOM de prueba con carga, botones y respuestas demorados. Se comprobaron dos regresiones que fallaban antes del arreglo de la adición incierta. También se cubren el recorrido de dictar, comparar, elegir marca, responder una duda y preparar por voz, con reconocimiento simulado.

Construcción de extensión y Worker validada. El Worker exporta `default.fetch` como ESM. Los ZIP se comprueban y excluyen `.git`, `node_modules`, archivos de entorno y datos de ejecución.

No se ha podido validar esta revisión instalada ni el micrófono físico. El navegador disponible no pudo conectar con la vista local, y Chrome no estaba disponible para automatización. No se presenta el DOM simulado como prueba en tiendas reales. La prueba de Mercadona documentada en 0.7 era una verificación del flujo del comercio; no acredita esta revisión instalada ni todas las cadenas.

Los datos no se han renovado como parte de este arreglo: se mantiene la instantánea del 29 de octubre, con sus fechas y controles de caducidad. El CP zona de prueba sigue sin confirmarse para todas las cadenas.

## Revisión visual

Evaluación provisional con Refactoring UI: **8/10**, seis de ocho comprobaciones sustentadas por la implementación: separación entre grupos, etiquetas secundarias, escala de espaciado, ancho limitado, contraste y uso contenido de sombras. Contrastes calculados: verde sobre blanco 6,21:1; texto secundario sobre superficie 5,75:1; advertencia 6,59:1; error 6,42:1. Los controles principales tienen al menos 44 px y se respeta movimiento reducido al desplazar el foco.

Pendientes para alcanzar 10/10: inspección visual de la jerarquía con desenfoque y en escala de grises, en el panel real y a distintos anchos. No se atribuye una validación visual completa a las pruebas de DOM.

## GitHub

La carpeta `cesta-clara-chrome` está conectada al repositorio privado `CeuTryharder/cesta-clara-chrome`. La versión remota inspeccionada fue 0.8.0, commit `c23c6291e4e13738de5c4402b8944b113becd1c2`. Los cambios 0.8.1 se preparan en esa carpeta y en el código fuente. No se ha hecho push ni se ha modificado la publicación MCP alojada.
