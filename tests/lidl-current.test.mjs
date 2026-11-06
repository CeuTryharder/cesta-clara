import {test} from 'node:test';import assert from 'node:assert/strict';import {readFile} from 'node:fs/promises';
import {parseRetailHtml} from '../collectors/retail-html.js';
import {queryTargets} from '../collectors/catalog-index.js';
import {parseList} from '../engine.js';
const context={store:'Lidl',url:'https://www.lidl.es/c/frescos-carne/s10089402',observedAt:'2026-11-03T08:00:00Z',hash:'public-fixture',requestedPostcode:'28001'};
test('La búsqueda de carne usa la categoría estable y evita la campaña caducada',()=>{const urls=queryTargets('Lidl',parseList('1 kg filetes de vacuno').items);assert.ok(urls.includes(context.url));assert.ok(!urls.some(u=>u.endsWith('a10092771')));});
test('Los precios exclusivos Lidl Plus actuales se recogen como condicionados y se ignoran ofertas futuras',async()=>{
 const html=await readFile(new URL('./fixtures/lidl-meat-20261103.html',import.meta.url),'utf8'),rows=parseRetailHtml(html,context).observations;
 assert.equal(rows.length,2);assert.ok(rows.every(r=>r.conditionalPrice===true));assert.deepEqual(rows.map(r=>r.priceCents).sort(),[349,359]);assert.ok(!rows.some(r=>r.storeProductId==='11137530'));
});
