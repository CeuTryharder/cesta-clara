# Cesta Clara 0.8.6 — consumo

Tiendas → Consumo de la extensión → Ver consumo ofrece una medición local a petición. Registra lecturas HTTP, fallos, bytes UTF-8 de texto aceptado, páginas de consulta y diez duraciones recientes. Los agregados se guardan al terminar una comparación/búsqueda/actualización; no hay envío de telemetría ni temporizador nuevo. El dato de almacenamiento procede de `chrome.storage.local.getBytesInUse`, cuando está disponible.

Los bytes del recolector no incluyen imágenes, scripts, vídeos, compresión HTTP, cabeceras ni tráfico de páginas, voz o cesta. No equivalen a la factura de datos ni al tráfico total de Chrome. Los contadores empiezan con esta versión; una operación interrumpida por cierre del worker puede no quedar registrada. No contienen lista, direcciones, URLs ni cuentas. El número de páginas excluye el carrito del usuario.

Las consultas con navegador pasan por una cola de una página simultánea. Se conservan los límites de tiempo: esperar turno puede dar una consulta parcial, que se muestra como tal. Las cadenas HTTP siguen pudiendo consultarse en paralelo. El límite no cubre pestañas abiertas por el usuario ni la preparación de su carrito.

CPU y RAM del navegador no se infieren con números inventados. Se inspeccionan en el administrador de tareas de Chrome, incluyendo Cesta Clara y las páginas que abre. `node --expose-gc scripts/benchmark.mjs` mide por separado el cálculo determinista, sin red y con el reloj fijado a la muestra; sus cifras no representan el consumo de la extensión instalada.

Validación: `npm test`, 230 pruebas aprobadas sin fallos ni omisiones. Incluyen cola de tres cadenas sin solapamiento, cierre fallido, cancelación de respuestas excesivas, límites UTF-8, contadores locales, persistencia y lectura a petición en el panel. `node scripts/validate-artifact.mjs`: Worker ESM válido con `default.fetch`. CPU/RAM de la extensión instalada aún no se han medido.

Se aplica un presupuesto de bytes mientras se reciben respuestas HTTP, con cancelación de respuestas excesivas y cuerpos de error. CONSUMO.md recoge el análisis y el benchmark reproducible.
