# Revisión 0.8.2 · 3 de noviembre de 2026

## Pestañas y preparación

La 0.8.1 recuperaba pestañas cerradas antes de comenzar, pero no las que desaparecían entre `tabs.get`, enfoque, navegación e inyección. Se reprodujeron cuatro fallos contra esa versión y se corrigieron esos recorridos. La nueva recuperación conserva cantidades objetivo, productos completados y adiciones inciertas. Está limitada a dos recuperaciones durante cada preparación para evitar abrir pestañas repetidamente si otra causa las cierra.

Si la pestaña se pierde al ejecutar una adición, se reabre y se pausa para verificar la cantidad antes de continuar. No se repite el clic incierto. «Abrir [tienda]» también usa la recuperación del controlador: ya no intenta enfocar directamente un ID guardado que puede estar caducado.

Esto corrige las carreras reproducidas. No se ha determinado qué cerró la pestaña de la instalación del usuario. Tampoco se ha completado una cesta desde esa instalación en esta revisión; la compatibilidad con cada carrito y sus sesiones requiere esa prueba.

## Mensajes y presentación

La preparación utiliza una tarjeta blanca con borde discreto, estado compacto, contador y acciones «Abrir [tienda]» y «Ya está, continuar». La pausa no muestra una barra vacía ni un panel amarillo grande. Los productos permanecen plegados y detener tiene menor peso visual.

Los errores de red, permisos y páginas se presentan con instrucciones breves. Actualizar varias fuentes no concatena sus respuestas técnicas en un aviso gigante. Tiendas muestra fecha, estado y páginas de cada consulta. «Guardar diagnóstico» descarga versión, ocho estados de fuente y pasos del carrito, sin lista, nombres de productos, código postal, cuentas ni direcciones.

Se aplican los criterios de Refactoring UI ya usados en el proyecto. Evaluación provisional 8/10: ancho limitado, escala de espaciado, contraste, separación de grupos, etiquetas secundarias y profundidad contenida. Pendiente inspección de la nueva tarjeta en el panel instalado, en gris y con desenfoque. No se presenta una revisión de CSS como validación visual completa.

## Comprobación de las ocho cadenas

Se prueba que, con permisos concedidos, se intentan las ocho fuentes y todas reciben resultado aunque Carrefour bloquee o Alcampo falle. Un error al comprobar los permisos tampoco detiene las otras siete. La actualización general aísla errores por cadena igual que la búsqueda por lista.

Prueba pública de red del 3 de noviembre, lista de filetes de vacuno, leche y huevos:

| Fuente | Resultado real de la prueba |
| --- | --- |
| DIA | 3 páginas; 35 observaciones de precio |
| Eroski | 3 páginas; 43 observaciones, 4 condicionadas |
| ALDI | Parcial; 1 observación; otras páginas sin precio válido |
| Lidl | Categoría vigente; 2 precios exclusivos Lidl Plus, ambos condicionados |
| Mercadona | Índice público accesible; 6 rutas de búsqueda |
| Carrefour | Rutas públicas accesibles; 3 objetivos |
| Alcampo | Rutas públicas accesibles; 3 objetivos |
| Consum | Índice público accesible; 8 objetivos |

En navegador se abrieron además fichas públicas de leche de las cuatro cadenas que necesitan navegador: Mercadona mostraba 0,96 €/l; Carrefour 0,96 €/l con compra de seis unidades y zona zona de prueba; Alcampo 0,95 €/l sin ubicación elegida; Consum mostraba leche Pascual a 1,39 €/l sin zona elegida. Son comprobaciones de fichas, no una comparación para CP zona de prueba ni una ejecución de la extensión instalada. No se añadieron productos durante estas comprobaciones; Mercadona ya mostraba cuatro unidades de una prueba anterior.

En Lidl se sustituye una campaña de octubre que había quedado vacía por la categoría estable enlazada desde su navegación pública. Se admiten precios actuales exclusivos Lidl Plus como condicionados y se excluyen anuncios futuros. No entran en el total general. El caso se conserva como fixture público con sus fechas; no se inventa una coincidencia de filetes a partir de productos de cerdo.

Las observaciones de esta prueba no se han mezclado con la instantánea distribuida. Se conservan las fechas originales y la extensión debe actualizar precios antes de comparar datos caducados. Ninguna de estas comprobaciones garantiza disponibilidad local o precios para zona de prueba.

## Validación

188 pruebas automáticas aprobadas: entre ellas, seis regresiones nuevas de carrito, comprobación de las ocho fuentes en búsqueda y al revisar la lista, aislamiento de fallos de permisos, mensajes, diagnóstico y precios condicionados de Lidl. Las pruebas de carrito ejecutan el código de producción serializado en DOM simulado con respuestas demoradas. La prueba instalada permanece pendiente.

La carpeta de extensión y sus ZIP se reconstruyen desde el código fuente. No se ha publicado en GitHub, Chrome Web Store ni en el MCP alojado.
