import {mkdir,open,unlink} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {collectAllRetailers,mergeRetailSnapshot} from './multi.js';
import {openHistory,saveRun,latestObservations} from './history.mjs';
import {localRuntime,writeLocalSnapshot} from './local-data.mjs';
export async function runLocalCollector({requestedPostcode=null,onProgress=()=>{}}={}){
 const runtime=localRuntime;
 await mkdir(runtime,{recursive:true});
 const lockPath=new URL('collector.lock',runtime);let lock;
 try{lock=await open(lockPath,'wx');}catch{throw new Error('Ya hay una recogida activa.');}
 let db;
 try{
  db=openHistory(fileURLToPath(new URL('prices.sqlite',runtime)));
  const {run,observations,runs}=await collectAllRetailers({requestedPostcode,onProgress});
  for(const subrun of Object.values(runs))saveRun(db,subrun,observations.filter(o=>o.store===subrun.store));
  const snapshot=mergeRetailSnapshot({observations:latestObservations(db)},run,observations);
  await writeLocalSnapshot(snapshot);
  return {run,snapshot};
 }finally{db?.close();await lock.close();await unlink(lockPath);}
}
