import {test} from 'node:test';
import assert from 'node:assert/strict';
import {deliveryQuote,priceBasket,DELIVERY_SOURCES} from '../delivery.js';
import {compareObserved} from '../observed.js';
import {callMcpTool} from '../mcp/server.js';
const now=Date.parse('2026-11-03T12:00:00+01:00'),options={postcode:'28001',now};
const quote=(store,sum)=>deliveryQuote(store,sum,options);
test('Tarifas oficiales: umbrales, mínimo de Mercadona y fuentes de las ocho cadenas',()=>{
 assert.equal(quote('DIA',9999).minCents,499);assert.equal(quote('DIA',10000).minCents,0);
 assert.equal(quote('Mercadona',5999).eligible,false);assert.equal(quote('Mercadona',5999).remainingCents,1);assert.equal(quote('Mercadona',6000).eligible,true);assert.equal(quote('Mercadona',6000).minCents,820);
 assert.equal(quote('Carrefour',13999).minCents,399);assert.deepEqual([quote('Carrefour',14000).minCents,quote('Carrefour',14000).maxCents],[0,399]);assert.equal(quote('Carrefour',14001).maxCents,0);
 assert.equal(quote('Consum',5999).minCents,700);assert.equal(quote('Consum',6000).minCents,400);
 for(const store of ['DIA','Mercadona','Carrefour','Alcampo','Eroski','Consum','Lidl','ALDI']){assert.ok(DELIVERY_SOURCES[store].length);assert.equal(quote(store,6000).coverageVerified,false);}
});
test('Los gastos variables mantienen el intervalo y Eroski añade bolsas por separado',()=>{
 assert.deepEqual([quote('Alcampo',3000).minCents,quote('Alcampo',3000).maxCents],[99,599]);assert.equal(deliveryQuote('Alcampo',3000,{...options,postcode:'08001'}).minCents,700);
 const b=priceBasket({store:'Eroski',knownSubtotalCents:1000,complete:true},options);assert.equal(b.delivery.extraFeeCents,60);assert.deepEqual([b.totalMinCents,b.totalMaxCents,b.totalCents],[1455,1755,null]);
});
test('Sin catálogo completo, sin mínimo o sin entrega compatible no se publica un total final',()=>{
 for(const b of [{store:'DIA',knownSubtotalCents:300,complete:false},{store:'Mercadona',knownSubtotalCents:3000,complete:true},{store:'ALDI',knownSubtotalCents:3000,complete:true},{store:'Lidl',knownSubtotalCents:3000,complete:true}])assert.equal(priceBasket(b,options).totalMinCents,null);
 assert.equal(deliveryQuote('Unknown',0,options).minCents,null);assert.equal(deliveryQuote('DIA',1000,{...options,now:now+31*86400000}).status,'needs-review');
 assert.equal(deliveryQuote('DIA',1000,{...options,fulfillment:'store'}).minCents,0);assert.throws(()=>deliveryQuote('DIA',1000,{...options,fulfillment:'pickup'}));
});
function snapshot(prices){return {maxAgeHours:24,observations:Object.entries(prices).map(([store,priceCents])=>({store,storeProductId:'milk',name:'Leche entera 1 l',packageUnit:'l',packageQuantity:1,priceCents,conditionalPrice:false,observedAt:new Date(now).toISOString(),productUrl:store==='DIA'?'https://www.dia.es/leche/p/608':store==='Carrefour'?'https://www.carrefour.es/supermercado/leche/R-1/p':store==='Mercadona'?'https://tienda.mercadona.es/product/10380/leche':store==='ALDI'?'https://www.aldi.es/producto/leche-80000.html':'https://www.compraonline.alcampo.es/products/leche/1'}))};}
const input={text:'1 l leche entera',postcode:'28001',acceptAlternatives:true,maxStores:1};
test('El envío puede cambiar la tienda más barata y una tienda física no gana reparto',()=>{
 const s=snapshot({DIA:100,Carrefour:150,ALDI:80}),d=compareObserved(input,s,now);assert.equal(d.winner.store,'Carrefour');assert.equal(d.totalCents,549);assert.equal(d.knownSubtotalCents,150);assert.equal(d.delivery.coverageVerified,false);
 const physical=compareObserved({...input,fulfillment:'store'},s,now);assert.equal(physical.winner.store,'ALDI');assert.equal(physical.totalCents,80);
});
test('No se anuncia ganador si la franja puede cambiar el orden o se incumple un mínimo',()=>{
 const d=compareObserved(input,snapshot({DIA:100,Alcampo:100,Mercadona:50}),now);assert.equal(d.winner,null);assert.equal(d.baskets.find(b=>b.store==='Mercadona').totalCents,null);assert.equal(d.baskets.find(b=>b.store==='Mercadona').delivery.remainingCents,5950);
});
test('DIA de la captura: productos 34,76 + envío 4,99 = 39,75; no se suman extras ajenos',()=>{
 assert.equal(priceBasket({store:'DIA',knownSubtotalCents:3476,complete:true},options).totalCents,3975);
});
test('MCP permite domicilio o presencial y conserva el desglose y las fuentes',async()=>{
 const context={snapshot:async()=>snapshot({DIA:100,Carrefour:150}),now:()=>now};
 const args={lista:'1 l leche entera',codigo_postal:'28001',aceptar_alternativas:true};
 const delivery=await callMcpTool('calcular_cesta',args,context),physical=await callMcpTool('calcular_cesta',{...args,modalidad:'presencial'},context);assert.equal(delivery.winner.store,'Carrefour');assert.equal(physical.winner.store,'DIA');assert.ok(delivery.delivery.sources.length);
});

test('El reparto cobra un envío por cada pedido y calcula los mínimos sobre cada subcesta',()=>{
 const s=snapshot({DIA:100,Carrefour:500});
 for(const o of [...s.observations])s.observations.push({...o,storeProductId:'rice',name:'Arroz redondo 1 kg',packageUnit:'kg',priceCents:o.store==='DIA'?500:100,productUrl:o.productUrl.replace('leche','arroz')});
 const d=compareObserved({...input,text:'1 l leche entera\n1 kg arroz redondo',maxStores:2},s,now);assert.ok(d.split);assert.equal(d.split.subtotalCents,200);assert.equal(d.split.totalCents,1098);assert.equal(d.split.orders.length,2);assert.equal(d.split.orders.reduce((sum,o)=>sum+o.delivery.minCents,0),898);
 const cheap=compareObserved({...input,text:'1 l leche entera',maxStores:2},snapshot({DIA:100,Mercadona:50}),now);assert.equal(cheap.split,null);
});
