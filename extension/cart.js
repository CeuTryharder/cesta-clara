import {cartPageStep} from './cart-page.js';
import {retailer,allowedProductUrl} from './shared/collectors/registry.js';
import {queryFingerprint} from './shared/engine.js';

export function cartPlan(input,comparison){
 const basket=comparison.baskets.find(b=>b.store===input.store);
 if(!basket?.complete)throw new Error('Completa las dudas y encuentra todos los productos antes de preparar la cesta.');
 if(['Lidl','ALDI'].includes(input.store))throw new Error('Esta fuente anuncia productos de tienda física; no ofrece una cesta online de alimentación compatible.');
 const rows=[];
 for(const r of basket.rows){
  const same=rows.find(row=>row.productUrl===r.productUrl),cartUnits=r.packs*(r.minimumPurchaseUnits||1);
  if(same){same.cartUnits+=cartUnits;same.packs+=r.packs;same.totalCents=(same.totalCents||0)+(r.totalCents||0);}
  else rows.push({...r,cartUnits,status:'pending',target:null,inFlight:false});
 }
 if(!rows.length||rows.some(r=>!allowedProductUrl(r.productUrl,input.store)||!Number.isInteger(r.cartUnits)||r.cartUnits<1||r.cartUnits>100))throw new Error('Hay una cantidad o ficha que requiere revisión manual.');
 return {quantityPolicy:'requested-total-v1',id:crypto.randomUUID(),signature:queryFingerprint(input)+'|'+input.store,store:input.store,rows,index:0,status:'ready',message:'Abriendo la tienda…',createdAt:new Date().toISOString()};
}

