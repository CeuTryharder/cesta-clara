import {readFile,writeFile} from 'node:fs/promises';
import {performance} from 'node:perf_hooks';
import {compareObserved} from '../observed.js';
const snapshot=JSON.parse(await readFile(new URL('../data/dia-latest.json',import.meta.url))),now=Math.max(...snapshot.observations.map(o=>Date.parse(o.observedAt)));
const lines=['4 l leche entera','12 huevos M','1 kg arroz redondo','500 g macarrones','1 l aceite oliva virgen extra','1 kg filetes vacuno'];
const scenarios=[];
for(const count of [1,6,30]){
 const input={text:Array.from({length:count},(_,i)=>lines[i%lines.length]).join('\n'),postcode:'28001',acceptAlternatives:true},times=[];
 for(let i=0;i<10;i++)compareObserved(input,snapshot,now);
 global.gc?.();const heapBefore=process.memoryUsage().heapUsed,cpuStart=process.cpuUsage();
 for(let i=0;i<100;i++){const start=performance.now();compareObserved(input,snapshot,now);times.push(performance.now()-start);}
 const cpu=process.cpuUsage(cpuStart);global.gc?.();const heapAfter=process.memoryUsage().heapUsed;times.sort((a,b)=>a-b);
 scenarios.push({lines:count,interpretedItems:compareObserved(input,snapshot,now).items.length,iterations:100,p50Ms:+times[49].toFixed(2),p95Ms:+times[94].toFixed(2),cpuMsPerComparison:+((cpu.user+cpu.system)/100000).toFixed(2),retainedHeapDeltaBytes:global.gc?heapAfter-heapBefore:null});
}
const result={at:new Date().toISOString(),runtime:process.version,platform:process.platform,scope:'Node: cálculo local con muestra y reloj fijado a la última observación. No mide RAM/CPU de Chrome, scraping, voz ni navegación.',observations:snapshot.observations.length,snapshotJsonBytes:Buffer.byteLength(JSON.stringify(snapshot)),scenarios};
if(process.argv[2])await writeFile(process.argv[2],JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result,null,2));
