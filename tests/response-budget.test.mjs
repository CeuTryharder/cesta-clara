import {test} from 'node:test';
import assert from 'node:assert/strict';
import {fetchRetailText} from '../collectors/multi.js';
test('Interrumpe la respuesta al superar el presupuesto de bytes sin descargarla entera',async()=>{
 let cancelled=false,reads=0;
 const response=new Response(new ReadableStream({pull(c){reads++;c.enqueue(new Uint8Array(4));},cancel(){cancelled=true;}}));
 await assert.rejects(()=>fetchRetailText('https://www.dia.es/test',{maxBytes:5,fetchImpl:async()=>response}),/Respuesta excesiva/);assert.equal(cancelled,true);assert.ok(reads<=3);
});
test('El presupuesto cuenta bytes UTF-8 y respeta caracteres divididos entre chunks',async()=>{
 const data=new TextEncoder().encode('á€'),response=()=>new Response(new ReadableStream({start(c){c.enqueue(data.slice(0,1));c.enqueue(data.slice(1,3));c.enqueue(data.slice(3));c.close();}}));
 assert.equal((await fetchRetailText('https://www.dia.es/test',{maxBytes:5,fetchImpl:async()=>response()})).text,'á€');await assert.rejects(()=>fetchRetailText('https://www.dia.es/test',{maxBytes:4,fetchImpl:async()=>response()}),/Respuesta excesiva/);
});