export function createCartController(api,{compare,sleep=ms=>new Promise(r=>setTimeout(r,ms))}){
 let running=null,starting=false,recoveries=0,privacyStopped=false;
 const backgroundChecks=new Set();
 const missingTab=error=>/No tab with id|Invalid tab ID|tab (?:was |has been )?closed/i.test(error?.message||'');
 function trace(job,event){job.diagnostics=[...(job.diagnostics||[]),{at:new Date().toISOString(),event,index:job.index}].slice(-30);}
 const save=job=>api.storage.local.set({cartJob:job});
 const get=async()=>(await api.storage.local.get('cartJob')).cartJob||null;
 const cancelled=async job=>{if(privacyStopped)return true;const latest=await get();return latest?.id!==job.id||latest?.status==='cancelled';};
 const productUrl=job=>job.rows[Math.min(job.index,job.rows.length-1)].productUrl;
 const safeCartUrl=(value,store)=>{try{const url=new URL(value);return retailer(store).origins.includes(url.origin)&&/^\/(?:cart|basket|carrito|cesta|MiCarrito)\/?$/i.test(url.pathname);}catch{return false;}};
 const validCartUrl=job=>safeCartUrl(job.cartUrl,job.store);
 const sessionPause=state=>Object.assign(new Error(state.reason||'Revisa la ficha en la tienda y pulsa Continuar.'),{pauseCode:state.code||null});
 const requirePermission=async store=>{
  const config=retailer(store);
  if(!config||!await api.permissions.contains({origins:config.origins.map(o=>o+'/*')}))throw new Error('Permite el acceso a esta tienda.');
 };
 async function ensureTab(job){
  if(privacyStopped)throw new Error('La extensión se está reiniciando.');
  let tab;try{if(Number.isInteger(job.tabId))tab=await api.tabs.get(job.tabId);if(tab){await api.tabs.update(tab.id,{active:true});return tab;}}catch(error){if(!missingTab(error))throw error;}
  tab=await api.tabs.create({url:job.status==='complete'&&validCartUrl(job)?job.cartUrl:productUrl(job),active:true});
  job.tabId=tab.id;trace(job,'tab-opened');await save(job);return tab;
 }
 async function recoverTab(job){
  trace(job,'tab-disappeared');
  if(++recoveries>2)throw new Error('La pestaña de la tienda se está cerrando repetidamente. Revisa Chrome y pulsa Continuar para reabrirla.');
  // The stored target and uncertain additions survive replacement of the tab.
  delete job.tabId;return ensureTab(job);
 }
 async function liveTab(job){
  try{return await api.tabs.get(job.tabId);}catch(error){if(!missingTab(error))throw error;return recoverTab(job);}
 }
 async function inspect(job,row,action='read'){
  const live=await liveTab(job);
  // Chrome can expose about:blank as url while pendingUrl already names the product.
  // Do not inject into the old document or interpret this navigation as a login failure.
  if(live.status==='loading')return {state:'loading'};
  const url=live.url||live.pendingUrl;
  if(url==='about:blank'||!url&&live.pendingUrl)return {state:'loading'};
  if(url&&!allowedProductUrl(url,job.store)){let session=false;try{const u=new URL(url);session=retailer(job.store).origins.includes(u.origin)&&(/^\/(?:access|login|identifica|authentication)(?:\/|$)/i.test(u.pathname)||safeCartUrl(url,job.store));}catch{}return {state:'paused',code:session?'session':null,reason:session?'Termina de iniciar sesión en la tienda. Al volver a la cesta o a la ficha, seguiré con los productos pendientes.':'Termina de elegir zona o resolver el aviso en la tienda. Después pulsa Continuar.'};}
  try{
   const response=await api.scripting.executeScript({target:{tabId:job.tabId},func:cartPageStep,args:[row,action]});
   return response[0]?.result||{state:'loading'};
  }catch(error){
   if(missingTab(error)){
    await recoverTab(job);
    if(action==='read')return {state:'loading'};
    throw new Error('Se cerró la pestaña durante la adición. La tienda se ha reabierto; pulsa Continuar para comprobar la cantidad antes de seguir.');
   }
   // A document may be replaced between tabs.get and executeScript. Only reads are retried.
   if(action==='read'&&/frame.*(?:removed|not found)|No frame|document.*(?:unloaded|changed)|Cannot access.*(?:about:blank|contents)/i.test(error.message))return {state:'loading'};
   throw error;
  }
 }
 async function ready(job,row){
  let state;
  for(let n=0;n<30;n++){
   if(await cancelled(job))return {state:'cancelled'};
   await sleep(500);state=await inspect(job,row);
   if(state.state!=='loading')return state;
  }
  return {state:'paused',reason:state?.reason||'La ficha aún no está lista. Espera a que termine de cargar y pulsa Continuar.'};
 }
 async function confirmAddition(job,row,before){
  const direction=row.operation==='remove'?-1:1;
  let state;
  for(let n=0;n<24;n++){
   if(await cancelled(job))return {state:'cancelled'};
   await sleep(500);state=await inspect(job,row);
   if(state.state==='paused')throw sessionPause(state);
   if(state.state==='ready'&&Number.isInteger(state.count)&&(state.count-before)*direction>0)return state;
  }
  throw new Error(state?.reason||'La tienda no ha confirmado el último cambio de cantidad. No se repetirá para evitar duplicados. Revisa la cantidad en la tienda; cuando se refleje, pulsa Continuar.');
 }
 function upgradeQuantities(job){
  if(job.quantityPolicy==='requested-total-v1')return;
  job.quantityPolicy='requested-total-v1';job.index=0;
  for(const row of job.rows){row.target=row.cartUnits;row.status='pending';if(row.inFlight&&job.pauseCode==='session')row.sessionInterrupted=true;}
  if(job.status==='complete')job.status='ready';
  trace(job,'quantity-policy-upgraded');
 }
 function recordPrice(row,state){
  if(Number.isInteger(state.priceCents)&&state.priceCents>0){row.livePriceCents=state.priceCents;row.priceCheckedAt=new Date().toISOString();}
  row.finalCount=state.count;
 }
 async function run(job){
  try{
   job.status='running';job.pauseCode=null;job.message='Abriendo '+job.store+'…';await save(job);
   await ensureTab(job);
   for(;job.index<job.rows.length;job.index++){
    if(await cancelled(job))return;
    const row=job.rows[job.index];if(row.status==='done')continue;
    job.message='Preparando '+(job.index+1)+' de '+job.rows.length+': '+row.name;await save(job);
    const live=await liveTab(job);
    if((live.pendingUrl||live.url)&&live.pendingUrl!==row.productUrl&&live.url!==row.productUrl){try{await api.tabs.update(job.tabId,{url:row.productUrl,active:true});}catch(error){if(!missingTab(error))throw error;await recoverTab(job);}}
    let state=await ready(job,row);
    if(state.state==='cancelled')return;
    if(state.code==='out-of-stock'){row.status='unavailable';row.reason=state.reason;trace(job,'out-of-stock');await save(job);continue;}
    if(state.state!=='ready')throw sessionPause(state);
    if(!Number.isInteger(state.count)||state.count<0)throw new Error('La tienda no ofrece un contador verificable para este producto.');
    if(row.initialCount===undefined)row.initialCount=state.count;
    row.target=row.cartUnits;recordPrice(row,state);
    // A login gate intercepts the click before the store can change its cart.
    // After authentication, read the real count before retrying a refused change.
    if(row.inFlight&&row.sessionInterrupted){row.inFlight=false;row.sessionInterrupted=false;trace(job,'login-count-reconciled');}
    if(row.inFlight&&(!Number.isInteger(row.expectedCount)||(state.count-row.expectedCount)*(row.operation==='remove'?-1:1)<0))throw new Error('La cantidad cambió fuera de la preparación. Revísala en la tienda.');
    // A closed tab or restarted worker can lose the response to a successful click.
    // An unchanged counter does not prove that the write failed: never replay it.
    if(row.inFlight&&state.count===row.expectedCount){
     state=await confirmAddition(job,row,row.expectedCount);
     if(state.state==='cancelled')return;

    }
    row.inFlight=false;
    if(Math.abs(state.count-row.target)%(row.minimumPurchaseUnits||1)!==0)throw new Error('La cantidad existente no permite ajustar el mínimo de compra con los botones de esta tienda. Revisa esta línea en el carrito antes de continuar.');
    for(let attempt=0;state.count!==row.target&&attempt<100;attempt++){
     if(await cancelled(job))return;
     const before=state.count;row.operation=before>row.target?'remove':'add';row.expectedCount=before;row.inFlight=true;await save(job);
     const click=await inspect(job,row,row.operation);
     if(click.state!=='clicked'){
      row.inFlight=false;
      if(click.state==='loading'){state=await ready(job,row);if(state.state==='cancelled')return;if(state.state==='ready')continue;}
      throw sessionPause({...click,reason:click.reason||state.reason||'El botón todavía no está listo. Revisa la tienda y pulsa Continuar.'});
     }
     state=await confirmAddition(job,row,before);
     if(state.state==='cancelled')return;
     row.inFlight=false;job.cartUrl=state.cartUrl||job.cartUrl;await save(job);
    }
    if(state.count!==row.target)throw new Error('La cantidad final no coincide con la prevista. Revísala en la tienda.');
    recordPrice(row,state);job.cartUrl=state.cartUrl||job.cartUrl;
    row.status='done';job.message=(job.index+1)+' de '+job.rows.length+' productos preparados';await save(job);
   }
   if(await cancelled(job))return;
   const pending=job.rows.filter(r=>r.status!=='done');if(pending.length){job.status='paused';job.pauseCode='out-of-stock';job.index=job.rows.findIndex(r=>r.status!=='done');job.message='Se han preparado '+(job.rows.length-pending.length)+' de '+job.rows.length+' productos. Quedan '+pending.length+' productos agotados. Actualiza precios para buscar una alternativa disponible.';return;}
   job.status='complete';job.message='Cantidades ajustadas a tu lista y comprobadas en la tienda. El envío y otros productos que ya tenías en el carrito se cobran aparte.';
   job.verifiedSubtotalCents=job.rows.every(r=>Number.isInteger(r.livePriceCents))?job.rows.reduce((sum,r)=>sum+r.livePriceCents*r.cartUnits,0):null;
   job.quotedSubtotalCents=job.rows.every(r=>Number.isInteger(r.totalCents))?job.rows.reduce((sum,r)=>sum+r.totalCents,0):null;
   // Opening the completed basket is separate from adding products. A navigation error
   // must never turn a completed job into an apparently uncompleted purchase to retry.
   try{
    if(validCartUrl(job))await api.tabs.update(job.tabId,{url:job.cartUrl,active:true});
    else{const opened=await inspect(job,job.rows.at(-1),'open-cart');if(opened.state!=='opened')job.message+=' Abre el carrito desde la cabecera de la tienda.';}
   }catch{job.message+=' Abre el carrito desde la cabecera de la tienda.';}
  }catch(error){if(error.pauseCode==='session'&&job.rows[job.index]?.inFlight)job.rows[job.index].sessionInterrupted=true;job.status='paused';job.pauseCode=error.pauseCode||null;job.message=missingTab(error)?'La pestaña de la tienda se ha cerrado. Pulsa Continuar para reabrirla y comprobar las cantidades.':error.message;trace(job,missingTab(error)?'tab-missing':job.pauseCode==='session'?'waiting-for-login':'paused');}
  finally{if(!await cancelled(job))await save(job);running=null;
   // Authentication may have finished before the pause was persisted. Check once
   // after saving it, so this transition also works with the side panel closed.
   if(job.status==='paused'&&['session','intervention'].includes(job.pauseCode)){try{const tab=await api.tabs.get(job.tabId);await controller.onTabUpdated(job.tabId,{status:tab.status},tab);}catch{}}
  }
 }
 function launch(job){upgradeQuantities(job);recoveries=0;running=run(job);running.catch(()=>{running=null;});return job;}
 const controller={
  async get(){
   const job=await get();
   if(job?.status==='running'&&!running&&!starting){job.status='paused';job.message='La preparación se interrumpió. Pulsa Continuar para comprobar las cantidades y seguir.';await save(job);}
   if(job?.status==='paused'&&['session','intervention'].includes(job.pauseCode)&&!running&&!starting){try{const tab=await api.tabs.get(job.tabId);await controller.onTabUpdated(job.tabId,{status:tab.status},tab);return await get();}catch{}}
   return job;
  },
  async start(input){
   if(privacyStopped)throw new Error('La extensión se está reiniciando.');
   if(running||starting)throw new Error('Ya se está preparando una cesta.');starting=true;
   try{
    await requirePermission(input.store);
    const previous=await get(),signature=queryFingerprint(input)+'|'+input.store;
    if(input.newPurchase!==undefined&&typeof input.newPurchase!=='boolean')throw new Error('La opción de nueva compra no es válida.');
    if(input.newPurchase===true&&(!previous||!['complete','cancelled'].includes(previous.status)))throw new Error('Termina o detén la preparación actual antes de empezar otra compra.');
    // Preserve an unfinished pre-€/kg job when its selected products are unchanged.
    // Never turn its partially fulfilled target into a second full shopping list.
    if(previous&&previous.signature!==signature&&previous.store===input.store&&input.newPurchase!==true){let legacy=false;
     try{const old=JSON.parse(previous.signature.slice(0,-('|'+input.store).length)),current=JSON.parse(queryFingerprint(input));legacy=JSON.stringify(old)===JSON.stringify(current.slice(1));}catch{}
     if(legacy){const plan=cartPlan(input,await compare(input)),same=previous.rows.length===plan.rows.length&&previous.rows.every((r,i)=>r.productUrl===plan.rows[i].productUrl&&r.cartUnits===plan.rows[i].cartUnits);
      if(same){previous.signature=signature;await save(previous);}else if(previous.status!=='cancelled'&&previous.rows.some(r=>r.target!==null||r.inFlight||r.status==='done'))throw new Error('La nueva comparación elige otros productos por €/kg. Revisa lo ya añadido en la tienda y detén la preparación anterior antes de empezar la nueva cesta.');
     }
    }
    if(previous?.signature===signature&&input.newPurchase!==true){
     upgradeQuantities(previous);await save(previous);await ensureTab(previous);
     return previous.status==='complete'?previous:launch(previous);
    }
    const job=cartPlan(input,await compare(input));await save(job);await ensureTab(job);return launch(job);
   }finally{starting=false;}
  },
  async resume(){
   if(privacyStopped)throw new Error('La extensión se está reiniciando.');
   if(running||starting)throw new Error('La cesta sigue en curso.');starting=true;
   try{const job=await get();if(!job)return job;upgradeQuantities(job);if(['complete','cancelled'].includes(job.status))return job;await requirePermission(job.store);await ensureTab(job);return launch(job);}
   finally{starting=false;}
  },
  async open(){const job=await get();if(!job)return null;await requirePermission(job.store);await ensureTab(job);return job;},
  async onTabUpdated(tabId,change,tab){
   if(privacyStopped||running||starting||change.status!=='complete')return;
   const checking=(async()=>{
   const job=await get();if(!job||job.tabId!==tabId||job.status!=='paused'||!['session','intervention'].includes(job.pauseCode))return;
   const url=tab?.url;if(!url||!safeCartUrl(url,job.store)&&!allowedProductUrl(url,job.store))return;
   // A login dialog may still cover a product URL. Do not restart until its
   // actual product controls can be read again; never inspect an account page.
   if(!safeCartUrl(url,job.store)){const state=await inspect(job,job.rows[job.index]);if(state.state!=='ready')return;}
   return controller.resume();
   })();
   backgroundChecks.add(checking);
   try{return await checking;}finally{backgroundChecks.delete(checking);}
  },
  async cancel(){const job=await get();if(job){job.status='cancelled';job.message='Preparación detenida. Los productos ya añadidos permanecen en la tienda.';await save(job);}return job;},
  async stopForPrivacy(){
   if(starting)throw new Error('Espera a que termine de abrirse la tienda antes de borrar los datos.');
   privacyStopped=true;
   try{await controller.cancel();await running;await Promise.allSettled([...backgroundChecks]);}catch(error){privacyStopped=false;throw error;}
  },
  allowAfterPrivacyFailure(){privacyStopped=false;}
 };
 api.tabs?.onUpdated?.addListener((tabId,change,tab)=>{controller.onTabUpdated(tabId,change,tab).catch(()=>{});});
 return controller;
}
