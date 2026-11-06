import {makeObservation} from './normalize.js';
export const htmlEntities=s=>String(s).replace(/&quot;/g,'"').replace(/&#39;|&apos;/g,"'").replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&nbsp;/g,' ').replace(/&#(\d+);/g,(_,n)=>String.fromCharCode(Number(n)));
const clean=s=>htmlEntities(String(s).replace(/<[^>]+>/g,' ')).replace(/\s+/g,' ').trim();
const price=s=>Math.round(Number(String(s).replace(/[^\d,.]/g,'').replace(',','.'))*100);
function scriptJson(html,id){const scripts=[...html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)],m=scripts.find(m=>new RegExp('id=["\\\']'+id+'["\\\']').test(m[1]));if(!m)throw new Error('No se encuentra la estructura pública de la fuente.');return JSON.parse(m[2]);}
function nuxtDecode(t,index,seen=new Set()){
 if(index<0)return null;const v=t[index];if(!v||typeof v!=='object')return v;if(seen.has(index))return null;const next=new Set(seen);next.add(index);
 if(Array.isArray(v)){if(typeof v[0]==='string'&&['ShallowReactive','Reactive','Ref','ShallowRef'].includes(v[0]))return nuxtDecode(t,v[1],next);return v.map(i=>nuxtDecode(t,i,next));}
 return Object.fromEntries(Object.entries(v).map(([k,i])=>[k,nuxtDecode(t,i,next)]));
}
function plusOnly(value){if(!value||typeof value!=='object')return false;return Object.entries(value).some(([key,v])=>/lidl.?plus/i.test(key)&&Boolean(v)||typeof v==='object'&&plusOnly(v));}
function aldiRows(html,context){
 const raw=scriptJson(html,'__NEXT_DATA__').props.pageProps.apiData,api=typeof raw==='string'?JSON.parse(raw):raw,products=[];
 for(const entry of api||[]){products.push(...(entry[1]?.res?.products||[]),...Object.values(entry[1]?.res?.algoliaDataMap||{}));}
 const rows=[],seen=new Set();
 for(const p of products){
  const current=p.currentPrice;if(!current?.priceValue||seen.has(p.objectID))continue;seen.add(p.objectID);
  const productUrl=p.productSlug?'https://www.aldi.es/producto/'+p.productSlug+'.html':context.url;
  try{rows.push(makeObservation({id:p.objectID,name:p.name+' '+(p.brandName||''),brand:p.brandName,priceCents:Math.round(current.priceValue*100),quantityText:p.salesUnit,productUrl,availability:p.isAvailable===false?'unavailable':'unknown',validFrom:current.validFrom?new Date(current.validFrom*1000).toISOString():null,validUntil:current.validUntil?new Date(current.validUntil*1000).toISOString():null,conditionalPrice:Boolean(p.isComingSoon||p.isRecall)}, {...context,channel:'in-store-advertised'}));}catch{}
  if(rows.length>=(context.limit||60))break;
 }return rows;
}
function lidlRows(html,context){
 const grid=[...html.matchAll(/data-grid-data="([^"]+)"/g)].flatMap(m=>{try{return[JSON.parse(htmlEntities(m[1]))];}catch{return[];}});
 if(grid.length){
  return grid.flatMap(p=>{
   const clubs=Object.values(p.regionsPrices||{}).map(r=>r.currentLidlPlusPrice?.price).filter(pr=>Number.isFinite(pr?.price));
   const club=new Set(clubs.map(pr=>pr.price)).size===1?clubs[0]:null;
   const clubOnly=!Number.isFinite(p.price?.price),pr=clubOnly?club:p.price,regional=clubOnly?club:Object.values(p.regionsPrices||{}).map(r=>r.currentPrice).find(r=>r?.price===pr?.price);
   if(!p.havingPrice||!Number.isFinite(pr?.price)||!regional||pr.currencyCode!=='EUR')return [];
   try{return [makeObservation({id:p.erpNumber,name:p.fullTitle||p.title,brand:p.brand?.name,productUrl:new URL(p.canonicalUrl,context.url).href,priceCents:Math.round(pr.price*100),declaredSpecies:/Carne de vacuno/i.test(p.keyfacts?.wonCategoryPrimary||'')?'vacuno':null,speciesEvidence:p.keyfacts?.wonCategoryPrimary?{text:p.keyfacts.wonCategoryPrimary,sourceUrl:context.url}:null,quantityText:pr.packaging?.text,conditionalPrice:clubOnly||plusOnly({price:pr,regional}),validFrom:regional.startDate,validUntil:regional.endDate}, {...context,channel:'in-store-advertised'})];}catch{return [];}
  });
 }
 const t=scriptJson(html,'__NUXT_DATA__'),i=t.findIndex(v=>v&&typeof v==='object'&&!Array.isArray(v)&&'erpNumber'in v);if(i<0)throw new Error('Producto Lidl no encontrado.');const p=nuxtDecode(t,i),pr=p.price;
 const ld=[...html.matchAll(/<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/gi)].flatMap(m=>{try{return[JSON.parse(m[1])];}catch{return[];}}).find(d=>d['@type']==='Product'),offer=Array.isArray(ld?.offers)?ld.offers[0]:ld?.offers;
 if(!Number.isFinite(pr.price)||offer?.price===undefined||Math.abs(pr.price-Number(offer.price))>.001)throw new Error('La ficha de Lidl no publica un precio coherente.');
 const regional=Object.values(p.regionsPrices||{}).map(v=>v.currentPrice).find(v=>v.price===pr.price);
 return [makeObservation({id:p.erpNumber,name:p.keyfacts.fullTitle,brand:p.info?.brand?.name,priceCents:Math.round(pr.price*100),quantityText:pr.packaging?.text,ingredients:typeof ld.ingredients==='string'?ld.ingredients:null,conditionalPrice:(p.lidlPlus?.length>0)||plusOnly(regional),validFrom:regional?.startDate,validUntil:regional?.endDate,ean:ld.gtin13?.[0]}, {...context,channel:'in-store-advertised'})];
}
function eroskiRows(html,context){
 const cards=html.split(/<div class="col border-0 product-item-lineal /).slice(1),rows=[],seen=new Set();
 for(const card of cards){
  const tag=card.match(/<a\b[^>]*class="product-title-link"[^>]*>/)?.[0];if(!tag)continue;const metrics=tag.match(/data-metrics="([^"]+)"/)?.[1],url=htmlEntities(tag.match(/href="([^"]+)"/)?.[1]||'');if(!metrics)continue;
  try{const item=JSON.parse(htmlEntities(metrics)).ecommerce.items[0],visible=card.match(/class="price-offer-now"[^>]*>([^<]+)/)?.[1];if(seen.has(item.item_id)||!visible||price(visible)!==Math.round(item.price*100))continue;seen.add(item.item_id);
   const before=card.match(/class="price-before"[^>]*>([\s\S]*?)<\/span>/)?.[1]||'';
   rows.push(makeObservation({id:item.item_id,name:item.item_name,brand:item.item_brand,priceCents:price(visible),productUrl:url,quantityText:item.item_name,availability:/agotado|sin stock/i.test(clean(card))?'unavailable':'unknown',conditionalPrice:/\d/.test(before)||/only.?club|exclusiv[oa].{0,20}club|2ª|3x2/i.test(card)},context));
   if(rows.length>=(context.limit||10))break;
  }catch{}
 }return rows;
}
export function eroskiIngredients(html){return clean(html.match(/feature-text-ingredients[\s\S]{0,600}?<p[^>]*class="text"[^>]*>([\s\S]*?)<\/p>/i)?.[1]||'');}
export function parseEroskiDetail(html,context){
 const section=html.slice(html.indexOf('<h1')),name=clean(section.match(/<h1[^>]*>([\s\S]*?)<\/h1>/)?.[1]||''),visible=section.match(/itemprop="price"[^>]*>([^<]+)/)?.[1],id=new URL(context.url).pathname.match(/\/productdetail\/(\d+)/)?.[1];
 if(!name||!visible||!id)throw new Error('No se ha podido verificar la ficha de Eroski.');
 return makeObservation({id,name,priceCents:price(visible),quantityText:name,ingredients:eroskiIngredients(section),conditionalPrice:/\d/.test(clean(section.match(/class="price-before"[^>]*>([\s\S]*?)<\/span>/)?.[1]||''))},context);
}
export function parseRetailHtml(html,context){
 let observations;
 if(context.store==='ALDI')observations=aldiRows(html,context);
 else if(context.store==='Lidl')observations=lidlRows(html,context);
 else if(context.store==='Eroski')observations=eroskiRows(html,context);
 else throw new Error('Extractor HTML no disponible para esta cadena.');
 if(!observations.length)throw new Error('No hay precios públicos válidos en esta página.');
 return {observations,rejected:[]};
}
