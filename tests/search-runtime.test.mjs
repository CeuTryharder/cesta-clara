import {test} from 'node:test';import assert from 'node:assert/strict';import {readFile} from 'node:fs/promises';
const snapshot=JSON.parse(await readFile(new URL('../data/dia-latest.json',import.meta.url))),category=await readFile(new URL('./fixtures/dia-meat-category.json',import.meta.url),'utf8'),detail=await readFile(new URL('./fixtures/dia-meat-detail.json',import.meta.url),'utf8');
let listener,saved={},calls=[];const event=()=>({addListener:()=>{}});
globalThis.chrome={sidePanel:{setPanelBehavior:async()=>{}},storage:{local:{setAccessLevel:async()=>{},get:async keys=>Object.fromEntries((Array.isArray(keys)?keys:[keys]).map(k=>[k,saved[k]])),set:async values=>Object.assign(saved,values)}},runtime:{id:'search-test',getURL:path=>'chrome-extension://search-test/'+path,getManifest:()=>({version:'0.5.0'}),onMessage:{addListener:fn=>listener=fn},onInstalled:event(),onStartup:event()},permissions:{contains:async({origins})=>origins.every(o=>o.startsWith('https://www.dia.es/')),onRemoved:event()},alarms:{create:async()=>{},get:async()=>null,clear:async()=>{},onAlarm:event()}};
globalThis.fetch=async(url,options)=>{if(url.startsWith('chrome-extension://'))return Response.json(snapshot);calls.push({url,options});if(url.endsWith('robots.txt'))return new Response('User-agent: *\nAllow: /');if(url.endsWith('/c/L2017'))return new Response('<script id="vike_pageContext">'+category+'</script>');if(url.endsWith('/p/261239'))return new Response('<script id="vike_pageContext">'+detail+'</script>');throw new Error('Unexpected URL '+url);};
await import(new URL('../dist/extension/background.js',import.meta.url));
const message=value=>new Promise(resolve=>listener(value,{id:'search-test',url:'chrome-extension://search-test/panel.html'},resolve));
test('No inicia búsqueda mientras falta una aclaración sobre el corte',async()=>{
 const result=await message({type:'compare',text:'1 kg ternera',postcode:'28001',acceptAlternatives:true});assert.equal(result.ok,true);assert.equal(result.data.clarifications[0].field,'cut');assert.equal(calls.length,0);
});
test('Con permiso ya concedido busca, extrae ingredientes y conserva el 97% sin admitir el 90%',async()=>{
 const input={type:'compare',text:'1 kg vacuno picada 97% carne',postcode:'28001',acceptAlternatives:true};
 const result=await message(input);assert.equal(result.ok,true);assert.equal(result.data.complete,false);assert.equal(result.data.items[0].constraints.minimumMeatPercent,97);assert.deepEqual(result.data.searchInfo.stores,['DIA']);assert.equal(calls.length,3);
 assert.ok(calls.every(c=>c.options.credentials==='omit'));assert.ok(result.data.productComparisons[0].excluded.some(o=>o.reason.includes('90 %')));assert.ok(saved.snapshot.observations.some(o=>o.storeProductId==='261239'&&o.ingredients));
 const again=await message(input);assert.equal(again.ok,true);assert.equal(calls.length,3,'No repite automáticamente la misma búsqueda dentro de 15 minutos.');
});
