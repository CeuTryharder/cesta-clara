import {readFile} from 'node:fs/promises';
import {createHash,randomUUID} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {makeObservation} from '../collectors/normalize.js';
import {mergeRetailSnapshot} from '../collectors/multi.js';
import {openHistory,saveRun} from '../collectors/history.mjs';
import {readLocalSnapshot,writeLocalSnapshot,localRuntime} from '../collectors/local-data.mjs';

// Explicit local input. No browser profile, account or storage export is read.
if(process.argv.length!==3)throw new Error('Uso: node scripts/import-browser-observations.mjs archivo-de-productos.json');
const raw=JSON.parse(await readFile(process.argv[2],'utf8'));
if(!Array.isArray(raw)||raw.length>1000)throw new Error('Se requiere un array de hasta 1000 productos.');
let snapshot=await readLocalSnapshot();
const db=openHistory(fileURLToPath(new URL('prices.sqlite',localRuntime)));
try{
 for(const store of [...new Set(raw.map(row=>row.store))]){
  const rows=raw.filter(row=>row.store===store);
  if(rows.some(row=>!Number.isFinite(Date.parse(row.observedAt))))throw new Error('Cada producto debe tener una fecha de observación.');
  const observations=rows.map(row=>makeObservation(row,{store,url:row.productUrl,observedAt:row.observedAt,hash:createHash('sha256').update(JSON.stringify(row)).digest('hex'),method:'browser-visible-dom',requestedPostcode:null}));
  const dates=observations.map(row=>row.observedAt).sort();
  const run={id:randomUUID(),store,startedAt:dates[0],finishedAt:dates.at(-1),status:'succeeded',observationCount:observations.length,requestedPostcode:null,locationVerified:false,scheduling:'manual-import',pages:observations.map(o=>({url:o.productUrl,observedAt:o.observedAt})),errors:[]};
  saveRun(db,run,observations);snapshot=mergeRetailSnapshot(snapshot,run,observations);
 }
 await writeLocalSnapshot(snapshot);console.log('Observaciones importadas únicamente al almacenamiento local.');
}finally{db.close();}
