import {test} from 'node:test';import assert from 'node:assert/strict';import {readFile} from 'node:fs/promises';
import {RETAILERS} from '../collectors/registry.js';
const now=new Date().toISOString(),milkUrl='https://tienda.mercadona.es/product/10380/leche-entera-hacendado-brick',initial={observations:[{store:'DIA',storeProductId:'608',name:'Leche entera Dia Láctea 1 L',packageQuantity:1,packageUnit:'l',priceCents:96,unitPriceCents:96,conditionalPrice:false,observedAt:now,productUrl:'https://www.dia.es/huevos-leche-y-mantequilla/leche/p/608'}],maxAgeHours:24,lastRun:{store:'DIA',finishedAt:now}};
const fixture=await readFile(new URL('./fixtures/dia-state.json',import.meta.url),'utf8');
let listener,saved={},calls=[],created=[],removed=[],tabId=100,blockMerc=false;const tabs=new Map(),event=()=>({addListener:()=>{}});
globalThis.chrome={sidePanel:{setPanelBehavior:async()=>{}},storage:{local:{setAccessLevel:async()=>{},get:async keys=>Object.fromEntries((Array.isArray(keys)?keys:[keys]).map(k=>[k,saved[k]])),set:async values=>Object.assign(saved,values)}},runtime:{id:'multi-runtime',getURL:p=>'chrome-extension://multi-runtime/'+p,getManifest:()=>({version:'0.6.0'}),onMessage:{addListener:fn=>listener=fn},onInstalled:event(),onStartup:event()},permissions:{contains:async({origins})=>origins.every(o=>/www\.dia\.es|tienda\.mercadona\.es/.test(o)),onRemoved:event()},alarms:{create:async()=>{},get:async()=>null,clear:async()=>{},onAlarm:event()},tabs:{create:async options=>{const t={id:tabId++,url:options.url};created.push(t.id);assert.equal(options.active,false);tabs.set(t.id,t);return t;},get:async id=>tabs.get(id),remove:async id=>{removed.push(id);tabs.delete(id);}},scripting:{executeScript:async({target})=>[{result:{sourceUrl:tabs.get(target.tabId).url,rows:[{id:'10380',name:'Leche entera Hacendado',priceCents:95,quantityText:'1 l',productUrl:milkUrl,conditionalPrice:false}]}}]}};
globalThis.fetch=async(url,options)=>{
 if(url.startsWith('chrome-extension://'))return Response.json(initial);calls.push({url,options});
 if(blockMerc&&url==='https://tienda.mercadona.es/robots.txt')return new Response('Forbidden',{status:403});
 if(url.endsWith('robots.txt'))return new Response('User-agent: *\nAllow: /');
 if(url.endsWith('sitemap.xml'))return new Response('<urlset><loc>'+milkUrl+'</loc></urlset>');
 if(url.endsWith('/c/L2051'))return new Response('<script id="vike_pageContext">'+JSON.stringify({INITIAL_STATE:JSON.parse(fixture)})+'</script>');
 throw new Error('Unexpected network request '+url);
};
await import(new URL('../dist/extension/background.js',import.meta.url));
const message=value=>new Promise(resolve=>listener(value,{id:'multi-runtime',url:'chrome-extension://multi-runtime/panel.html'},resolve));
const input={text:'1 litro de leche',postcode:'28001',fulfillment:'store',acceptAlternatives:true};
test('Aunque DIA ya complete la cesta, consulta Mercadona y compara los dos precios',async()=>{
 const r=await message({type:'compare',...input});assert.equal(r.ok,true);assert.ok(calls.some(c=>c.url==='https://tienda.mercadona.es/sitemap.xml'));assert.equal(r.data.baskets.find(b=>b.store==='Mercadona').lookup.status,'succeeded');assert.ok(r.data.completeStores>=2);assert.equal(r.data.winner.store,'Mercadona');assert.deepEqual(removed,created);assert.ok(!removed.includes(99));
});
test('Consultar todas deja un resultado de las ocho cadenas, incluidos los permisos pendientes',async()=>{
 const r=await message({type:'search',...input});assert.equal(r.ok,true);assert.equal(r.data.runs.length,8);assert.equal(r.data.comparison.baskets.find(b=>b.store==='Carrefour').lookup.status,'permission-required');assert.ok(!calls.some(c=>/carrefour|alcampo/.test(c.url)));assert.deepEqual(removed,created);
});
test('El bloqueo de una fuente no detiene la otra ni renueva sus precios anteriores',async()=>{
 const old=saved.snapshot.observations.find(o=>o.store==='Mercadona').observedAt;blockMerc=true;const r=await message({type:'search',...input});assert.equal(r.ok,true);assert.equal(r.data.comparison.baskets.find(b=>b.store==='Mercadona').lookup.status,'blocked');assert.equal(r.data.comparison.baskets.find(b=>b.store==='DIA').lookup.status,'succeeded');assert.equal(saved.snapshot.observations.find(o=>o.store==='Mercadona').observedAt,old);assert.equal(saved.searchProgress,null);assert.ok(calls.every(c=>c.options.credentials==='omit'));
});

