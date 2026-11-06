import {test} from 'node:test';
import assert from 'node:assert/strict';
import {collectBrowserStore} from '../dist/extension/browser-collector.js';
test('Tres cadenas con navegador consultan una sola página simultánea y cierran las tres',async()=>{
 const original=globalThis.chrome,tabs=new Map(),opened=[],closed=[];let seq=0,peak=0;
 globalThis.chrome={tabs:{create:async({url})=>{const tab={id:++seq,url};tabs.set(tab.id,tab);opened.push(url);peak=Math.max(peak,tabs.size);return tab;},get:async id=>tabs.get(id),remove:async id=>{closed.push(id);tabs.delete(id);}},scripting:{executeScript:async({target})=>[{result:{sourceUrl:tabs.get(target.tabId).url,rows:[{id:'1',name:'Leche entera 1 l',priceCents:96,quantityText:'1 l',productUrl:tabs.get(target.tabId).url,conditionalPrice:false}]}}]}};
 try{const stores=[['Mercadona','https://tienda.mercadona.es/product/1/leche'],['Alcampo','https://www.compraonline.alcampo.es/products/leche/1'],['Carrefour','https://www.carrefour.es/supermercado/leche/R-1/p']];const results=await Promise.all(stores.map(([store,url])=>collectBrowserStore(store,'28001',{pages:[url],fetchText:async()=>({text:'User-agent: *\nAllow: /'}),sleep:async()=>new Promise(resolve=>setTimeout(resolve,2))})));assert.equal(peak,1);assert.equal(tabs.size,0);assert.equal(opened.length,3);assert.equal(closed.length,3);assert.ok(results.every(r=>r.observations.length===1));}finally{globalThis.chrome=original;}
});
test('Si Chrome no confirma el cierre no abre otra página encima de la anterior',async()=>{
 const original=globalThis.chrome;let created=0;
 globalThis.chrome={tabs:{create:async({url})=>({id:++created,url}),get:async()=>({url:'https://tienda.mercadona.es/product/1/leche'}),remove:async()=>{throw new Error('Chrome no responde');}},scripting:{executeScript:async()=>[{result:{rows:[{id:'1',name:'Leche entera 1 l',priceCents:96,quantityText:'1 l',productUrl:'https://tienda.mercadona.es/product/1/leche',conditionalPrice:false}]}}]}};
 try{const result=await collectBrowserStore('Mercadona','28001',{pages:['https://tienda.mercadona.es/product/1/leche','https://tienda.mercadona.es/product/2/leche'],fetchText:async()=>({text:'User-agent: *\nAllow: /'}),sleep:async()=>{}});assert.equal(created,1);assert.ok(result.run.errors.some(e=>/cerrar/.test(e.message)));}finally{globalThis.chrome=original;}
});
