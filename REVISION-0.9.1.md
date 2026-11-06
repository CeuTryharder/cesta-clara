# Revisión 0.9.1 · preparación para código abierto

- Licencia MIT para el código original, avisos sobre materiales externos, instrucciones de contribución, seguridad y privacidad.
- La muestra pública conserva precios y fechas pero elimina zonas de las sesiones. Las instalaciones nuevas piden el código postal; las existentes conservan su preferencia local.
- El MCP escribe nuevas observaciones en `runtime/`, separado del catálogo distribuido. La compilación rechaza metadatos privados en la muestra.
- Compilación reproducible en `dist/extension`, sin rutas del equipo ni configuración personal del hosting.
- Diagnóstico con esquema cerrado: descarta campos desconocidos, URLs, texto libre y mensajes antiguos. No exporta listas, códigos postales ni cuentas.
- Borrado desde Tiendas: detiene la preparación, elimina datos locales y alarmas y reinicia la extensión. No modifica la sesión o el carrito del supermercado.
- Comprobación de archivos e historial antes de publicar, reglas de exclusión y validación automática en CI. La copia destinada a publicación tiene un historial nuevo; no hereda commits privados.

La comprobación automatizada cubre regresiones del motor, panel, voz, scraping y carritos simulados, más las fronteras de privacidad. No es una auditoría independiente ni una verificación de todos los carritos autenticados. No se modifica ni publica el servicio alojado anterior.
