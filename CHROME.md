# Cesta Clara en Chrome · 0.9.3

## Actualizar

En chrome://extensions pulsa el icono circular de recarga de Cesta Clara. Cierra y abre su panel. Debe aparecer 0.9.3. Los archivos ya están en la misma carpeta cesta-clara-chrome; no hace falta desinstalar ni borrar datos.

Para instalar desde cero, activa Modo de desarrollador, pulsa Cargar descomprimida y elige la carpeta que contiene manifest.json.

En Tiendas → Actualizaciones y privacidad puedes activar un lote cada 15 minutos. El lote no arranca solo: hace falta un código postal, permiso de al menos una tienda y la casilla.

Una instalación nueva muestra la muestra del 29 de octubre de 2026. Un precio de más de 24 horas queda fuera del total y no declara una cesta ganadora.

Cada aviso recorre solo las tiendas ya autorizadas. Mercadona, Carrefour, Alcampo y Consum pueden abrir pestañas. Si una tienda bloquea la consulta, se agota el tiempo o Chrome retrasa la alarma, ese ciclo no renueva precios. Quince minutos es la programación, no una garantía de un precio nuevo.

Un intento sin permiso muestra su hora y dice que los precios no se renovaron. El catálogo marca los precios antiguos y no los usa en el total.

Esta versión no comprueba el micrófono físico, un carrito con sesión iniciada ni una compra. Lidl y ALDI no tienen cesta online de alimentación. No está en Chrome Web Store y la publicación es preliminar.

El servicio opcional no tiene autenticación y solo debe usarse en este equipo, en 127.0.0.1.

## Lista y marcas

1. Escribe un producto por línea, con cantidad.
2. Elige «¿Qué marcas prefieres?»: Cualquier marca, Marca blanca o Una marca concreta.
3. Si eliges una concreta, escribe su nombre.
4. Pulsa «Revisar y comparar» y responde a las dudas.
5. En cada producto puedes cambiar la preferencia de marca y pulsar «Aplicar marca».

Ejemplo:

```text
1 kg filete vacuno
4 l leche Pascual
```

La marca escrita en una línea prevalece sobre la preferencia general. Marca blanca no incluye automáticamente cualquier producto barato. Si falta evidencia de la marca, se indica y queda fuera del total.

## Compra por voz

1. Pulsa el botón grande «Dictar lista».
2. La primera vez se abre una pestaña de Cesta Clara. Pulsa «Permitir micrófono» y acepta el aviso de Chrome. La lista continúa ahí para empezar a dictar.
3. Di los productos con sus cantidades. Puedes separar con «siguiente producto» o «nueva línea».
4. Di «comparar». Si no has elegido marca, te preguntará: pulsa «Responder por voz» y di «marca blanca», «cualquier marca» o «marca Pascual».
5. Las dudas de cantidad o corte también se pueden contestar con «Responder por voz».
6. Con una cesta completa puedes decir «preparar cesta en DIA» o pulsar el botón de esa tienda.

Otros comandos: «deshacer» elimina el último producto; «detener dictado» para la escucha. Se reconocen como frases completas, para no confundir una descripción de producto con una orden. «4 litros de leche marca blanca» sigue siendo un producto.

El navegador puede procesar el audio por Internet. Cesta Clara guarda el texto, no el audio. Puedes desactivar «Leerme las preguntas» en «Qué puedo decir». El texto sigue siendo editable.

Si Chrome o Windows bloquean el micrófono, la página de permisos ofrece abrir los ajustes. Una política de organización puede requerir intervención del administrador. La extensión no cambia esos permisos automáticamente. Si una tienda aún no tiene permiso y la pides por voz, aparecerá «Permitir y preparar cesta»: Chrome requiere ese clic inicial.

## Comparar y preparar la cesta

«Consultar todos los supermercados» busca en las ocho cadenas autorizadas. «Actualizar precios» de una tienda solo recoge precios; sus pestañas de lectura sí se cierran al terminar.

La recomendación principal muestra el botón de preparación. Despliega «Ver precios y opciones» para las demás tiendas. Cuando una tienda tiene una cesta completa, pulsa «Preparar cesta en [tienda]». Se abre una pestaña visible que permanece abierta mientras se añaden las unidades previstas. Las cantidades de los SKU seleccionados se ajustan al total de tu lista, contando lo que ya había; pueden bajar si sobraban unidades. Los productos distintos se conservan.

Si aparece un aviso de cookies, zona o inicio de sesión, resuélvelo en la tienda. Vuelve al panel y pulsa «Ya está, continuar». El panel muestra productos preparados y pendientes; no da por añadido un producto sin confirmar la cantidad.

Repetir «Preparar cesta» retoma el trabajo anterior y recupera una pestaña cerrada. «Volver a comprobar cantidades» revisa de nuevo los objetivos de la lista sin acumular otra compra.

«Detener preparación» frena la tarea y conserva las adiciones ya hechas. Si cambias cantidades por tu cuenta durante la preparación, puede detenerse para pedir revisión. Los productos de peso variable o controles incompatibles pueden requerir añadirlos manualmente.

Al terminar, revisa el carro y su precio final en la tienda. Cesta Clara no tramita el pedido. Lidl y ALDI se mantienen como fuentes de precios anunciados en tienda física; no tienen integración de cesta online de alimentación.

## Límites de los datos

