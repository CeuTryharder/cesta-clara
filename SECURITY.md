# Seguridad

Se mantienen las correcciones en la última versión 0.9.x. Las integraciones con supermercados dependen de sus páginas y pueden necesitar ajustes.

## Comunicar una vulnerabilidad

Si el repositorio tiene habilitado **Security → Report a vulnerability**, usa ese canal privado. Si no aparece, abre únicamente una incidencia solicitando un canal privado, sin incluir la vulnerabilidad, datos personales, credenciales, capturas de cuentas ni diagnósticos. No publiques pruebas de explotación o secretos en issues.

## Límites de confianza

- Las páginas de tiendas, resultados de scraping, argumentos del MCP y borradores son entradas no confiables. Los enlaces se validan por cadena, la interfaz usa texto y la extensión impide código remoto.
- Mensajes del navegador: solo se aceptan del mismo identificador y origen de extensión. No existe comunicación externa habilitada.
- Permisos de las ocho tiendas opcionales; no se solicitan cookies ni acceso general al navegador. Las peticiones HTTP usan `credentials: omit` y rechazan redirecciones.
- La preparación verifica cantidades, no envía formularios de acceso ni finaliza pedidos. Una intervención o un bloqueo no se evita automáticamente.
- El servidor HTTP opcional necesita protección del operador antes de exponerlo a Internet; el servidor de desarrollo escucha en loopback. El MCP stdio no abre un puerto de red.

## Antes de contribuir o publicar

Ejecuta `npm ci`, `npm test`, `npm run check:public` y `npm audit`. No incluyas `runtime/`, `.env`, perfiles de navegador, cookies, HAR, capturas, grabaciones o diagnósticos reales. Usa ejemplos sintéticos y una identidad Git con correo `noreply` si quieres mantener privado tu correo.

El comprobador de publicación busca patrones de credenciales y metadatos personales y rechaza archivos privados versionados; no demuestra ausencia de todas las vulnerabilidades. Una revisión local y pruebas automáticas no sustituyen una auditoría independiente.

Si se publica un secreto, revócalo o rótalo primero. Borrarlo en un commit nuevo no lo elimina del historial: sigue el [procedimiento de GitHub](https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/removing-sensitive-data-from-a-repository). Una copia nueva debe crearse sin el directorio `.git` del desarrollo privado.
