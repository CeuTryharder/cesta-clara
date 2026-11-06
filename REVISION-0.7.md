# Revisión 0.7 · 29 de octubre de 2026

## Micrófono

El panel lateral intentaba iniciar SpeechRecognition sin obtener previamente el permiso del origen de la extensión. Se añade microphone.html: una pestaña normal de Cesta Clara solicita audio mediante getUserMedia al pulsar «Permitir micrófono» y detiene todas las pistas inmediatamente. Después se vuelve al panel y se pulsa «Dictar lista».

La solución sigue la [explicación del equipo de extensiones de Chromium](https://groups.google.com/a/chromium.org/g/chromium-extensions/c/V09VMCLzvWM/m/n9SeKFb5AQAJ): el permiso está vinculado al origen chrome-extension y debe pedirse desde una superficie capaz de mostrar el aviso. No se añade un permiso de manifiesto inventado ni se cambia la configuración del navegador automáticamente.

La página explica errores de Chrome, Windows o políticas de organización y permite abrir los ajustes. El reconocimiento puede usar Internet. Cesta Clara conserva texto del borrador, no audio. La captura con un micrófono físico en el Chrome del usuario aún no se ha comprobado.

## Preparar la cesta

«Consultar esta tienda» era una recogida de precios: creaba pestañas de lectura y las cerraba. Ahora se distinguen:

- «Actualizar precios»: lectura de las fuentes con pestañas temporales.
- «Preparar cesta en [tienda]»: abre una pestaña visible y la conserva; intenta añadir los productos seleccionados a través de los botones del comercio.

Se requiere una cesta completa con coincidencias recientes. El servicio calcula el plan desde la instantánea, no acepta URLs o productos arbitrarios enviados por el panel. Usa las cantidades de cada formato y mínimos de compra: seis bricks de Carrefour se trasladan como seis unidades, no como una.

Solo pulsa controles de añadir o incrementar del producto principal. Evita recomendaciones, cuentas y pago. Comprueba el contador después de cada pulsación. Si un incremento no se confirma, una ficha no se identifica, hay un aviso o se necesita sesión, pausa y deja abierta la tienda.

El trabajo se guarda con cantidades iniciales y objetivos. «Continuar tras revisar la tienda» vuelve a comprobarlas. Doble clic, reapertura del panel y consulta del mismo trabajo no vuelven a añadir una cesta completada. Un servicio interrumpido ofrece reanudar. «Detener preparación» conserva lo que ya se añadió.

La automatización no tramita pedidos. Las cestas de alimentación de las fuentes consultadas de Lidl y ALDI no están integradas; se muestran como compra en tienda física.

## Marcas

El formulario pregunta «¿Qué marcas prefieres?» con Cualquier marca, Marca blanca o Una marca concreta. Es obligatorio elegir antes de comparar. Puede cambiarse por producto en la lista revisada.

Las marcas escritas en la línea prevalecen sobre la preferencia general. Una marca específica se comprueba contra el nombre o campo marca de la ficha. Marca blanca exige una correspondencia conocida con la cadena; una marca desconocida no se clasifica como blanca por ser barata.

La selección se guarda en el borrador, participa en la clave de caché y se aplica a coincidencias y búsqueda. El descubrimiento de una marca concreta no la elimina de la búsqueda de fichas. Se mantiene el resto de condiciones: formato, cantidad, especie, corte y composición.

MCP local: calcular_cesta acepta preferencia_marca (cualquiera, blanca, concreta) y marca. El MCP alojado no se ha desplegado y continúa en 0.4.

## Pruebas

139 pruebas automáticas aprobadas. Incluyen marca específica, marca blanca, preferencias por línea, preguntas del panel, descubrimiento, micrófono y parada de pistas, carrito, mínimos de compra, cantidades existentes, doble clic, fallo de confirmación e interrupción del servicio.

Prueba real mediante controles del navegador en Mercadona: se añadieron y comprobaron cuatro bricks de leche de un litro; contador final 4 unidades. No se tramitó pedido. La captura está en el archivo cesta-clara-prueba-carro-07.jpg de outputs. Esta prueba valida el flujo del comercio y sus controles; no equivale a una prueba completa de la extensión instalada.

Alcampo mostró su petición de inicio de sesión al añadir. No se completó una cesta real en esa fuente. La compatibilidad con los otros carritos necesita validación con las sesiones de sus tiendas: la extensión pausa cuando no puede verificar el estado, en lugar de indicar que todo se añadió.

Se validan Worker, construcción de extensión y contenido de ZIP. La prueba completa dentro del Chrome instalado y el micrófono físico siguen pendientes. No se garantiza funcionamiento uniforme en carritos cambiantes, productos al peso con controles incompatibles o fuentes que exigen autenticación.
