import {test} from 'node:test';
import assert from 'node:assert/strict';
import {parseVoiceIntent} from '../extension/voice-intent.js';

test('Los comandos finales explícitos terminan la lista y piden comparar', () => {
 for (const command of ['terminar', 'LISTO.', 'comparar!', ' fin de lista… ']) {
  assert.deepEqual(parseVoiceIntent(command), {type:'compare'}, command);
 }
});

test('Parar el dictado no equivale a comparar ni preparar una cesta', () => {
 for (const command of ['parar', 'Detener dictado.']) {
  assert.deepEqual(parseVoiceIntent(command), {type:'stop'});
 }
 assert.deepEqual(parseVoiceIntent('deshacer'), {type:'undo'});
 assert.deepEqual(parseVoiceIntent('Borra el último producto.'), {type:'undo'});
});

test('La preferencia general distingue marca blanca, cualquier marca y una marca concreta', () => {
 for (const text of ['marca blanca', 'prefiero marca blanca', 'Prefiero la marca blanca.']) {
  assert.deepEqual(parseVoiceIntent(text), {type:'brand', value:{mode:'private'}});
 }
 for (const text of ['cualquier marca', 'Prefiero cualquier marca.']) {
  assert.deepEqual(parseVoiceIntent(text), {type:'brand', value:{mode:'any'}});
 }
 assert.deepEqual(parseVoiceIntent('marca Pascual'), {type:'brand', value:{mode:'specific',name:'Pascual'}});
 assert.deepEqual(parseVoiceIntent('Prefiero la marca Central Lechera Asturiana.'), {type:'brand', value:{mode:'specific',name:'Central Lechera Asturiana'}});
 assert.deepEqual(parseVoiceIntent('marca Solán de Cabras'), {type:'brand', value:{mode:'specific',name:'Solán de Cabras'}});
});

test('Preparar una cesta exige una orden explícita y una de las ocho tiendas conocidas', () => {
 const stores = ['Mercadona','DIA','Carrefour','Alcampo','Lidl','ALDI','Eroski','Consum'];
 for (const store of stores) {
  assert.deepEqual(parseVoiceIntent('Preparar cesta en '+store+'.'), {type:'store',value:store});
 }
 assert.deepEqual(parseVoiceIntent('prepara la cesta en día'), {type:'store',value:'DIA'});
});

test('Una preferencia dentro de un producto no modifica la marca de toda la lista', () => {
 for (const text of ['4l leche marca blanca', 'Un litro de aceite de oliva', '4 litros de leche marca Pascual', '1 kg carne, prefiero marca blanca']) {
  assert.deepEqual(parseVoiceIntent(text), {type:'text',value:text});
 }
});

test('Órdenes ambiguas, nombres desconocidos o acciones adicionales permanecen como texto', () => {
 for (const text of ['terminar con dos yogures','listo para comer','preparar cesta en una tienda','preparar cesta en Mercadona y comprar','compra en DIA','marca','prefiero la marca que sea más barata','marca Pascual o Puleva','aceite de marca','¿Qué marca prefiero?']) {
  assert.deepEqual(parseVoiceIntent(text), {type:'text',value:text});
 }
});

test('El texto literal se conserva sin normalizar cantidades, acentos o porcentajes', () => {
 const text = '  Un kilo de ternera picada, mínimo 97 % de carne.  ';
 assert.deepEqual(parseVoiceIntent(text), {type:'text',value:text});
 assert.deepEqual(parseVoiceIntent(''), {type:'text',value:''});
});
