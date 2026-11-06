import {readFile,mkdir,writeFile,copyFile} from 'node:fs/promises';
import {assertPublicSnapshot} from '../collectors/public-snapshot.js';
const html=await readFile('service.html','utf8');
const engine=await readFile('engine.js','utf8');
const registry=await readFile('collectors/registry.js','utf8');
const normalize=(await readFile('collectors/normalize.js','utf8')).replace("import {allowedProductUrl} from './registry.js';",'');
const matching=(await readFile('matching.js','utf8')).replace("import {normalizeText,PRIVATE_BRANDS} from './engine.js';",'').replace("import {canonicalType} from './collectors/normalize.js';",'');
const delivery=await readFile('delivery.js','utf8');
const observed=(await readFile('observed.js','utf8')).replace("import {priceBasket,basketOrder} from './delivery.js';",'').replace("import {parseList,normalizeText,queryFingerprint} from './engine.js';",'').replace("import {matchRequest,meatComposition,sameCut} from './matching.js';",'').replace("import {canonicalType} from './collectors/normalize.js';",'').replace("import {RETAILERS,sourceStatus,allowedProductUrl} from './collectors/registry.js';",'');
const mcp=(await readFile('mcp/server.js','utf8')).replace("import {observedList,compareObserved} from '../observed.js';",'').replace("import {sourceStatus} from '../collectors/registry.js';",'');
const snapshot=JSON.parse(await readFile('data/dia-latest.json','utf8'));
assertPublicSnapshot(snapshot);
const worker=await readFile('worker/index.js','utf8');
await mkdir('dist/server',{recursive:true});await mkdir('dist/.openai',{recursive:true});
await writeFile('dist/server/index.js','const PAGE='+JSON.stringify(html)+';\nconst SNAPSHOT='+JSON.stringify(snapshot)+';\n'+engine+'\n'+registry+'\n'+normalize+'\n'+matching+'\n'+delivery+'\n'+observed+'\n'+mcp+'\n'+worker.replace("import { STORES } from '../engine.js';",'').replace("import {compareObserved,observedList} from '../observed.js';",'').replace("import {handleMcp} from '../mcp/server.js';",'').replace("import {sourceStatus} from '../collectors/registry.js';",''));
// Hosting metadata is deployment configuration, never copied from a private workspace.
await writeFile('dist/.openai/hosting.json',JSON.stringify({d1:null,r2:null,capabilities:['mcp']},null,2)+'\n');console.log('Built Worker and interface.');
