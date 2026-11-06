import {privateDiagnostic} from './privacy.js';
import {createUsageMeter} from './usage.js';
import {parseList,queryFingerprint} from './shared/engine.js';
import {createCartController} from './cart.js';
import {issueCode} from './feedback.js';
import {collectHttpQuery,newQueryRun,finishQueryRun} from './shared/collectors/query.js';
import {fetchRetailText,collectRetailer,mergeRetailSnapshot} from './shared/collectors/multi.js';
import {collectBrowserStore} from './browser-collector.js';
import {RETAILERS,retailer,sourceStatus} from './shared/collectors/registry.js';
import {compareObserved,observedList} from './shared/observed.js';
const ALARM='refresh-stores',LOOKUP_AGE=15*60*1000,REFRESH_BATCH_MINUTES=15;let refreshPromise=null,seedPromise,resetting=false,activeRequests=0;
chrome.sidePanel.setPanelBehavior({openPanelOnActionClick:true}).catch(()=>{});
chrome.storage.local.setAccessLevel({accessLevel:'TRUSTED_CONTEXTS'}).catch(()=>{});
const usage=createUsageMeter(chrome.storage.local);
const publicFetch=(url,options={})=>usage.fetchText(url,options,(target,opts)=>fetchRetailText(target,{...opts,fetchImpl:(u,o)=>opts.fetchImpl(u,{...o,headers:{Accept:'*/*'},credentials:'omit'})}));
async function snapshot(){
 const stored=await chrome.storage.local.get(['snapshot','seedVersion']),version=chrome.runtime.getManifest?.().version||'0.9.1';
 if(stored.snapshot&&stored.seedVersion===version)return stored.snapshot;
 seedPromise??=fetch(chrome.runtime.getURL('data/dia-latest.json')).then(r=>r.json());const seed=await seedPromise;
 if(!stored.snapshot){await chrome.storage.local.set({snapshot:seed,seedVersion:version});return seed;}
 const next=mergeRetailSnapshot(seed,stored.snapshot.lastRun,stored.snapshot.observations);next.lookups=stored.snapshot.lookups||seed.lookups||{};
 next.storeRuns={...seed.storeRuns};for(const [store,run]of Object.entries(stored.snapshot.storeRuns||{}))if(!next.storeRuns[store]||Date.parse(run.finishedAt)>Date.parse(next.storeRuns[store].finishedAt))next.storeRuns[store]=run;
 await chrome.storage.local.set({snapshot:next,seedVersion:version});return next;
}
async function permitted(config){return chrome.permissions.contains({origins:config.origins.map(o=>o+'/*')});}
async function saveHistory(observations){
 const {history={}}=await chrome.storage.local.get('history');
 for(const o of observations){const key=o.store+':'+o.storeProductId;history[key]=[o,...(history[key]||[])].slice(0,20);}
 return history;
}
function selectedStores(names){if(names===undefined)return RETAILERS.map(r=>r.name);if(!Array.isArray(names)||!names.length||names.some(n=>!retailer(n)))throw new Error('Selección de tiendas no válida.');return [...new Set(names)];}
async function searchList(message){
 if(refreshPromise)throw new Error('Ya hay una consulta en curso. Espera a que termine.');
 const parsed=parseList(message.text,{resolutions:message.resolutions,brandPreference:message.brandPreference});if(!parsed.items.length)throw new Error('Responde primero a las preguntas sobre tu lista.');
 // Validate postcode, quantities and preferences before any network request.
 compareObserved({...message,acceptAlternatives:true},{observations:[],maxAgeHours:24});
 const signature=queryFingerprint(message),stores=selectedStores(message.stores);
 refreshPromise=(async()=>{
  let next=await snapshot(),cursor=0,done=0,count=0,commit=Promise.resolve();const active=new Set(),runs=[];
  const update=task=>{commit=commit.then(task);return commit;};
  const checkpoint=async(store,state,result=null)=>{
   if(result){next=mergeRetailSnapshot(next,result.run,result.observations);count+=result.observations.length;}
   const entry={...(next.lookups?.[signature]||{}),updatedAt:new Date().toISOString(),stores:{...(next.lookups?.[signature]?.stores||{}),[store]:{status:state,checkedAt:new Date().toISOString(),errors:result?.run.errors||[],observationCount:result?.observations.length||0}}};
   next.lookups={...(next.lookups||{}),[signature]:entry};
   next.lookups=Object.fromEntries(Object.entries(next.lookups).sort((a,b)=>Date.parse(b[1].updatedAt)-Date.parse(a[1].updatedAt)).slice(0,30));
   const history=result?await saveHistory(result.observations):undefined;
   await chrome.storage.local.set({snapshot:next,postcode:message.postcode,...(history?{history}:{}),searchProgress:{total:stores.length,done,active:[...active]}});
  };
  const worker=async()=>{
   while(cursor<stores.length){
    const store=stores[cursor++],config=retailer(store);
    active.add(store);await update(()=>checkpoint(store,'running'));
    let result;
    try{if(!await permitted(config)){const run=newQueryRun(store,message.postcode);run.status='permission-required';run.errors.push({message:'Permite consultar esta tienda para incluirla en la búsqueda.'});result=finishQueryRun(run,[]);}else result=config.mode==='browser'?await collectBrowserStore(store,message.postcode,{items:parsed.items,fetchText:publicFetch,onUsage:usage.page}):await collectHttpQuery(store,parsed.items,{requestedPostcode:message.postcode,fetchText:publicFetch});}
    catch(e){const run=newQueryRun(store,message.postcode);run.errors.push({message:e.message});result=finishQueryRun(run,[]);}
    runs.push(result.run);active.delete(store);done++;await update(()=>checkpoint(store,result.run.status,result));
   }
  };
  await Promise.all(Array.from({length:Math.min(3,stores.length)},()=>worker()));await commit;
  return {observationCount:count,runs,errors:runs.flatMap(r=>(r.errors||[]).map(e=>({store:r.store,...e}))),comparison:compareObserved({...message,acceptAlternatives:true},next)};
 })();try{return await refreshPromise;}finally{refreshPromise=null;await chrome.storage.local.set({searchProgress:null});}
}
async function refresh(postcode=null,store='all'){
 if(refreshPromise)throw new Error('Ya hay una consulta en curso. Espera a que termine.');
 refreshPromise=(async()=>{
  const configs=store==='all'?RETAILERS:[retailer(store)];if(configs.some(c=>!c))throw new Error('Cadena no configurada.');
  let next=await snapshot(),total=0;const runs=[];
  for(const config of configs){
   let result;try{if(!await permitted(config)){const run=newQueryRun(config.name,postcode);run.status='permission-required';run.errors.push({message:'No has permitido el acceso a esta cadena.'});result=finishQueryRun(run,[]);}else result=config.mode==='browser'?await collectBrowserStore(config.name,postcode,{fetchText:publicFetch,onUsage:usage.page}):await collectRetailer(config.name,{requestedPostcode:postcode,fetchText:publicFetch});}catch(error){const run=newQueryRun(config.name,postcode);run.errors.push({message:error.message});result=finishQueryRun(run,[]);}
   next=mergeRetailSnapshot(next,result.run,result.observations);total+=result.observations.length;runs.push(result.run);
   await chrome.storage.local.set({snapshot:next,history:await saveHistory(result.observations),postcode});
  }
  const failed=runs.filter(r=>r.status!=='succeeded');return {run:{status:failed.length?(total?'partial':'failed'):'succeeded',observationCount:total,errors:failed.flatMap(r=>(r.errors||[]).map(e=>({store:r.store,...e})))},runs,locationVerified:false};
 })();try{return await refreshPromise;}finally{refreshPromise=null;}
}
async function automatic(enabled){
 if(enabled){const {postcode}=await chrome.storage.local.get('postcode');if(typeof postcode!=='string'||!/^\d{5}$/.test(postcode))throw new Error('Indica tu código postal y compara la lista antes de activar las actualizaciones.');}
 if(enabled){let allowed=false;for(const r of RETAILERS)if(await permitted(r))allowed=true;if(!allowed)throw new Error('Primero permite el acceso a alguna cadena.');await scheduleRefreshBatch();}
 else await chrome.alarms.clear(ALARM);
 await chrome.storage.local.set({automatic:enabled});return {automatic:enabled};
}
const carts=createCartController(chrome,{compare:async input=>compareObserved(input,await snapshot())});
async function handle(message){
 switch(message?.type){
  case 'resource-usage':return usage.read();
  case 'cart-start':return carts.start(message);
  case 'cart-status':return carts.get();
  case 'cart-resume':return carts.resume();
  case 'cart-cancel':return carts.cancel();
  case 'cart-open':return carts.open();
  case 'clear-data':{
   if(message.confirmed!==true)throw new Error('Confirma el borrado de datos locales.');
   if(resetting||activeRequests||refreshPromise)throw new Error('Espera a que termine la consulta antes de borrar tus datos.');
   resetting=true;
   try{
    await carts.stopForPrivacy();
    await chrome.alarms.clear(ALARM);
    await usage.reset();
    await chrome.storage.local.clear();
    return {cleared:true};
   }catch(error){resetting=false;carts.allowAfterPrivacyFailure();throw error;}
  }
  case 'diagnostics':{
   const s=await snapshot(),{cartJob:cart}=await chrome.storage.local.get('cartJob');
   return privateDiagnostic({resourceUsage:await usage.read(),version:chrome.runtime.getManifest().version,at:new Date().toISOString(),stores:await Promise.all(RETAILERS.map(async r=>{let permission;try{permission=await permitted(r);}catch{permission='check-failed';}const run=s.storeRuns?.[r.name];return {store:r.name,permission,status:run?.status||'not-run',checkedAt:run?.finishedAt||null,pages:run?.pages?.length||0,prices:run?.observationCount||0,issues:(run?.errors||[]).map(e=>issueCode(e))};})),cart:cart?{store:cart.store,status:cart.status,index:cart.index,rows:cart.rows.map(r=>({status:r.status,units:r.cartUnits,target:r.target,pending:r.inFlight})),events:cart.diagnostics||[]}:null});
  }
  case 'status':{const s=await snapshot(),p=await chrome.storage.local.get(['automatic','postcode']);return {lastRun:s.lastRun,count:s.observations.length,stores:sourceStatus(s),automatic:p.automatic===true,postcode:p.postcode||'',locationVerified:false};}
  case 'progress':return (await chrome.storage.local.get('searchProgress')).searchProgress||null;
  case 'catalog':return observedList(await snapshot(),{query:String(message.query||'').slice(0,150)});
  case 'compare':{
   const s=await snapshot();let d=compareObserved(message,s);await chrome.storage.local.set({postcode:message.postcode});
   if(!refreshPromise&&d.items.length&&d.requests.every(r=>r.status==='ready')){
    const key=queryFingerprint(message),existing=s.lookups?.[key]?.stores||{},missing=[];
    for(const r of RETAILERS){const previous=existing[r.name];if(!previous||Date.now()-Date.parse(previous.checkedAt)>LOOKUP_AGE)missing.push(r.name);}
    if(missing.length){const result=await searchList({...message,stores:missing});d=result.comparison;d.searchInfo={stores:result.runs.filter(r=>r.status!=='permission-required').map(r=>r.store),errors:result.errors};}
   }return d;
  }
  case 'search':return searchList(message);
  case 'draft':{if(message.draft){if(typeof message.draft.text!=='string'||message.draft.text.length>5000||JSON.stringify(message.draft).length>30000)throw new Error('Lista demasiado larga.');await chrome.storage.local.set({draft:message.draft});return {saved:true};}return (await chrome.storage.local.get('draft')).draft||null;}
  case 'refresh':if(typeof message.postcode!=='string'||!/^\d{5}$/.test(message.postcode))throw new Error('Código postal no válido.');return refresh(message.postcode,message.store||'all');
  case 'automatic':if(typeof message.enabled!=='boolean')throw new Error('Opción no válida.');return automatic(message.enabled);
  default:throw new Error('Operación no disponible.');
 }
}
chrome.runtime.onMessage.addListener((message,sender,respond)=>{
 if(sender.id!==chrome.runtime.id||!sender.url?.startsWith(chrome.runtime.getURL('')))return false;
 if(resetting){respond({ok:false,error:'La extensión se está reiniciando.'});return false;}
 const clearing=message?.type==='clear-data';
 if(!clearing)activeRequests++;
 const request=['compare','search','refresh'].includes(message?.type)?()=>usage.measure(message.type,()=>handle(message)):()=>handle(message);
 request().then(data=>{if(!clearing)activeRequests--;respond({ok:true,data});if(clearing&&data.cleared)setTimeout(()=>chrome.runtime.reload(),200);},e=>{if(!clearing)activeRequests--;respond({ok:false,error:e.message});});return true;
});
chrome.alarms.onAlarm.addListener(async alarm=>{
 if(resetting||alarm.name!==ALARM||refreshPromise)return;activeRequests++;
 try{const p=await chrome.storage.local.get(['automatic','postcode']);if(!p.automatic)return;await usage.measure('automatic',()=>refresh(p.postcode||''));}
 catch(e){await chrome.storage.local.set({lastBackgroundError:{message:e.message,at:new Date().toISOString()}});}
 finally{activeRequests--;}
});
async function scheduleRefreshBatch(){const current=await chrome.alarms.get(ALARM);if(current?.periodInMinutes===REFRESH_BATCH_MINUTES)return;await chrome.alarms.create(ALARM,{periodInMinutes:REFRESH_BATCH_MINUTES});}
async function restoreAlarm(){if(resetting)return;activeRequests++;try{const {automatic:enabled}=await chrome.storage.local.get('automatic');if(enabled)await scheduleRefreshBatch();}finally{activeRequests--;}}
chrome.runtime.onStartup.addListener(restoreAlarm);chrome.runtime.onInstalled.addListener(restoreAlarm);
chrome.permissions.onRemoved.addListener(async()=>{let allowed=false;for(const r of RETAILERS)if(await permitted(r))allowed=true;if(!allowed)await automatic(false);});
