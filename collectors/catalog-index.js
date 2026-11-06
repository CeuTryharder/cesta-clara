import {RETAILERS,retailer,allowedProductUrl} from './registry.js';
import {DIA_DISCOVERY_CATEGORIES} from './dia-categories.js';
import {EROSKI_CATEGORIES} from './eroski-categories.js';
import {LIDL_CATEGORIES} from './lidl-categories.js';
import {normalizeText} from '../engine.js';
import {matchRequest,BOVINE_WORDS} from '../matching.js';
export const PUBLIC_INDEXES={
 Mercadona:'https://tienda.mercadona.es/sitemap.xml',
 ALDI:'https://www.aldi.es/sitemaps/.aldi-nord-sitemap-products.xml',
 Consum:'https://tienda.consum.es/sitemap_product_es.xml'
};
const aliases={brocoli:'verduras',calabacin:'verduras',zanahoria:'verduras',patata:'verduras',patatas:'verduras',manzanas:'frutas',platanos:'frutas',avena:'cereales',macarrones:'pasta'};
export function productUrlsFromSitemap(xml,store){
 return [...new Set([...xml.matchAll(/<loc>\s*([^<]+)\s*<\/loc>/g)].map(m=>m[1].trim().replace(/&amp;/g,'&')).filter(url=>allowedProductUrl(url,store)))];
}
export function rankProductUrls(items,urls,limit=8){
 const ranked=urls.map(url=>{
  let name;try{name=decodeURIComponent(new URL(url).pathname).replace(/[-/_]/g,' ');}catch{return {url,score:0};}
  const score=items.reduce((total,item)=>{
   const relaxed={...item,constraints:{...item.constraints,allowVacuno:true,minimumMeatPercent:null,brand:item.constraints.brand?.mode==='private'?{mode:'any'}:item.constraints.brand}};
   if(matchRequest(relaxed,{name}).status==='match')return total+100;
   return total;
  },0);
  return {url,score};
 }).filter(p=>p.score>0).sort((a,b)=>b.score-a.score);
 // Round-robin avoids filling the budget with milk while omitting requested meat.
 const chosen=[];for(const item of items){const candidates=ranked.filter(p=>matchRequest({...item,constraints:{...item.constraints,allowVacuno:true,minimumMeatPercent:null,brand:item.constraints.brand?.mode==='private'?{mode:'any'}:item.constraints.brand}},{name:decodeURIComponent(new URL(p.url).pathname).replace(/[-/_]/g,' ')}).status==='match');for(const p of candidates.slice(0,3))if(!chosen.includes(p.url)&&chosen.length<limit)chosen.push(p.url);}
 return chosen;
}
export function rankCategoryUrls(items,categories,limit=3){
 const chosen=[];
 for(const item of items){
  const terms=item.query.split(' ').map(w=>aliases[w]||w),meat=item.id==='carne';
  const scored=categories.map(c=>{
   const name=normalizeText(c.name),path=normalizeText(decodeURIComponent(new URL(c.url).pathname));let score=terms.reduce((n,t)=>n+(t.length>2&&name.includes(t)?4:0),0);
   if(meat){const desired=item.constraints.cut==='picada'?'picad':item.constraints.species==='cerdo'?'cerdo':item.constraints.species==='pollo'?'pollo':'vacuno';
    if(desired==='vacuno'&&/^(vacuno|ternera|carne bovina)$/.test(name))score+=25;
    if(desired==='picad'&&/picad/.test(name)&&!/batidora/.test(path))score+=25;
    if(name.includes(desired))score+=8;
    if(/^(carne|carnes)$/.test(name))score+=6;
    if(item.constraints.cut!=='picada'&&/picad|hamburgues/.test(name))score-=30;
   }
   if(/^(alimentacion|despensa|desayuno|frescos|fruta y verdura|lacteos)/.test(name)&&score===0){if(meat&&/frescos/.test(name)||!meat&&['arroz','pasta','cafe','azucar','sal','avena','aceite'].includes(item.id)&&/alimentacion|despensa|desayuno/.test(name))score+=2;}
   if(/electro|bebe|juguete|mascota/.test(path))score-=50;
   if(/congelad|conserva|preparad/.test(name)&&!terms.some(t=>/congelad|conserva|preparad/.test(t)))score-=12;
   if(item.id==='leche'&&item.query==='leche'&&name==='leche entera')score+=15;
   if(name.startsWith('todo '))score-=1;
   if(terms.some(t=>name===t))score+=8;
   return {...c,score};
  }).filter(c=>c.score>0).sort((a,b)=>b.score-a.score||a.url.length-b.url.length);
  if(scored[0]&&!chosen.some(c=>c.url===scored[0].url))chosen.push(scored[0]);
 }
 return chosen.slice(0,limit).map(({url,name})=>({url,name}));
}
const cf='https://www.carrefour.es/supermercado/',al='https://www.compraonline.alcampo.es/categories/';
export const BROWSER_CATEGORIES={
 Carrefour:[{name:'Vacuno',url:cf+'frescos/carne/vacuno/cat190010/c'},{name:'Carne picada',url:cf+'frescos/carne/carne-picada/cat20147/c'},{name:'Pollo',url:cf+'frescos/carne/aves-y-pollo/cat190012/c'},{name:'Cerdo',url:cf+'frescos/carne/cerdo/cat190011/c'},{name:'Verduras',url:cf+'frescos/verduras-y-hortalizas/cat220014/c'}],
 Alcampo:[{name:'Vacuno',url:al+'Frescos/Carne/Vacuno/OC1304'},{name:'Carne picada',url:al+'Frescos/Carne/Burguer-meat-y-picada/OC1827'}],
 Consum:[{name:'Vacuno',url:'https://tienda.consum.es/es/c/frescos/carniceria-corte/vacuno/5280'}]
};
export function categoriesFor(store){return store==='DIA'?DIA_DISCOVERY_CATEGORIES:store==='Eroski'?EROSKI_CATEGORIES:store==='Lidl'?LIDL_CATEGORIES:BROWSER_CATEGORIES[store]||[];}
export function browserCategoryPlan(store,items){
 const config=retailer(store),basicIds=['leche','huevos','arroz','pasta','aceite'],urls=[];
 for(const item of items){
  const ranked=rankCategoryUrls([item],categoriesFor(store),1);
  if(ranked.length)urls.push(ranked[0].url);
  else {const index=basicIds.indexOf(item.id);if(index>=0&&config.pages[index]&&!(store==='Carrefour'&&item.constraints.brand?.mode==='specific'))urls.push(config.pages[index]);else if(store==='Carrefour')urls.push('https://www.carrefour.es/supermercado');else if(store==='Alcampo')urls.push('https://www.compraonline.alcampo.es/categories');}
 }
 if(!urls.length&&store==='Carrefour')urls.push('https://www.carrefour.es/supermercado');
 if(!urls.length&&store==='Alcampo')urls.push('https://www.compraonline.alcampo.es/categories');
 return [...new Set(urls)].slice(0,4);
}
export function queryTargets(store,items,{indexXml}={}){
 if(PUBLIC_INDEXES[store]&&indexXml)return rankProductUrls(items,productUrlsFromSitemap(indexXml,store));
 if(['Carrefour','Alcampo','Consum'].includes(store))return browserCategoryPlan(store,items);
 const targets=rankCategoryUrls(items,categoriesFor(store)).map(c=>c.url);
 if(store==='Lidl'&&!targets.length)return retailer(store).pages;
 return targets;
}
export function allowedCatalogUrl(url,store){
 try{const u=new URL(url),config=retailer(store);if(!config?.origins.includes(u.origin)||u.username||u.password||/(?:\/api\/|checkout|basket|cart|account|login|purchase|user-management|authentication|myorders|my-lists|mis-pedidos)/i.test(u.pathname))return false;
  return store==='DIA'&&/\/c\/L\d+$/.test(u.pathname)||store==='Eroski'&&u.pathname.startsWith('/es/supermercado/')||store==='Carrefour'&&u.pathname==='/supermercado'||store==='Alcampo'&&u.pathname==='/categories'||allowedProductUrl(url,store)||store==='Carrefour'&&/^\/supermercado\/.+\/c$/.test(u.pathname)||store==='Lidl'&&/^\/c\/[^/]+\/[as]\d+$/.test(u.pathname)||store==='ALDI'&&/^\/(?:productos\/.+|ofertas)\.html$/.test(u.pathname);
 }catch{return false;}
}
