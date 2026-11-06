import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createLocalServer,LOCAL_HOST} from '../scripts/local-server.mjs';
import {mergeRetailSnapshot} from '../collectors/multi.js';

test('Una consulta vacía no adelanta la fecha del precio guardado',()=>{
 const previous={observations:[{store:'DIA',storeProductId:'1',productUrl:'https://www.dia.es/leche/p/1',observedAt:'2026-10-29T12:00:00.000Z'}],storeRuns:{}};
 const run={store:'DIA',status:'failed',finishedAt:'2026-11-06T08:00:00.000Z',errors:[{message:'Se alcanzó el tiempo de consulta. Se conservan los datos recogidos.'}],pages:[],observationCount:0};
 const next=mergeRetailSnapshot(previous,run,[]);
 assert.equal(next.observations[0].observedAt,'2026-10-29T12:00:00.000Z');
 assert.equal(next.storeRuns.DIA.status,'failed');
 assert.equal(next.storeRuns.DIA.finishedAt,'2026-11-06T08:00:00.000Z');
});

test('El servicio de desarrollo escucha solo en loopback y no pide autenticación',async()=>{
 const {default:worker}=await import('../dist/server/index.js');
 const server=createLocalServer(worker,0);
 await new Promise(resolve=>server.once('listening',resolve));
 try{
  const address=server.address();
  assert.equal(address.address,LOCAL_HOST);
  assert.notEqual(address.address,'0.0.0.0');
  const health=await fetch('http://'+LOCAL_HOST+':'+address.port+'/api/health');
  assert.equal(health.status,200);
  assert.equal(health.headers.get('www-authenticate'),null);
  const page=await fetch('http://'+LOCAL_HOST+':'+address.port+'/');
  const html=await page.text();
  assert.match(html,/sin autenticación/);
  assert.match(html,/127\.0\.0\.1/);
 }finally{await new Promise(resolve=>server.close(resolve));}
});
