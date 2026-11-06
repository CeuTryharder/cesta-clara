import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdir,mkdtemp,readFile,writeFile,rm} from 'node:fs/promises';
import {join} from 'node:path';
import {pathToFileURL,fileURLToPath} from 'node:url';
import {privateDiagnostic} from '../extension/privacy.js';
import {assertPublicSnapshot} from '../collectors/public-snapshot.js';
import {readLocalSnapshot,writeLocalSnapshot} from '../collectors/local-data.mjs';
import {scanText,privateFile} from '../scripts/check-public.mjs';

test('El diagnóstico filtra campos privados incluso dentro de estados, eventos y métricas antiguas',()=>{
 const secret=['PRIVATE','SENTINEL'].join('_'),at='2026-11-05T12:00:00.000Z';
 const result=privateDiagnostic({version:'0.9.1',at,postcode:secret,draft:secret,resourceUsage:{httpRequests:2,storageBytes:secret,extra:secret,since:at,recent:[{operation:secret,durationMs:secret,at:secret,ok:secret,url:secret}]},stores:[{store:'DIA',status:secret,checkedAt:secret,permission:secret,pages:2,prices:3,issues:[secret],account:secret},{store:secret}],cart:{store:'DIA',status:'paused',index:1,name:secret,rows:[{status:secret,units:secret,target:4,pending:secret,name:secret}],events:[{at,event:secret,index:1,url:secret}]}});
 assert.doesNotMatch(JSON.stringify(result),new RegExp(secret));assert.equal(result.stores.length,1);assert.equal(result.resourceUsage.httpRequests,2);assert.equal(result.cart.rows[0].target,4);assert.equal(result.cart.rows[0].pending,false);assert.equal(result.cart.events[0].event,'paused');
});

test('La muestra distribuible rechaza zonas, caches de listas y enlaces de sesión',async()=>{
 const sample=JSON.parse(await readFile(new URL('../data/dia-latest.json',import.meta.url)));
 assert.equal(assertPublicSnapshot(sample),sample);
 for(const patch of [{requestedPostcode:'28001'},{lookups:{list:'private'}},{draft:{text:'private'}},{sourcePostcode:'28001'},{sourceUrl:'https://www.dia.es/p/1?session=private'}])assert.throws(()=>assertPublicSnapshot({...sample,...patch}));
 assert.throws(()=>assertPublicSnapshot({...sample,observations:[{...sample.observations[0],postcode:'28001'}]}));
});

test('El MCP escribe en runtime y no cambia la muestra; un JSON local roto no se oculta',async()=>{
 const parent=fileURLToPath(new URL('../dist/privacy-tests/',import.meta.url));await mkdir(parent,{recursive:true});
 const temp=await mkdtemp(join(parent,'test-')),directory=pathToFileURL(join(temp,'runtime')+'/'),seed=pathToFileURL(join(temp,'seed.json'));
 assert.ok(temp.startsWith(parent));
 try{
  const original=JSON.stringify({observations:[],requestedPostcode:null});await writeFile(seed,original);
  assert.deepEqual(await readLocalSnapshot({directory,seed}),JSON.parse(original));
  await writeLocalSnapshot({observations:[],requestedPostcode:'28001'},{directory});
  assert.equal((await readLocalSnapshot({directory,seed})).requestedPostcode,'28001');assert.equal(await readFile(seed,'utf8'),original);
  await writeFile(new URL('snapshot.json',directory),'{broken');await assert.rejects(()=>readLocalSnapshot({directory,seed}),SyntaxError);
 }finally{await rm(temp,{recursive:true,force:true});}
});

test('La revisión de publicación detecta secretos sin imprimir sus valores y excluye archivos de sesión',()=>{
 const token=['ghp','_','A'.repeat(40)].join(''),findings=scanText('token = '+token,'example.txt');
 assert.ok(findings.some(f=>f.type==='provider-token'));assert.doesNotMatch(JSON.stringify(findings),new RegExp(token));
 for(const path of ['runtime/snapshot.json','.env.production','.openai/hosting.json','capture.har','data/browser-observed.json','profile.sqlite-wal','cesta-clara-diagnostico.json'])assert.equal(privateFile(path),true,path);
 assert.equal(privateFile('data/dia-latest.json'),false);assert.equal(privateFile('.env.example'),false);
 assert.ok(scanText(['developer','invalid.test'].join('@'),'example').some(f=>f.type==='email'));assert.deepEqual(scanText('1+contributor@users.noreply.github.com','example'),[]);
});
