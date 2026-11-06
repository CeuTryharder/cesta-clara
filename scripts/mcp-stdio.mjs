import {fileURLToPath} from 'node:url';
import {handleMcp} from '../mcp/server.js';import {runLocalCollector} from '../collectors/local-run.mjs';import {openHistory} from '../collectors/history.mjs';
import {readLocalSnapshot} from '../collectors/local-data.mjs';
const context={snapshot:readLocalSnapshot,refresh:async postcode=>{const {run}=await runLocalCollector({requestedPostcode:postcode,onProgress:p=>process.stderr.write(p.category+': '+p.count+' precios\n')});return {run,locationVerified:false};},history:async(sku,limit,store='DIA')=>{
 const db=openHistory(fileURLToPath(new URL('../runtime/prices.sqlite',import.meta.url)));try{return {store,sku,observations:db.prepare('SELECT payload_json FROM observations WHERE store=? AND product_id=? ORDER BY observed_at DESC LIMIT ?').all(store,sku,limit).map(r=>JSON.parse(r.payload_json))};}finally{db.close();}
}};
// Newline JSON-RPC over stdio. Diagnostics go to stderr, never stdout.
process.stdin.setEncoding('utf8');let buffer='',queue=Promise.resolve();
process.stdin.on('data',chunk=>{buffer+=chunk;if(buffer.length>65536){process.stderr.write('Petición MCP excesiva.\n');process.exit(1);}let end;while((end=buffer.indexOf('\n'))>=0){const line=buffer.slice(0,end).trim();buffer=buffer.slice(end+1);if(!line)continue;queue=queue.then(async()=>{let result;try{result=await handleMcp(JSON.parse(line),context);}catch{result={jsonrpc:'2.0',id:null,error:{code:-32700,message:'JSON no válido.'}};}if(result)process.stdout.write(JSON.stringify(result)+'\n');});}});
process.stdin.on('end',()=>{if(buffer.trim())process.stderr.write('La última petición debe terminar con un salto de línea.\n');});
