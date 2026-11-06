# Contribuir

Usa Node.js 24. Ejecuta `npm ci` y `npm test`; las pruebas compilan el Worker y la extensión en `dist/`. Carga `dist/extension` desde Chrome para probarla. No publiques un resultado como comprobado en una tienda real si solo has usado fixtures.

Antes de un PR ejecuta también `npm run check:public`, `node scripts/validate-artifact.mjs` y `npm audit`. Incluye un ejemplo mínimo y ficticio para reproducir un fallo. Conserva cantidad, marca, corte, especie y composición de las peticiones; nunca completes una cesta con precios inventados o antiguos.

No adjuntes datos de tu perfil, tokens, configuraciones de hosting, capturas de cuentas, diagnósticos reales o la carpeta `runtime`. El borrado de archivos privados debe revisarse también en el historial, no solo en la versión final. Puedes configurar `user.email` solo para este repositorio con la dirección `noreply` que proporciona GitHub.

Las contribuciones al código original se ofrecen bajo MIT. Mantén avisos y licencias de los componentes externos. Consulta `SECURITY.md` para incidencias sensibles.
