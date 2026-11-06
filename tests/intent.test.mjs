import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {parseList,splitShoppingList} from '../engine.js';
import {compareObserved} from '../observed.js';
import {meatComposition,matchRequest} from '../matching.js';
import {parseDiaDetail,discoveryPlan,discoverDia} from '../collectors/discovery.js';
const now=Date.parse('2026-10-29T13:00:00Z'),input={postcode:'28001',fulfillment:'store',acceptAlternatives:true},base={observations:[],maxAgeHours:24};
const observation=(store,percent,overrides={})=>({store,storeProductId:'beef-'+percent,name:'Carne de ternera picada 500 g',ingredients:percent===null?null:'Carne de ternera ('+percent+'%), agua y sal.',packageQuantity:.5,packageUnit:'kg',priceCents:500,unitPriceCents:1000,conditionalPrice:false,availability:'unknown',observedAt:new Date(now).toISOString(),productUrl:store==='DIA'?'https://www.dia.es/carnes/p/123':'https://tienda.mercadona.es/product/123/ternera',...overrides});
test('La frase original conserva cantidad, especie, corte y mínimo 97 sin separar la coma',()=>{
 for(const text of ['un kilo de ternera picada, 97% carne o más','Quiero un kilo de ternera picada con un 97 % de carne como mínimo','1 kg de carne de ternera molida, que tenga al menos 97% de carne']){
  const d=parseList(text);assert.equal(d.requests.length,1,text);assert.equal(d.pending.length,0,text);assert.equal(d.items[0].quantity,1);assert.equal(d.items[0].unit,'kg');assert.equal(d.items[0].constraints.minimumMeatPercent,97);assert.equal(d.items[0].constraints.cut,'picada');
 }
});
test('Nunca transforma 97% en 97 kilos y admite medios kilos y números escritos',()=>{const d=parseList('ternera picada 97% carne');assert.equal(d.requests[0].quantity,null);assert.equal(d.clarifications[0].field,'quantity');assert.equal(parseList('medio kilo de ternera picada').items[0].quantity,.5);assert.equal(parseList('dos kilos de ternera picada').items[0].quantity,2);});
test('Una ternera sin corte pide aclaración y sigue presente',()=>{
 const text='un kilo de ternera, 97% carne o más',first=parseList(text);assert.equal(first.items.length,0);assert.equal(first.requests.length,1);assert.equal(first.clarifications[0].field,'cut');
 const resolutions={[first.requests[0].lineId]:{cut:'picada'}},second=parseList(text,{resolutions});assert.equal(second.items.length,1);assert.equal(second.items[0].quantity,1);assert.equal(second.items[0].constraints.minimumMeatPercent,97);
});
test('Las preguntas encadenadas no pierden el requisito entre especie y corte',()=>{
 const text='un kilo de carne, 97% carne o más',a=parseList(text),id=a.requests[0].lineId;
 assert.equal(a.clarifications[0].field,'species');const b=parseList(text,{resolutions:{[id]:{species:'ternera'}}});assert.equal(b.clarifications[0].field,'cut');
 const c=parseList(text,{resolutions:{[id]:{species:'ternera',cut:'picada'}}});assert.equal(c.pending.length,0);assert.equal(c.items[0].constraints.minimumMeatPercent,97);
});
test('No omite productos desconocidos ni los presenta como una compra de cero euros',()=>{
 const d=compareObserved({...input,text:'1 kg de brócoli\n1 kg de ternera picada, 97% carne o más'},base,now);assert.equal(d.requests.length,2);assert.equal(d.items.length,2);assert.equal(d.productComparisons.length,2);assert.equal(d.complete,false);assert.equal(d.winner,null);assert.equal(d.pending.length,2);
});
test('97% es un mínimo: acepta 97, 98 y 100; rechaza 96,9 y composición ausente',()=>{
 const item=parseList('1 kg ternera picada 97% carne').items[0];
 for(const percent of [97,98,100])assert.equal(matchRequest(item,observation('DIA',percent)).status,'match',percent);
 assert.equal(matchRequest(item,observation('DIA',96.9)).status,'different');
 assert.equal(matchRequest(item,observation('DIA',null)).status,'unverified');
});
test('No usa proteínas, grasas, rótulos promocionales ni el 100% del nombre como prueba',()=>{
 const item=parseList('1 kg ternera picada 97% carne').items[0];
 for(const ingredients of ['Proteínas: 98%. Grasas: 2%.','Carne de ternera, agua, sal.','Cereales 98%, carne de ternera.']){
  assert.equal(matchRequest(item,observation('DIA',null,{name:'Carne picada de ternera 100% premium',ingredients})).status,'unverified');
 }
 assert.equal(meatComposition('Carne de vacuno (98,5%), sal.').percent,98.5);
});
test('No acepta mezcla con cerdo ni hamburguesas en lugar de carne picada',()=>{
 const item=parseList('1 kg ternera picada 97% carne').items[0];
 for(const overrides of [{name:'Carne de ternera y cerdo picada 500 g'},{ingredients:'Carne de ternera (98%), grasa de cerdo.'},{name:'Hamburguesa de ternera picada 500 g'},{name:'Albóndigas de ternera picada 500 g'}])assert.equal(matchRequest(item,observation('DIA',98,overrides)).status,'different');
});
test('Ternera y vacuno requieren aceptación expresa sin reducir el 97%',()=>{
 const text='1 kg ternera picada 97% carne',o=observation('DIA',98,{name:'Carne picada de vacuno 500 g',ingredients:'Carne de vacuno (98%), agua.'}),s={...base,observations:[o]},a=compareObserved({...input,text},s,now),id=a.requests[0].lineId;
 assert.equal(a.clarifications[0].field,'allowVacuno');assert.equal(a.complete,false);
 const b=compareObserved({...input,text,resolutions:{[id]:{allowVacuno:true}}},s,now);assert.equal(b.complete,true);assert.equal(b.rows[0].composition.percent,98);assert.equal(b.items[0].constraints.minimumMeatPercent,97);
 const c=compareObserved({...input,text,resolutions:{[id]:{allowVacuno:false}}},s,now);assert.equal(c.clarifications.length,0);assert.equal(c.complete,false);
});
test('Las restricciones distintas no se suman en una misma línea',()=>{
 const d=parseList('500 g ternera picada 97% carne\n500 g ternera picada 99% carne');assert.equal(d.items.length,2);assert.deepEqual(d.items.map(i=>i.constraints.minimumMeatPercent),[97,99]);
});
test('La comparación respeta umbral y envases: no gana un producto barato al 90%',()=>{
 const s={...base,observations:[observation('DIA',90,{priceCents:100}),observation('DIA',98,{priceCents:600,storeProductId:'98'}),observation('Mercadona',99,{priceCents:650})]},d=compareObserved({...input,text:'750 g ternera picada 97% carne'},s,now);
 assert.equal(d.winner.store,'DIA');assert.equal(d.winner.knownSubtotalCents,1200);assert.equal(d.rows[0].packs,2);assert.equal(d.rows[0].composition.percent,98);
});
test('Si solo hay composición desconocida, la ficha queda visible pero fuera del total',()=>{
 const d=compareObserved({...input,text:'1 kg ternera picada 97% carne'},{...base,observations:[observation('DIA',null)]},now);
 assert.equal(d.productComparisons[0].unverified.length,1);assert.equal(d.complete,false);assert.equal(d.knownSubtotalCents,0);assert.equal(d.winner,null);
});
test('No separa vacuno y cerdo en dos compras ni pierde comas decimales',()=>{
 assert.equal(splitShoppingList('1 kg de vacuno y cerdo picados').length,1);assert.equal(parseList('1 kg de vacuno y cerdo picados').clarifications.length,1);assert.equal(parseList('1,5 kg ternera picada').items[0].quantity,1.5);
});
test('Porcentajes imposibles, de grasa o exactos provocan pregunta',()=>{
 for(const text of ['1 kg ternera picada 101% carne','1 kg ternera picada máximo 5% grasa','1 kg ternera picada exactamente 97% carne'])assert.equal(parseList(text).clarifications.length,1,text);
});
test('Una marca o variedad explícita no se sustituye por otra',()=>{
 const item=parseList('1 litro leche entera Pascual').items[0];
 assert.equal(matchRequest(item,{name:'Leche semidesnatada Pascual 1 l'}).status,'different');assert.equal(matchRequest(item,{name:'Leche entera Puleva 1 l'}).status,'different');assert.equal(matchRequest(item,{name:'Leche entera Pascual 1 l'}).status,'match');
});
test('Una línea dudosa impide anunciar una cesta completa con el resto de productos',()=>{
 const d=compareObserved({...input,text:'1 kg ternera\n1 kg ternera picada 97% carne'},{...base,observations:[observation('DIA',98),observation('Mercadona',98)]},now);
 assert.equal(d.requests.length,2);assert.equal(d.complete,false);assert.equal(d.winner,null);assert.equal(d.split,null);assert.equal(d.clarifications[0].field,'cut');
});
test('Extrae los ingredientes de una ficha real de DIA y cruza identidad y precio',async()=>{
 const fixture=JSON.parse(await readFile(new URL('./fixtures/dia-meat-detail.json',import.meta.url))),html='<script id="vike_pageContext">'+JSON.stringify(fixture)+'</script>',options={url:'https://www.dia.es/carnes/hamburguesas-carne-picada-y-albondigas/p/261239',observedAt:new Date(now).toISOString(),hash:'fixture'},o=parseDiaDetail(html,options);
 assert.equal(o.storeProductId,'261239');assert.equal(meatComposition(o.ingredients).percent,90);assert.equal(o.conditionalPrice,false);
 fixture.INITIAL_STATE.seoScriptData.price=1;assert.throws(()=>parseDiaDetail('<script id="vike_pageContext">'+JSON.stringify(fixture)+'</script>',options),/no coinciden/);
});
test('Planifica categorías públicas de la lista, sin endpoints de búsqueda excluidos',()=>{
 const plan=discoveryPlan(parseList('1 kg ternera picada 97% carne\n1 kg de brócoli').items);
 assert.equal(plan.length,2);assert.ok(plan[0].url.endsWith('/c/L2017'));assert.ok(plan.every(p=>!p.url.includes('/search')));
});
test('La búsqueda respeta robots y no continúa ante un 429',async()=>{
 const items=parseList('1 kg ternera picada').items;let calls=[];
 const blocked=await discoverDia(items,{fetchText:async url=>{calls.push(url);return {text:'User-agent: *\nDisallow: /'};},sleep:async()=>{}});
 assert.equal(blocked.run.status,'failed');assert.equal(calls.length,1);calls=[];
 const limited=await discoverDia(items,{fetchText:async url=>{calls.push(url);if(url.endsWith('robots.txt'))return {text:'User-agent: *\nAllow: /'};throw new Error('HTTP 429');},sleep:async()=>{}});
 assert.equal(limited.run.status,'failed');assert.equal(calls.length,2);
});


test('Entiende kilo y medio sin crear una segunda compra',()=>{for(const text of ['un kilo y medio de ternera picada','1 kilo y medio de ternera picada']){const d=parseList(text);assert.equal(d.requests.length,1);assert.equal(d.items[0].quantity,1.5);}});
test('Leche de avena y yogur sin azúcar son un producto con contexto, no dos compras',()=>{for(const text of ['1 litro leche de avena','4 unidades yogur natural sin azúcar','1 kg arroz con leche']){const d=parseList(text);assert.equal(d.requests.length,1,text);assert.equal(d.items.length,1,text);assert.equal(d.clarifications.length,0,text);}});
test('Las respuestas no pueden rebajar especie o corte ya solicitados',()=>{const text='1 kg ternera picada 97% carne',id=parseList(text).requests[0].lineId;assert.throws(()=>parseList(text,{resolutions:{[id]:{species:'cerdo'}}}),/especie/);assert.throws(()=>parseList(text,{resolutions:{[id]:{cut:'filetes'}}}),/corte/);});
