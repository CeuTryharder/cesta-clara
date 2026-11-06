# Privacidad de Cesta Clara

Revisión: 6 de noviembre de 2026 · versión 0.9.4.

## Extensión de Chrome

La interpretación y la comparación se ejecutan localmente. No hay cuenta de Cesta Clara, analítica remota, anuncios ni sincronización con nuestros servidores. No enviamos la lista a un modelo de IA.

`chrome.storage.local` conserva el borrador, respuestas, marcas, código postal, preferencias, precios y consultas recientes, histórico por producto, estado de preparación del carrito y contadores de consumo. Ese almacenamiento pertenece al perfil de Chrome y no se sincroniza mediante `chrome.storage.sync`. No ofrece cifrado adicional de Cesta Clara: quien tenga acceso al perfil del equipo puede acceder a los datos. No escribas contraseñas ni datos de pago en la lista.

Solo los contextos de confianza de la extensión tienen acceso al almacenamiento. No se solicita permiso para leer cookies, historial general o contraseñas. No se instala un script que observe todas las páginas: se inyectan lectores o controles en las pestañas de supermercado creadas para la operación autorizada.

## Qué sale del equipo

- Scraping HTTP: peticiones a los ocho dominios autorizados; omiten cookies. La tienda ve los datos normales de una conexión, incluida la IP. Los productos buscados pueden formar parte de una URL de consulta.
- Pestañas de supermercado: usan la sesión normal de esa tienda. El sitio puede usar sus cookies, su cuenta y su política de privacidad. Cesta Clara lee información de producto y cantidades de los SKU seleccionados para preparar la compra; no recoge los formularios de acceso o pago.
- Voz: se activa a petición. El reconocimiento del navegador puede enviar audio a su proveedor por Internet. Cesta Clara guarda el texto del borrador, no graba ni guarda el audio. La lectura en voz alta usa el motor de voz seleccionado por el navegador, que también puede depender de un servicio externo.
- Preparar cesta cambia cantidades en la tienda elegida. No confirma pedidos ni paga.
- Si activas la actualización automática, cada 15 minutos y con Chrome abierto se consulta en un solo lote las tiendas ya autorizadas. No arranca sola: hace falta tu código postal, un permiso de tienda y la casilla correspondiente.

## Borrado y conservación

En **Tiendas → Actualizaciones y privacidad → Borrar mis datos locales**, confirma **Borrar y reiniciar**. Detiene la preparación de Cesta Clara, desactiva sus actualizaciones y borra el almacenamiento local completo. Espera si hay una consulta en marcha. La extensión se reinicia para que los paneles anteriores no vuelvan a guardar el borrador borrado. Al abrirla se carga otra vez la muestra pública, sin tu código postal.

No borra sesiones, carritos, pedidos, permisos de Chrome, diagnósticos ya descargados ni datos de otro cliente MCP. Puedes retirar los permisos desde los detalles de la extensión en Chrome. Las métricas recientes se limitan a diez operaciones, las consultas a treinta y el histórico a veinte observaciones por SKU; la cantidad de SKU puede crecer. El resto se conserva hasta borrarlo o desinstalar.

## Diagnóstico

Se descarga únicamente al pulsar **Guardar diagnóstico**; no se envía automáticamente. Incluye versión, fechas, cadenas, contadores, estados y códigos de eventos de una lista cerrada. No incluye la lista, nombres de productos, código postal, URLs, cuentas, mensajes técnicos completos ni campos adicionales guardados por versiones anteriores. Aun así revela horas de uso y tiendas: revisa el archivo antes de compartirlo.

## MCP y servidor opcional

El MCP por stdio usa `runtime/snapshot.json` y `runtime/prices.sqlite`, fuera de Git y de los paquetes públicos. La muestra distribuida permanece intacta. El cliente/agente que conectes recibe la lista y los resultados que le proporciones; su tratamiento depende de ese cliente. Detén el MCP antes de borrar su carpeta `runtime/` si quieres eliminar sus datos locales.

El Worker HTTP es un componente opcional: no está conectado desde la extensión ni se despliega por compilar el proyecto. Quien lo aloje debe configurar autenticación, límites y registros adecuados. El código no incorpora credenciales ni una cuenta de hosting. No debe publicarse una instantánea local como catálogo del servidor.

## Fuentes técnicas

- [Almacenamiento de extensiones en Chrome](https://developer.chrome.com/docs/extensions/reference/api/storage).
- [Reconocimiento de voz y procesamiento remoto](https://developer.mozilla.org/en-US/docs/Web/API/SpeechRecognition).
