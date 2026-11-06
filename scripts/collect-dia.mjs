import {runLocalCollector} from '../collectors/local-run.mjs';
const {run}=await runLocalCollector({onProgress:p=>console.error(p.category+': '+p.count+' precios validados.')});
console.log(JSON.stringify({status:run.status,count:run.observationCount,locationVerified:false,snapshot:'runtime/snapshot.json'}));
if(run.status==='failed')process.exitCode=1;