La búsqueda tiene límites de páginas y tiempo; la muestra no es un catálogo completo. La zona de entrega no está confirmada para todas las cadenas. Indica tu código postal y comprueba la cobertura en cada tienda. Los productos al peso indican importes aproximados; envío y disponibilidad se comprueban en origen.

Los precios de más de 24 horas, condicionados o fuera de vigencia no completan una cesta. Un error de consulta no renueva su fecha.

## Comprobaciones de esta revisión

Véase REVISION-0.9.1.md para el alcance de la revisión de privacidad. Se comprueba el flujo del panel y se ejecuta el código inyectado sobre páginas de prueba con carga y controles demorados. La prueba instalada y la captura con micrófono físico siguen pendientes; no se ha publicado en Chrome Web Store.

## Diagnóstico de una incidencia

Pulsa «Guardar diagnóstico» al pie del panel tras preparar o actualizar. Descarga un JSON con versión, estado de las ocho cadenas y pasos del carrito. No incluye nombres de productos, la lista, código postal, cuentas ni URLs de navegación. Si una tienda se cierra durante una adición, la preparación conserva esa adición pendiente hasta comprobar su cantidad.

## Acceso durante la preparación

Si una adición lleva al acceso de Carrefour, termina tú la identificación. Cesta Clara conserva el objetivo y la adición pendiente. Al regresar a la ficha o a MiCarrito, vuelve al producto, comprueba las unidades y continúa con leche, huevos y el resto de la lista. «Detener preparación» impide la reanudación automática. No actúa sobre formularios de acceso ni tramita el pedido.

## Carne por precio por kilo

La carne se selecciona por el menor €/kg de las opciones válidas revisadas en cada tienda, manteniendo marca, especie, corte y composición. Se muestra el número de opciones comparadas. El importe de la cesta sigue usando envases enteros: puede comprarse más peso del solicitado y se indica antes de preparar. No representa una búsqueda exhaustiva de todo el catálogo.

DIA: se reconoce su contador de tipo teléfono y sus botones en inglés. Tras resolver cookies o código postal, la preparación vuelve a comprobar la cantidad y continúa automáticamente. No acepta avisos por ti. Si un producto figura agotado, prepara los demás y deja la cesta incompleta, identificando lo que falta.

## Productos, envío y total

«Cómo quieres comprar» ofrece «A domicilio · incluir envío» y «En tienda física · solo productos». La modalidad se guarda con la lista. No se ha implementado recogida de pedidos online.

La comparación a domicilio incluye la tarifa estándar publicada de cada tienda y su mínimo de pedido. Despliega «Condiciones del envío» para comprobar la regla, las fuentes oficiales y su fecha. Alcampo Madrid y Eroski muestran un intervalo hasta elegir franja. Eroski desglosa también 0,60 € de bolsas. No se presuponen tarjetas, abonos ni promociones.

Un pedido por debajo del mínimo no tiene total con envío. Tampoco lo tiene una lista incompleta. Lidl y ALDI no se ofrecen como reparto de alimentación. Si dos intervalos se solapan no se anuncia una ganadora. En el reparto de una lista se cobra un envío por tienda y se comprueban los mínimos por separado.

Revisión de tarifas: 3 de noviembre de 2026; necesitan nueva revisión pasados 30 días. Cobertura local y franjas siguen pendientes de confirmar en la tienda. Los descuentos y otras líneas que existan en tu carrito pueden cambiar los umbrales y el importe final. Consulta REVISION-0.8.5.md.

## Consumo

Tiendas → Consumo de la extensión → Ver consumo. Muestra almacenamiento, peticiones, fallos, texto recibido y duración. Se actualiza a petición; no envía telemetría. Los datos del recolector no son el tráfico total de las pestañas. El diagnóstico descargable incluye el resumen.

Las consultas con navegador utilizan una página simultánea y las respuestas HTTP tienen presupuesto de bytes aplicado durante su lectura. La espera puede dejar consultas parciales. Para CPU y RAM reales usa Mayús + Esc en Chrome, contando Cesta Clara y las páginas de tiendas. Véase CONSUMO.md y REVISION-0.8.6.md.

## Panel rediseñado en 0.9

La voz y la escritura comparten la entrada. Elige marca y pulsa «Revisar y comparar». Al terminar, la edición se pliega para dejar paso a la comparación. «Editar lista» recupera el texto guardado. Si falta un detalle, la revisión se abre con la pregunta.

«Entrega y tiendas» reúne modalidad, código postal y cantidad de supermercados; el resumen visible indica qué opciones están aplicadas. Las ocho cadenas se muestran en una tabla abierta. En cada fila puedes desplegar «Ver desglose y opciones» para comprobar envío, fuentes, preparar la cesta o actualizar precios. Los mínimos de pedido se indican también en la fila.

El nuevo aspecto no amplía la compatibilidad de los carritos ni cambia los precios recogidos. El permiso de micrófono utiliza el mismo flujo y una página con la misma estética. Véase REVISION-0.9.1.md para alcance y verificación.

## Privacidad y borrado

Las instalaciones nuevas piden el código postal sin preseleccionar una zona. Tiendas → Actualizaciones y privacidad → Borrar mis datos locales permite eliminar borrador, zona, precios consultados, estado del trabajo y métricas. Se detiene la preparación y se reinicia Cesta Clara. No modifica los carritos, cuentas o permisos de las tiendas. Consulta PRIVACY.md para datos, destinos y conservación.
