import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createUsageMeter} from '../extension/usage.js';
function fixture({failSave=false}={}){const saved={};let writes=0;const storage={get:async k=>({[k]:structuredClone(saved[k])}),set:async v=>{writes++;if(failSave)throw new Error('quota');Object.assign(saved,structuredClone(v));},getBytesInUse:async()=>12345};return {storage,saved,writes:()=>writes};}
test('Mide tráfico HTTP y persistencia acotada sin URLs, lista ni cuentas',async()=>{
 const f=fixture(),m=createUsageMeter(f.storage);await m.measure('search',async()=>{await m.fetchText('https://www.dia.es/private-path',{},async()=>({text:'é'}));m.page('opened');m.page('closed');});
 const d=await m.read();assert.equal(d.decodedBytes,2);assert.equal(d.browserPages,1);assert.equal(d.peakBrowserPages,1);assert.equal(d.storageBytes,12345);assert.equal(d.cpuPercent,null);assert.equal(d.memoryBytes,null);assert.equal(d.totalNetworkBytes,null);assert.equal(f.writes(),1);assert.doesNotMatch(JSON.stringify(f.saved),/private-path|https:/);
 for(let i=0;i<15;i++)await m.measure('compare',async()=>{});assert.equal((await m.read()).recent.length,10);
 const restored=createUsageMeter(f.storage);assert.equal((await restored.read()).browserPages,1);assert.equal(f.writes(),16,'Consultar métricas no escribe ni crea temporizadores');
});
test('Cuenta intentos HTTP, incluidos reintentos y fallos, sin clonar respuestas',async()=>{
 const f=fixture(),m=createUsageMeter(f.storage),previous=globalThis.fetch;let calls=0;
 globalThis.fetch=async()=>{calls++;return new Response(calls===1?'fallo':'bien',{status:calls===1?503:200});};
 try{await m.measure('search',()=>m.fetchText('https://www.dia.es/test',{},async(url,{fetchImpl})=>{await fetchImpl(url,{});const response=await fetchImpl(url,{});return {text:await response.text()};}));const d=await m.read();assert.equal(d.httpRequests,2);assert.equal(d.httpFailures,1);assert.equal(d.decodedBytes,4);}finally{globalThis.fetch=previous;}
});
test('La medición no estropea la comparación si falta cuota para guardar métricas',async()=>{
 const m=createUsageMeter(fixture({failSave:true}).storage);assert.equal(await m.measure('compare',async()=>42),42);await assert.rejects(()=>m.measure('search',async()=>{throw new Error('source failed');}),/source failed/);
});

test('Borrar las métricas también elimina la copia en memoria antes de otra lectura',async()=>{
 const f=fixture(),m=createUsageMeter(f.storage);await m.measure('search',async()=>{m.page('opened');m.page('closed');});assert.equal((await m.read()).browserPages,1);
 await m.reset();delete f.saved.resourceUsage;const d=await m.read();assert.equal(d.browserPages,0);assert.deepEqual(d.recent,[]);assert.equal(d.httpRequests,0);
});
