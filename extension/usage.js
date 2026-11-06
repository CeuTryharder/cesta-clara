// Aggregate local counters only. No URLs, shopping lists or account data.
export function createUsageMeter(storage,{time=()=>performance.now(),date=()=>new Date().toISOString()}={}){
 let data,loading,flush=Promise.resolve(),activeTabs=0;
 async function init(){loading??=storage.get('resourceUsage').then(({resourceUsage})=>{data={since:date(),httpRequests:0,httpFailures:0,decodedBytes:0,browserPages:0,peakBrowserPages:0,recent:[],...resourceUsage};});await loading;}
 function page(event){
  if(!data)return;
  if(event==='opened'){activeTabs++;data.browserPages++;data.peakBrowserPages=Math.max(data.peakBrowserPages,activeTabs);}
  if(event==='closed')activeTabs=Math.max(0,activeTabs-1);
 }
 async function fetchText(url,options,fetcher){
  await init();
  try{const result=await fetcher(url,{...options,fetchImpl:async(target,opts)=>{data.httpRequests++;try{const response=await fetch(target,opts);if(!response.ok)data.httpFailures++;return response;}catch(e){data.httpFailures++;throw e;}}});data.decodedBytes+=new TextEncoder().encode(result.text).byteLength;return result;}
  catch(e){throw e;}
 }
 async function measure(name,task){
  await init();const started=time();let ok=false;
  try{const result=await task();ok=true;return result;}
  finally{data.recent=[{operation:name,durationMs:Math.round(time()-started),ok,at:date()},...data.recent].slice(0,10);const value=structuredClone(data);flush=flush.catch(()=>{}).then(()=>storage.set({resourceUsage:value}));await flush.catch(()=>{});}
 }
 async function read(){
  await init();let storageBytes=null;try{if(storage.getBytesInUse)storageBytes=await storage.getBytesInUse(null);}catch{}
  return {...structuredClone(data),activeBrowserPages:activeTabs,storageBytes,cpuPercent:null,memoryBytes:null,totalNetworkBytes:null,scope:'Contadores locales desde la instalación de esta medición. CPU, RAM y tráfico total de pestañas no se miden aquí.'};
 }
 async function reset(){await flush.catch(()=>{});data=undefined;loading=undefined;activeTabs=0;}
 return {fetchText,measure,read,page,reset};
}
