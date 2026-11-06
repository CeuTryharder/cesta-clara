import {readRetailPage} from './shared/collectors/browser-page.js';
import {retailer} from './shared/collectors/registry.js';
import {allowedCatalogUrl,rankCategoryUrls} from './shared/collectors/catalog-index.js';
import {makeObservation} from './shared/collectors/normalize.js';
import {fetchRetailText} from './shared/collectors/multi.js';
import {robotsAllowed} from './shared/collectors/dia.js';
import {queryPlan,newQueryRun,finishQueryRun,digestText,relevantProduct} from './shared/collectors/query.js';
let pageQueue=Promise.resolve(),unclosedPage=null;
async function acquirePage(){let release;const before=pageQueue;pageQueue=new Promise(resolve=>release=resolve);await before;return release;}
async function closePage(tab,onUsage){
 try{await chrome.tabs.remove(tab.id);onUsage('closed');return true;}
 catch(error){if(/No tab with id|Invalid tab ID/i.test(error.message)){onUsage('closed');return true;}unclosedPage={tab,onUsage};return false;}
}
export async function collectBrowserStore(store,postcode,{sleep=ms=>new Promise(r=>setTimeout(r,ms)),pages=null,items=null,onUsage=()=>{},fetchText=(url,options={})=>fetchRetailText(url,{...options,fetchImpl:(target,options)=>fetch(target,{...options,headers:{Accept:'*/*'},credentials:'omit'})})}={}){
 const config=retailer(store);if(!config||config.mode!=='browser')throw new Error('No hay un recolector de navegador para esta cadena.');
 const run=newQueryRun(store,postcode),observations=[],deadline=Date.now()+80000;
 let robots,targets;
 try{
  robots=(await fetchText(config.origins[0]+'/robots.txt')).text;
  targets=items?await queryPlan(store,items,{fetchText,robots}):(pages||config.pages);
  if(!targets.length){run.status='not-supported';run.errors.push({message:'No se encontró una ficha pública para esta petición.'});return finishQueryRun(run,observations);}
 }catch(e){run.errors.push({stage:'index',message:e.message});if(/403|429/.test(e.message))run.status='blocked';return finishQueryRun(run,observations);}
 const queue=[...targets.slice(0,8)],visited=new Set();
 for(let pageIndex=0;pageIndex<queue.length&&pageIndex<8;pageIndex++){const url=queue[pageIndex];if(visited.has(url))continue;visited.add(url);
  if(Date.now()>deadline){run.errors.push({message:'Consulta parcial por límite de tiempo.'});break;}let tab,release;
  try{
   if(!allowedCatalogUrl(url,store)||!robotsAllowed(robots,new URL(url).pathname+new URL(url).search))throw new Error('Ruta fuera del catálogo público o excluida por la fuente.');
   release=await acquirePage();if(Date.now()>deadline){run.errors.push({message:'Consulta parcial por límite de tiempo en espera de otra tienda.'});break;}
   if(unclosedPage){const pending=unclosedPage;if(!await closePage(pending.tab,pending.onUsage))throw new Error('La consulta anterior no se pudo cerrar. Revisa las pestañas de la tienda antes de seguir.');unclosedPage=null;}
   tab=await chrome.tabs.create({url,active:false});onUsage('opened');let result;
   for(let n=0;n<16;n++){
    await sleep(1000);const live=await chrome.tabs.get(tab.id),currentUrl=live.url||live.pendingUrl;if(!currentUrl)continue;
    if(!allowedCatalogUrl(currentUrl,store))throw new Error('La tienda requiere elegir zona o iniciar sesión; abre esa tienda para prepararla.');
    const injected=await chrome.scripting.executeScript({target:{tabId:tab.id},func:readRetailPage,args:[store]});result=injected[0]?.result;if(result?.rows?.length||['/supermercado','/categories'].includes(new URL(url).pathname)&&result?.categories?.length)break;
   }
   if(items&&result?.categories?.length&&!result.rows?.some(o=>items.some(i=>relevantProduct(i,o)))){const related=rankCategoryUrls(items,result.categories,2);for(const c of related)if(!visited.has(c.url)&&!queue.includes(c.url)&&queue.length<8)queue.push(c.url);}
   if(!result?.rows?.length&&result?.categories?.length){run.pages.push({url,count:0,catalogue:true});continue;}
   if(!result?.rows?.length)throw new Error(result?.reason||'No se pudo leer la ficha. Abre la tienda y elige tu zona.');
   const observedAt=new Date().toISOString(),hash=await digestText(JSON.stringify(result.rows)),collected=[];
   for(const raw of result.rows){try{collected.push(makeObservation(raw,{store,url:result.sourceUrl||url,observedAt,hash,requestedPostcode:postcode,method:'browser-visible-dom'}));}catch(e){run.errors.push({url:raw.productUrl||url,message:e.message});}}
   observations.push(...collected);run.pages.push({url,observedAt,count:collected.length,hash});
  }catch(e){run.errors.push({url,message:e.message});if(/zona|inicio de sesi[oó]n|iniciar sesi[oó]n|intervenci[oó]n/i.test(e.message)){run.status=observations.length?'partial':'location-required';break;}}
  finally{try{if(tab?.id&&!await closePage(tab,onUsage))run.errors.push({message:'No se pudo cerrar una pestaña de consulta. No se abrirá otra hasta resolver su cierre.'});}finally{release?.();}}
 }
 return finishQueryRun(run,[...new Map(observations.map(o=>[o.storeProductId,o])).values()]);
}
