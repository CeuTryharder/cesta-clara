# Diseño de Cesta Clara · 0.9

Interfaz de uso, clara y contenida. Referencias consultadas: [Impeccable](https://github.com/pbakaus/impeccable), en particular [Operate](https://github.com/pbakaus/impeccable/blob/main/skill/reference/operate.md), [Distill](https://github.com/pbakaus/impeccable/blob/main/skill/reference/distill.md) y [Craft floor](https://github.com/pbakaus/impeccable/blob/main/skill/reference/craft-floor.md). Se adapta su criterio al panel de compra; no se copia el tema de su web ni se instala su motor.

## Sistema

- Una familia de interfaz local: Segoe UI con alternativas del sistema. Escala fija: 12, 14, 16, 18, 28 y 36 px. Las cantidades y los precios usan cifras tabulares.
- Tinta `#202d26`, texto secundario `#5e6962`, papel blanco, fondo `#f5f6f2`. Verde `#116342` reservado a acciones, selección y estados. Ámbar solo para avisos y preguntas.
- Separación de 4/8/16/24/32/48 px. Controles de 44–48 px; reveladores de detalle de al menos 32 px. Bordes de 1 px y radios de 4/8 px; sin sombras decorativas ni franjas laterales de alerta.
- Foco visible de 3 px, controles nativos y estados deshabilitado, hover, selección, carga y error. Movimiento de 160 ms; la indicación de escucha se anula con movimiento reducido.
- Composición de una columna entre 320 y 900 px, con ancho de lectura limitado a 720 px en la pestaña. Se usa el mismo panel en Chrome y en la página de dictado.

## Flujo

Voz y escritura comparten superficie. La preferencia de marca se elige explícitamente. Entrega, zona y cantidad de tiendas quedan en un ajuste con resumen visible. Tras comparar se pliega la edición; «Editar lista» la recupera conservando los datos.

La revisión se abre cuando hay aclaraciones pendientes. La tabla de ocho cadenas queda abierta por defecto; cada fila muestra importe, alcance y estado. Desglose, fuentes y acciones se despliegan por tienda. El mínimo de pedido no queda oculto. Las comprobaciones del total están junto al desglose y las alternativas de dos tiendas se pueden desplegar.

## Revisión

Diagnóstico `refactoring-ui`: inicial 8/10 (6 de 8: jerarquía de acciones y escala/consistencia de espaciado por corregir). La puntuación final se fija después de verificar el render, contraste, escala de grises y anchos de pantalla. Esta puntuación es una evaluación de diseño; no representa un ensayo de usabilidad con clientes.


Resultado visual: 10/10, ocho comprobaciones satisfechas: jerarquía desenfocada, escala de grises, espacios, etiquetas secundarias, escala de espaciado, ancho limitado, contraste y profundidad apropiada. Contrastes calculados: blanco/verde 7,27:1; texto/fondo 13,21:1; secundario/fondo 5,27:1; secundario/blanco 5,72:1; verde/verde claro 6,55:1; ámbar/aviso 6,22:1; placeholder/blanco 4,88:1. Se excluyen controles deshabilitados de este cálculo.

Comprobación en navegador: vistas locales del HTML, CSS y JS de producción, con APIs de Chrome simuladas y precios de prueba. Se revisan 320, 400 y 900 px sin desbordamiento horizontal, tabla, aclaraciones, edición y navegación por flechas. Esta verificación visual no es una prueba de micrófono físico ni de añadir productos en las tiendas reales.
