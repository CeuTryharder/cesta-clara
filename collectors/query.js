import {queryTargets,PUBLIC_INDEXES,allowedCatalogUrl} from './catalog-index.js';
import {parseRetailHtml,parseEroskiDetail} from './retail-html.js';
import {parseDiaPage,robotsAllowed} from './dia.js';
import {parseDiaDetail} from './discovery.js';
import {retailer} from './registry.js';
import {matchRequest} from '../matching.js';
import {fetchRetailText} from './multi.js';
export const digestText=async text=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(text))),b=>b.toString(16).padStart(2,'0')).join('');
export function newQueryRun(store,postcode){return {id:crypto.randomUUID(),store,startedAt:new Date().toISOString(),requestedPostcode:postcode,locationVerified:false,pages:[],errors:[],scheduling:'shopping-list-query'};}
export function finishQueryRun(run,observations){
 run.finishedAt=new Date().toISOString();run.observationCount=observations.length;
 if(!run.status)run.status=run.errors.length?(observations.length?'partial':'failed'):(observations.length?'succeeded':'empty');
 return {run,observations};
}
export function relevantProduct(item,observation){return matchRequest({...item,constraints:{...item.constraints,minimumMeatPercent:null,allowVacuno:true,brand:{mode:'any'}}},observation).status==='match';}
export async function queryPlan(store,items,{fetchText=fetchRetailText,robots}={}){
 let indexXml;if(PUBLIC_INDEXES[store]){const url=PUBLIC_INDEXES[store];if(robots&&!robotsAllowed(robots,new URL(url).pathname))throw new Error('El índice público no está permitido por robots.txt.');indexXml=(await fetchText(url,{maxBytes:5e6})).text;}
 return queryTargets(store,items,{indexXml});
}
export async function collectHttpQuery(store,items,{requestedPostcode=null,fetchText=fetchRetailText,sleep=ms=>new Promise(r=>setTimeout(r,ms)),digest=digestText}={}){
 const run=newQueryRun(store,requestedPostcode),observations=[],deadline=Date.now()+65000;
 try{
  const config=retailer(store),robots=(await fetchText(config.origins[0]+'/robots.txt')).text,urls=await queryPlan(store,items,{fetchText,robots});
  if(!urls.length){run.status='not-supported';run.errors.push({message:'No se ha localizado una categoría o ficha pública para esta petición.'});return finishQueryRun(run,observations);}
  for(const url of urls.slice(0,6)){
   if(Date.now()>deadline){run.errors.push({message:'Se alcanzó el tiempo de consulta. Se conservan los datos recogidos.'});break;}
   if(!allowedCatalogUrl(url,store)||!robotsAllowed(robots,new URL(url).pathname+new URL(url).search)){run.errors.push({url,message:'La ruta está excluida de la recogida.'});continue;}
   try{
    await sleep(1000);const {text}=await fetchText(url),observedAt=new Date().toISOString(),hash=await digest(text),context={store,url,observedAt,hash,requestedPostcode,limit:60};
    const parsed=store==='DIA'?parseDiaPage(text,{...context,category:'Consulta de la lista',limit:60}):parseRetailHtml(text,context);
    observations.push(...parsed.observations);run.pages.push({url,observedAt,hash,count:parsed.observations.length});
    if(!['DIA','Eroski'].includes(store)||!items.some(i=>i.constraints.minimumMeatPercent!==null))continue;
    const details=parsed.observations.filter(o=>items.some(i=>i.constraints.minimumMeatPercent!==null&&relevantProduct(i,o))).slice(0,3);
    for(const o of details){
     if(Date.now()>deadline)break;if(!robotsAllowed(robots,new URL(o.productUrl).pathname))continue;
     try{await sleep(1000);const response=await fetchText(o.productUrl),at=new Date().toISOString(),sha=await digest(response.text),ctx={store,url:o.productUrl,observedAt:at,hash:sha,requestedPostcode};
      const detail=store==='DIA'?parseDiaDetail(response.text,ctx):parseEroskiDetail(response.text,ctx);observations.push(detail);run.pages.push({url:o.productUrl,observedAt:at,hash:sha,count:1,ingredients:Boolean(detail.ingredients)});
     }catch(e){run.errors.push({url:o.productUrl,message:e.message});if(/403|429/.test(e.message))throw e;}
    }
   }catch(e){run.errors.push({url,message:e.message});if(store==='ALDI'&&/No hay precios públicos válidos/.test(e.message)&&!observations.length)run.status='price-unpublished';if(/403|429/.test(e.message)){run.status='blocked';break;}}
  }
 }catch(e){run.errors.push({message:e.message});if(/403|429/.test(e.message))run.status='blocked';}
 const unique=[...new Map(observations.map(o=>[o.storeProductId,o])).values()];if(unique.length&&run.status==='price-unpublished')run.status='partial';return finishQueryRun(run,unique);
}
