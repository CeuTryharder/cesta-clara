import {test} from 'node:test';
import assert from 'node:assert/strict';
import {friendlyIssue,issueCode} from '../extension/feedback.js';
test('Un bloqueo de Carrefour se explica sin volcar la respuesta técnica',()=>{
 const raw='Error: HTTP 403 Forbidden <html>'+('Access denied '.repeat(100))+'</html>';
 const message=friendlyIssue(raw,'Carrefour');assert.match(message,/Carrefour no ha permitido/);assert.ok(message.length<150);assert.doesNotMatch(message,/403|html|Error/);assert.equal(issueCode(raw),'blocked');
});
test('Una pestaña inexistente ofrece una recuperación comprensible',()=>{assert.match(friendlyIssue('No tab with id: 2106990654'),/Continuar/);assert.doesNotMatch(friendlyIssue('No tab with id: 2106990654'),/2106990654/);});
test('Mantiene instrucciones concretas y no muestra HTML o trazas desconocidas',()=>{assert.equal(friendlyIssue('Indica la cantidad y su unidad.'),'Indica la cantidad y su unidad.');assert.ok(friendlyIssue('<script>broken</script>').length<200);assert.doesNotMatch(friendlyIssue('<script>broken</script>'),/<script>/);});
