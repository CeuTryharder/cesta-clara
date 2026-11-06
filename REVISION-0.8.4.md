# Revisión 0.8.4 · 3 de noviembre de 2026

## Fallo reproducido en DIA

La nueva grabación muestra DIA pausado después del primer producto y del aviso de cookies. Esta vez se inspeccionó la ficha real en el navegador disponible. Sus controles tras añadir usan `aria-label="remove one unit"`, un `input type="tel"` con `aria-label="add to cart input"` y `data-test-id="add2cart-mix-button-input"`, y el botón `aria-label="add one unit to cart"`. La 0.8.3 no reconocía correctamente el campo ni el incremento inglés. Las pruebas anteriores utilizaban controles que no reproducían este detalle real.

Se reconocen los controles observados y se mantiene la comprobación de cantidad tras cada adición. Las pausas por cookies, selector de CP o avisos se marcan como intervención pendiente y se vuelven a comprobar: al desaparecer el aviso y poder leer el producto, se retoma la preparación. No se aceptan cookies ni se rellenan formularios automáticamente. Detener sigue impidiendo reanudar.

## Precio por kilo

Antes se elegía, dentro de cada cadena, el menor coste total de los envases necesarios. Para carne ahora prevalece el menor €/kg. Los empates se resuelven por importe, número de envases e identificador estable, independientemente del orden de descubrimiento.

La comparación sigue filtrando por marca, especie, corte, composición, disponibilidad, vigencia y ausencia de promociones condicionadas. No se elige otra marca para conseguir una tarifa menor cuando se ha pedido marca blanca o una marca concreta.

Se muestran €/kg, candidato elegido, número de opciones válidas y cantidad real por envases. El total de la cesta suma los envases necesarios; una opción con menor €/kg puede suponer un desembolso mayor por el formato. La afirmación se limita a las opciones revisadas, no a todo el catálogo del supermercado.

Se cambia la clave de comparación para renovar la búsqueda con el nuevo criterio. Una preparación anterior conserva su objetivo si selecciona los mismos productos y cantidades, evitando añadir una segunda compra completa. Si el criterio selecciona otro producto y ya había adiciones, se pide revisar lo ya añadido antes de comenzar otra preparación.

Los precios por docena se convierten mediante precio y cantidad del envase para mostrarse por huevo, en lugar de etiquetarse erróneamente como €/unidad.

## Agotados y cesta parcial

En la comprobación real con CP zona de prueba los dos formatos de huevos M consultados mostraban «Agotado». El botón conservaba `aria-label="add to cart button"` y no tenía el atributo HTML `disabled`; la información visible era decisiva. Se detecta ese estado y se conserva el stock cero explícito del catálogo público de DIA.

Si se encuentra un producto agotado antes de añadirlo, se omite su adición, se preparan los restantes y se informa del número realmente preparado. No se marca una cesta incompleta como completada ni se tramita el pedido.

## Evidencia y límites

205 pruebas automáticas aprobadas. Incluyen los controles de DIA observados, tres productos con continuación tras cookies, cancelación durante la espera, agotados, migración de la preparación anterior y selección por €/kg con formatos que contradicen la ordenación por coste total.

En la web real de DIA se añadieron y comprobaron tres envases de filetes de 420 g y cuatro litros de leche, con subtotales visibles 23,94 € y 3,84 €. La captura `cesta-clara-prueba-dia-084.png` en outputs muestra cantidades 3 y 4. No se añadieron huevos porque los formatos M consultados estaban agotados; no se confirmó un pedido.

Esta comprobación de controles y respuesta del comercio se realizó mediante acciones del navegador disponible. No equivale a haber ejecutado la extensión instalada en el Chrome del usuario. Las pruebas automatizadas sí ejecutan su controlador y función inyectada de producción sobre DOM de prueba basado en los controles observados. La evidencia distingue ambas cosas.

Se validan construcción de extensión, Worker ESM, consistencia entre fuente y carpeta distribuida y ZIP. Se conserva el límite de cobertura de fuentes y zonas de revisiones anteriores.