test('Con todos los permisos intenta las ocho fuentes aunque Carrefour bloquee y Alcampo falle',async()=>{
 const originalFetch=globalThis.fetch,originalPermission=chrome.permissions.contains,attempted=new Set();
 chrome.permissions.contains=async()=>true;
 globalThis.fetch=async(url,options)=>{
  if(url.startsWith('chrome-extension://'))return originalFetch(url,options);
  const store=RETAILERS.find(r=>r.origins.includes(new URL(url).origin));attempted.add(store.name);
  // Network failures happen inside each real collector; the scheduler must continue.
  if(store.name==='Carrefour')return new Response('Forbidden',{status:403});
  if(store.name==='Alcampo')throw new Error('Network request failed');
  if(!['DIA','Mercadona'].includes(store.name))return new Response('Unavailable',{status:503});
  return originalFetch(url,options);
 };
 try{const result=await message({type:'search',...input});assert.equal(result.ok,true);assert.deepEqual([...attempted].sort(),RETAILERS.map(r=>r.name).sort());assert.equal(result.data.runs.length,8);assert.ok(result.data.runs.every(r=>r.finishedAt));assert.equal(result.data.runs.find(r=>r.store==='Carrefour').status,'blocked');assert.equal(result.data.runs.find(r=>r.store==='DIA').status,'succeeded');assert.equal(saved.searchProgress,null);}
 finally{globalThis.fetch=originalFetch;chrome.permissions.contains=originalPermission;}
});

test('Un error al comprobar permisos de una cadena tampoco interrumpe las otras siete',async()=>{
 const original=chrome.permissions.contains;chrome.permissions.contains=async({origins})=>{if(origins[0].includes('carrefour'))throw new Error('Permission service unavailable');return false;};
 try{for(const type of ['search','refresh']){const result=await message({type,...input});assert.equal(result.ok,true);assert.equal(result.data.runs.length,8);assert.equal(result.data.runs.find(r=>r.store==='Carrefour').status,'failed');assert.equal(result.data.runs.filter(r=>r.status==='permission-required').length,7);}}
 finally{chrome.permissions.contains=original;}
});

test('El diagnóstico enumera ocho tiendas sin incluir la lista, CP ni URLs de producto',async()=>{
 const result=await message({type:'diagnostics'});assert.equal(result.ok,true);assert.equal(result.data.stores.length,8);const json=JSON.stringify(result.data);assert.doesNotMatch(json,/28001|1 litro de leche|https:\/\//);assert.ok(result.data.stores.every(r=>Array.isArray(r.issues)));
});

test('Revisar y comparar también registra las ocho cadenas aunque falle un permiso',async()=>{
 const original=chrome.permissions.contains;saved.snapshot.lookups={};chrome.permissions.contains=async({origins})=>{if(origins[0].includes('carrefour'))throw new Error('Permission unavailable');return false;};
 try{const result=await message({type:'compare',...input});assert.equal(result.ok,true);assert.equal(result.data.baskets.length,8);assert.equal(result.data.baskets.find(b=>b.store==='Carrefour').lookup.status,'failed');assert.equal(result.data.baskets.filter(b=>b.lookup.status==='permission-required').length,7);}
 finally{chrome.permissions.contains=original;}
});
