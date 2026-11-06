import {DIA_DISCOVERY_CATEGORIES} from './dia-categories.js';
import {parseDiaPage,robotsAllowed} from './dia.js';
import {fetchRetailText} from './multi.js';
import {makeObservation} from './normalize.js';
import {normalizeText} from '../engine.js';
import {allowedProductUrl} from './registry.js';
const aliases={ternera:'vacuno',brocoli:'verduras',calabacin:'verduras',zanahoria:'verduras',patatas:'verduras',manzanas:'frutas',platanos:'frutas',avena:'cereales',cafe:'cafe',macarrones:'pastas'};
export function discoveryPlan(items){
 const plans=[];
 for(const item of items){
  const terms=(item.query||'').split(' ').map(w=>aliases[w]||w),meat=item.id==='carne';
  const ranked=DIA_DISCOVERY_CATEGORIES.map(c=>{
   const name=normalizeText(c.name);
   let score=terms.reduce((n,w)=>n+(w.length>2&&name.includes(w)?3:0),0);
   if(meat&&item.constraints.cut==='picada'&&name.includes('carne picada'))score+=20;
   if(name.startsWith('todo '))score-=1;
   if(terms.some(w=>name===w))score+=4;
   if(/congelad|conserva|preparad/.test(name)&&!terms.some(w=>/congelad|conserva|preparad/.test(w)))score-=10;
   return {...c,score};
  }).filter(c=>c.score>0).sort((a,b)=>b.score-a.score);
  const first=ranked[0];if(first&&!plans.some(p=>p.url===first.url))plans.push({store:'DIA',url:first.url,category:first.name});
 }
 // Deliberately bounded. A second request can cover remaining categories.
 return plans.slice(0,3);
}
export function parseDiaDetail(html,{url,observedAt,hash,requestedPostcode=null}){
 const raw=html.match(/<script\b[^>]*id=["']vike_pageContext["'][^>]*>([\s\S]*?)<\/script>/i)?.[1];
 if(!raw)throw new Error('La ficha no contiene datos de producto reconocibles.');
 const state=JSON.parse(raw).INITIAL_STATE,p=state?.product,seo=state?.seoScriptData,name=p?.primary_info?.title,id=String(p?.sku_id||''),price=Math.round(Number(p?.prices?.price)*100);
 if(!p||!name||!id||seo?.name!==name||seo?.priceCurrency!=='EUR'||Math.round(Number(seo?.price)*100)!==price||new URL(seo.url).pathname!==new URL(url).pathname||!new URL(url).pathname.endsWith('/p/'+id))throw new Error('El precio o la identidad de la ficha no coinciden entre representaciones.');
 const ingredients=String(p.ingredients?.text||'').replace(/<script\b[\s\S]*?<\/script>/gi,'').replace(/<[^>]+>/g,' ').replace(/&nbsp;/g,' ').replace(/&amp;/g,'&').replace(/&#(\d+);/g,(_,n)=>String.fromCharCode(Number(n))).replace(/\s+/g,' ').trim();
 return makeObservation({id,name,priceCents:price,quantityText:name,productUrl:url,ingredients,conditionalPrice:seo.hasPriceWithDiscount!==false||p.prices.is_club_price===true},{store:'DIA',url,observedAt,hash,requestedPostcode,method:'public-html-product-ingredients'});
}
export async function discoverDia(items,{requestedPostcode=null,fetchText=fetchRetailText,sleep=ms=>new Promise(r=>setTimeout(r,ms)),digest=async s=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(s))),b=>b.toString(16).padStart(2,'0')).join('')}={}){
 const plans=discoveryPlan(items),run={id:crypto.randomUUID(),store:'DIA',startedAt:new Date().toISOString(),requestedPostcode,locationVerified:false,pages:[],errors:[],scheduling:'request-discovery'},observations=[],deadline=Date.now()+90000;
 try{
  const robots=(await fetchText('https://www.dia.es/robots.txt')).text;
  if(!plans.length)run.errors.push({message:'No se ha identificado una categoría pública para esta búsqueda. Conservamos la petición para que puedas concretarla.'});
  for(const plan of plans){
   if(Date.now()>deadline)throw new Error('Se ha alcanzado el tiempo máximo de consulta. Conservamos las fichas ya revisadas.');
   if(!robotsAllowed(robots,new URL(plan.url).pathname))throw new Error('La fuente excluye esta ruta en robots.txt.');
   await sleep(1500);const {text}=await fetchText(plan.url),observedAt=new Date().toISOString(),hash=await digest(text),parsed=parseDiaPage(text,{url:plan.url,category:plan.category,observedAt,hash,limit:40,requestedPostcode});
   observations.push(...parsed.observations);run.pages.push({url:plan.url,observedAt,hash,count:parsed.observations.length});
   // Inspect ingredients on relevant meat cards. No search endpoint or private API.
   const details=parsed.observations.filter(o=>/picad|molid/i.test(o.name)&&items.some(i=>i.id==='carne')).slice(0,6);
   for(const card of details){
    if(Date.now()>deadline)throw new Error('Se ha alcanzado el tiempo máximo de consulta.');
    try{if(!allowedProductUrl(card.productUrl,'DIA')||!robotsAllowed(robots,new URL(card.productUrl).pathname))continue;await sleep(1500);const response=await fetchText(card.productUrl),at=new Date().toISOString(),detailHash=await digest(response.text);
     const detail=parseDiaDetail(response.text,{url:card.productUrl,observedAt:at,hash:detailHash,requestedPostcode});observations.push(detail);run.pages.push({url:card.productUrl,observedAt:at,hash:detailHash,count:1,ingredients:Boolean(detail.ingredients)});
    }catch(e){run.errors.push({url:card.productUrl,message:e.message});if(/403|429/.test(e.message))throw e;}
   }
  }
 }catch(e){run.errors.push({message:e.message});}
 run.finishedAt=new Date().toISOString();run.observationCount=observations.length;run.status=run.errors.length?(observations.length?'partial':'failed'):'succeeded';return {run,observations};
}
