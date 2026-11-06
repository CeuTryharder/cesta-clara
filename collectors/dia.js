// Public HTML only: no private APIs, session impersonation or access-control bypass.
export const DIA_ORIGIN='https://www.dia.es';
export const DIA_CATEGORIES=[
 ['Leche','/huevos-leche-y-mantequilla/leche/c/L2051'],
 ['Huevos','/huevos-leche-y-mantequilla/huevos/c/L2055'],
 ['Arroz','/arroz-pastas-y-legumbres/arroz/c/L2042'],
 ['Pasta','/arroz-pastas-y-legumbres/macarrones-espaguetis-y-pastas-secas/c/L2044'],
 ['Aceite','/aceites-salsas-y-especias/aceites/c/L2046'],
 ['Carne picada','/carnes/hamburguesas-carne-picada-y-albondigas/c/L2017']
];
export function robotsAllowed(text,path,userAgent='CestaClaraResearch'){
 const groups=[];let agents=[],rules=[],hasRules=false;
 const flush=()=>{if(agents.length)groups.push({agents,rules});agents=[];rules=[];hasRules=false;};
 for(const raw of text.split(/\r?\n/)){
  const line=raw.split('#')[0].trim();const colon=line.indexOf(':');if(colon<0)continue;
  const key=line.slice(0,colon).trim().toLowerCase(),value=line.slice(colon+1).trim();
  if(key==='user-agent'){if(hasRules)flush();agents.push(value.toLowerCase());}
  else if(['allow','disallow'].includes(key)&&agents.length){hasRules=true;if(value)rules.push({allow:key==='allow',path:value});}
 }flush();
 const agent=userAgent.toLowerCase();const specific=groups.filter(g=>g.agents.some(a=>a!=='*'&&agent.includes(a)));
 const selected=specific.length?specific:groups.filter(g=>g.agents.includes('*'));
 const matches=selected.flatMap(g=>g.rules).filter(r=>new RegExp('^'+r.path.split('*').map(x=>x.replace(/[.+?^{}()|[\]\\]/g,'\\$&')).join('.*').replace(/\\\$$/,'$')).test(path));
 matches.sort((a,b)=>b.path.length-a.path.length||Number(b.allow)-Number(a.allow));
 return matches[0]?.allow??true;
}
export function packageFromName(name){
 const s=name.toLowerCase().replace(/,/g,'.');
 let m=s.match(/(?:(\d+)\s*[x×]\s*)?(\d+(?:\.\d+)?)\s*(ml|kg|g|l|unidades?|uds?)\s*(?:aprox\.?)?\s*$/i);
 if(!m)return null;
 let quantity=Number(m[2])*(Number(m[1])||1);let unit=m[3];
 if(unit==='ml'){quantity/=1000;unit='l';}if(unit==='g'){quantity/=1000;unit='kg';}if(unit.startsWith('u'))unit='ud';
 return {quantity:Math.round(quantity*1e6)/1e6,unit};
}
function cents(value){if((typeof value!=='number'&&typeof value!=='string')||value==='')return null;const n=Number(value);return Number.isFinite(n)&&n>0&&n<10000?Math.round(n*100):null;}
export function parseDiaPage(html,{url,category,observedAt,hash,limit=10,requestedPostcode=null}){
 const raw=html.match(/<script\b[^>]*id=["']vike_pageContext["'][^>]*>([\s\S]*?)<\/script>/i)?.[1];
 if(!raw)throw new Error('No se ha encontrado el estado público del catálogo.');
 const state=JSON.parse(raw).INITIAL_STATE;
 const items=state?.l2?.plp_items; if(!Array.isArray(items)||!items.length)throw new Error('El catálogo público está vacío o ha cambiado de formato.');
 const marking=state.seoProductMarkingData?.itemListElement;
 if(!Array.isArray(marking))throw new Error('Falta la segunda representación de precios para validación.');
 const observations=[],rejected=[];
 for(const item of items){
  if(observations.length>=limit)break;
  const id=String(item.sku_id??''),name=item.display_name,price=cents(item.prices?.price);
  const structured=marking.find(e=>e.url?.endsWith('/p/'+id));
  const productUrl=new URL(item.url||'/',DIA_ORIGIN);
  if(!/^[a-z0-9]+$/i.test(id)||typeof name!=='string'||!name.trim()||price===null||item.prices?.currency!=='EUR'||typeof item.prices.is_club_price!=='boolean'||typeof item.prices.is_promo_price!=='boolean'||productUrl.origin!==DIA_ORIGIN||!productUrl.pathname.endsWith('/p/'+id)||structured?.item?.offers?.priceCurrency!=='EUR'||cents(structured?.item?.offers?.price)!==price||structured?.item?.name!==name){rejected.push({id,reason:'Datos incompletos o discrepancia entre representaciones.'});continue;}
  const pack=packageFromName(name),perUnit=cents(item.prices?.price_per_unit);
  const promotion=(item.promotions||[]).map(p=>({description:String(p.description||''),clubOnly:p.only_club_dia===true,onlineOnly:p.exclusive_online===true}));
  observations.push({store:'DIA',storeProductId:id,name,estimatedPrice:/aprox|peso variable/i.test(name),brand:String(item.brand||''),category,packageQuantity:pack?.quantity??null,packageUnit:pack?.unit??null,priceCents:price,unitPriceCents:perUnit,unitPriceBasis:item.prices.measure_unit??null,currency:'EUR',postcode:null,requestedPostcode,locationVerified:false,channel:'online-public',availability:(typeof item.units_in_stock==='number'&&item.units_in_stock<=0)||item.units_in_stock==='0'?'unavailable':'unknown',productUrl:productUrl.href,sourceUrl:url,observedAt,sourceMethod:'public-html-structured-state',collectorVersion:'dia-0.3.0',evidenceSha256:hash,promotion,conditionalPrice:item.prices.is_club_price===true||item.prices.is_promo_price===true||promotion.length>0});
 }
 if(!observations.length)throw new Error('Ningún producto ha superado las validaciones.');
 return {observations,rejected};
}
export async function fetchDiaText(url,{fetchImpl=fetch,sleep=ms=>new Promise(r=>setTimeout(r,ms))}={}){
 const parsed=new URL(url);if(parsed.origin!==DIA_ORIGIN)throw new Error('Origen no permitido.');
 for(let attempt=0;attempt<2;attempt++){
  const r=await fetchImpl(url,{headers:{'User-Agent':'CestaClaraResearch/0.2','Accept':'*/*'},redirect:'error',signal:AbortSignal.timeout(20000)});
  if(r.status===403||r.status===429)throw new Error('Acceso detenido por la fuente (HTTP '+r.status+').');
  if(r.status>=500&&attempt===0){await sleep(3000);continue;}
  if(!r.ok)throw new Error('Respuesta HTTP '+r.status);
  const html=await r.text();if(html.length>3e6)throw new Error('Respuesta excesiva.');
  return {text:html,httpDate:r.headers.get('date'),cacheAgeSeconds:r.headers.get('age')};
 }throw new Error('No se pudo consultar la fuente.');
}
