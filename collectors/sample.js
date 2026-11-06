import {DIA_CATEGORIES,DIA_ORIGIN,fetchDiaText,robotsAllowed,parseDiaPage} from './dia.js';
export async function collectDiaSample({requestedPostcode=null,fetchText=fetchDiaText,sleep=ms=>new Promise(r=>setTimeout(r,ms)),digest=async text=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(text))),b=>b.toString(16).padStart(2,'0')).join(''),onProgress=()=>{}}={}){
 const run={id:crypto.randomUUID(),startedAt:new Date().toISOString(),store:'DIA',requestedPostcode,locationVerified:false,pages:[],errors:[],scheduling:'on-demand'};
 const observations=[];
 try{
  const robots=(await fetchText(DIA_ORIGIN+'/robots.txt')).text;
  for(const [category,path]of DIA_CATEGORIES){
   await sleep(1500);
   try{
    if(!robotsAllowed(robots,path))throw new Error('La ruta está excluida por robots.txt.');
    const url=DIA_ORIGIN+path,response=await fetchText(url),observedAt=new Date().toISOString(),hash=await digest(response.text);
    const parsed=parseDiaPage(response.text,{url,category,observedAt,hash,requestedPostcode,limit:category==='Carne picada'?40:10});
    observations.push(...parsed.observations);
    run.pages.push({category,url,observedAt,hash,httpDate:response.httpDate,cacheAgeSeconds:response.cacheAgeSeconds,count:parsed.observations.length,rejected:parsed.rejected});
    onProgress({category,count:parsed.observations.length});
   }catch(e){run.errors.push({category,message:e.message});if(/403|429/.test(e.message))break;}
  }
 }catch(e){run.errors.push({stage:'robots',message:e.message});}
 run.finishedAt=new Date().toISOString();run.status=run.errors.length?(observations.length?'partial':'failed'):'succeeded';run.observationCount=observations.length;
 return {run,observations};
}
export function mergeSnapshot(previous,run,observations){
 const latest=new Map();
 for(const o of [...(previous?.observations||[]),...observations]){let key;try{const url=new URL(o.productUrl);key=o.store+':'+url.origin+url.pathname.replace(/\/$/,'');}catch{key=o.store+':'+o.storeProductId;}const old=latest.get(key);if(!old||Date.parse(o.observedAt)>=Date.parse(old.observedAt))latest.set(key,o);}
 return {schemaVersion:1,mode:'observed',requestedPostcode:run.requestedPostcode,locationVerified:false,sourceScope:'public-online-without-postcode',maxAgeHours:24,lastRun:run,observations:[...latest.values()]};
}
