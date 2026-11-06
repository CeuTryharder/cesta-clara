# Cesta Clara 0.9.0 — rediseño

Rediseño del panel de Chrome siguiendo los criterios de Impeccable para interfaces de uso: menos competencia entre acciones, jerarquía sobria, ajustes progresivos y controles reconocibles. Se conserva la identidad verde de Cesta Clara.

Voz y escritura comparten una entrada. Tras comparar, la edición se pliega y la revisión se abre cuando hay dudas. Las ocho tiendas aparecen en una tabla compacta con desglose, condiciones y acciones desplegables. Entrega, código postal y número de tiendas se agrupan en un ajuste cuyo resumen permanece visible. Se mantienen precios de referencia, envío, mínimos, cantidades, composición y preferencias de marca.

No se instala el motor, hooks ni la extensión de Impeccable. Sus referencias se usan para el trabajo de diseño; el plugin no incorpora dependencias remotas, nuevas fuentes ni peticiones de red por motivos visuales.

`npm test`: 234 pruebas aprobadas, sin fallos ni omisiones. Worker validado como ESM con `default.fetch`. Verificación visual local a 320, 400 y 900 px, con las APIs de Chrome simuladas y la muestra fijada para probar el diseño; no representa precios actuales. Se revisan tabla de tiendas, preguntas, vuelta a editar, búsqueda vacía y navegación por teclado. Contraste y escala de grises documentados en DESIGN.md. No se ha probado esta revisión instalada en el Chrome del usuario ni el micrófono físico.

Durante una preparación en curso, las acciones para preparar otra cesta se ocultan hasta detener o terminar la actual. Se conservan las opciones de abrir la tienda y continuar.
