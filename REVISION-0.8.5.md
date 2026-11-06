# Cesta Clara 0.8.5

## Envío en la comparación

Por defecto se compara entrega a domicilio, sumando productos y gastos estándar. Se puede elegir compra presencial, que muestra solo productos: no significa recogida de pedidos online. Cada tienda ofrece desglose, condiciones, fuentes oficiales y fecha de revisión. Las tarifas fueron revisadas el 3 de noviembre de 2026. No se verifica cobertura local ni disponibilidad de franjas con estas reglas públicas; los precios siguen siendo de referencia.

| Tienda | Regla estándar utilizada |
| --- | --- |
| DIA | 4,99 €; gratis desde 100 € después de descuentos. |
| Mercadona | 8,20 €; mínimo de productos de 60 €. Por debajo no se anuncia total contratable. |
| Carrefour | 3,99 €; gratis por encima de 140 € después de descuentos. Las páginas oficiales discrepan en exactamente 140 €: se conserva un intervalo de 0–3,99 €. |
| Alcampo | Madrid: 0,99–5,99 € según franja desde el día siguiente. La FAQ publica 3,99–5,99 €; se mantiene el intervalo amplio y se exige confirmar la franja. Nacional: referencia de 7 €, sujeta a cobertura. |
| Eroski | 3,95–6,95 € según franja, más 0,60 € de bolsas. No presupone tarjeta de crédito, categoría promocionada ni ventajas de socios. |
| Consum | 7 € por debajo de 60 €; 4 € desde 60 €. Cobertura sin verificar. |
| Lidl y ALDI | Sin cesta online de alimentación compatible. No se anuncian como reparto gratis. |

Fuentes y fecha se guardan en `delivery.js` y se muestran desde «Condiciones del envío». No se aplican abonos, cupones, promociones condicionadas ni entrega urgente. A los 30 días las tarifas requieren revisión y dejan de utilizarse para declarar un total con envío. Los subtotales incompletos nunca se convierten en totales de compra.

La selección de una cesta considera el total con envío. Si los intervalos se solapan no se declara ganadora. En una alternativa de dos tiendas se calculan dos pedidos, cada uno con su envío, umbral y mínimo; esa alternativa usa las selecciones de productos observadas, sin garantizar una optimización exhaustiva de todas las combinaciones posibles.

MCP `calcular_cesta` admite `modalidad: domicilio | presencial` y entrega el mismo desglose, fuentes, mínimos y rangos que Chrome.

## Cantidades y acceso a la tienda

Preparar la lista ahora ajusta cada SKU seleccionado a la cantidad final solicitada, contando lo que ya había. Puede incrementar o reducir la línea seleccionada; conserva productos distintos. Las preparaciones antiguas se migran y vuelven a comprobar sus objetivos. Una escritura sin confirmación sigue pendiente: no se repite a ciegas.

En Alcampo se detecta el acceso pendiente antes de intentar añadir. Si una petición de acceso interceptó una adición anterior, tras identificarse se vuelve a leer la cantidad para continuar. La prueba previa en navegador reprodujo el aviso real de acceso, pero no verificó una cesta completa con sesión iniciada. Las pruebas automatizadas cubren ese flujo con el código de inyección serializado; no sustituyen una comprobación de extremo a extremo en el Chrome del usuario.

El precio visible de DIA puede aparecer en el estado de preparación, junto con las cantidades inicial y final. El subtotal de fichas solo se anuncia si todos los precios pudieron verificarse. Otros productos del carrito, descuentos y gastos se comprueban finalmente en la tienda.

## Validación

`npm test`: 222 pruebas aprobadas, sin fallos ni omisiones. Incluyen umbrales a ambos lados y en el límite, intervalos, mínimos, gastos por dos pedidos, selección con envío, listado incompleto, persistencia de modalidad, MCP y regresiones de cantidades/acceso. `node scripts/validate-artifact.mjs`: Worker ESM válido con `default.fetch`. El ZIP se comprueba antes de publicar. No se ha verificado esta versión instalada en el Chrome del usuario ni se han finalizado compras.
