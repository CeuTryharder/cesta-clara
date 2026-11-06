# Revisión 0.8.3 · 3 de noviembre de 2026

La grabación aportada muestra dos pausas: Alcampo no consigue leer el contador del primer producto; Carrefour añade un envase y deriva al acceso. Tras identificarse, el usuario termina en `/MiCarrito`, pero la preparación anterior no se reanudaba por sí sola. Permanecían pendientes la cantidad restante del primer producto, la leche y los huevos.

## Cambios

- Una pausa causada por el acceso tiene estado explícito `session`. Se vigila la finalización de la navegación en la pestaña de ese trabajo, con los permisos de tienda ya concedidos.
- Al regresar a una ficha pública legible o a una ruta de cesta del mismo comercio, se reanuda el trabajo guardado. Se incluye `/MiCarrito`, observado en la grabación. No se ejecuta código en páginas de acceso, cuentas o pago.
- Se comprueba el contador antes de continuar una adición pendiente. La cantidad objetivo se conserva: no se vuelve a añadir todo el primer producto.
- Se recupera también el caso en que el acceso termina antes de que se guarde la pausa. El panel sigue observando el trabajo y muestra «Esperando tu acceso» con la instrucción específica.
- Detener la preparación impide la reanudación automática.
- La lectura conserva el contenedor completo del producto. Ya no recorta el ámbito al pequeño contenedor del primer botón con nombre y pierde el contador que queda fuera.
- Los botones equivalentes de la ficha y la barra fija se tratan como copias del mismo control. Solo se pulsa uno; si los contadores duplicados discrepan, se espera su sincronización.

## Pruebas

Se añadieron pruebas de cesta completa con filetes, leche y huevos. Ejecutan la función serializada de producción sobre DOM de prueba, registran cada clic y comprueban las cantidades de los tres productos. Los dos casos principales fallaban contra la 0.8.2: controles duplicados y reanudación del acceso.

La prueba de Carrefour simula una primera unidad añadida antes de la redirección, una navegación de acceso que no debe activar la preparación, el regreso a MiCarrito y la finalización de la cantidad pendiente y de los otros productos. Se comprueba también que cancelar impide seguir al volver del acceso.

Se prueban por separado un contador fuera del contenedor de los botones y copias de contador que todavía no concuerdan.

194 pruebas automáticas aprobadas. Se valida la construcción de extensión y Worker, el formato ESM y los ZIP. La lista de Carrefour incluye el mínimo de compra de seis bricks y comprueba que se consigue con una adición de ese pack.

## Límite de verificación

La comprobación adicional del producto real de Alcampo mediante navegador no se ejecutó: la revisión automática de aprobación falló por falta de capacidad del modelo verificador. No fue una determinación de inseguridad. No se intentó eludir la revisión.

La grabación confirma las pausas, pero no proporciona el DOM de los controles. El arreglo del contador está verificado en los casos reproducidos; sigue pendiente comprobar esos controles en la instalación del usuario. La prueba de reanudación no equivale a haber completado una compra real con su cuenta.
