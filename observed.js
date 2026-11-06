import {priceBasket,basketOrder} from './delivery.js';
import {parseList,normalizeText,queryFingerprint} from './engine.js';
import {matchRequest,meatComposition,sameCut} from './matching.js';
import {RETAILERS,sourceStatus,allowedProductUrl} from './collectors/registry.js';
export function observationStatus(o,now=Date.now(),maxAgeHours=24){
 if(o.validFrom&&Date.parse(o.validFrom)>now)return 'not-yet-valid';
 if(o.validUntil&&Date.parse(o.validUntil)<now)return 'expired';
 const age=now-Date.parse(o.observedAt);return !Number.isFinite(age)||age< -300000?'invalid-date':age>maxAgeHours*3600000?'stale':'fresh';
}
export function observedList(snapshot,{category='',query=''}={},now=Date.now()){
 const products=snapshot.observations.filter(o=>(!category||o.category===category)&&(!query||normalizeText(o.name).includes(normalizeText(query)))).map(o=>({...o,estimatedPrice:estimated(o),freshness:observationStatus(o,now,snapshot.maxAgeHours)}));
 return {mode:'observed',sourceScope:snapshot.sourceScope,requestedPostcode:snapshot.requestedPostcode,locationVerified:false,scheduled:false,lastRun:snapshot.lastRun,stores:sourceStatus(snapshot),categories:[...new Set(snapshot.observations.map(o=>o.category))],count:products.length,products};
}
const estimated=o=>o.estimatedPrice===true||/aprox|peso variable|al corte|al peso|compra m[ií]nima/i.test(o.name||'');
function usable(o,snapshot,now){
 return allowedProductUrl(o.productUrl,o.store)&&o.packageQuantity>0&&Number.isInteger(o.priceCents)&&o.priceCents>0&&o.conditionalPrice===false&&o.availability!=='unavailable'&&observationStatus(o,now,snapshot.maxAgeHours)==='fresh';
}
export function compareObserved(input,snapshot,now=Date.now()){
 if(typeof input.text!=='string'||!input.text.trim()||input.text.length>5000)throw new Error('Escribe una lista de hasta 5.000 caracteres.');
 if(typeof input.postcode!=='string'||!/^\d{5}$/.test(input.postcode)||Number(input.postcode.slice(0,2))<1||Number(input.postcode.slice(0,2))>52)throw new Error('Introduce un código postal español válido.');
 if(input.acceptAlternatives!==true)throw new Error('Para comparar marcas distintas, confirma que admites alternativas que respeten tus requisitos.');
 const fulfillment=input.fulfillment??'delivery';if(!['delivery','store'].includes(fulfillment))throw new Error('Elige entrega a domicilio o compra presencial.');
 const deliveryOptions={postcode:input.postcode,fulfillment,now};
 const parsed=parseList(input.text,{resolutions:input.resolutions,brandPreference:input.brandPreference}),pending=[...parsed.pending],clarifications=[...parsed.clarifications];
 const offerFor=(item,store)=>{
  const candidates=snapshot.observations.filter(o=>o.store===store&&o.packageUnit===item.unit&&usable(o,snapshot,now));
  const offers=candidates.flatMap(o=>{const match=matchRequest(item,o);if(match.status!=='match')return [];const packs=Math.ceil((item.quantity-1e-9)/o.packageQuantity);
   const basis=normalizeText(o.unitPriceBasis||''),compatible=!basis||(item.unit==='kg'&&/^(kg|kilo|kilos|kilogramo|kilogramos)$/.test(basis))||(item.unit==='l'&&/^(l|litro|litros)$/.test(basis))||(item.unit==='ud'&&/^(ud|u|unidad|unidades)$/.test(basis));
   const unitPriceCents=compatible&&Number.isFinite(o.unitPriceCents)&&o.unitPriceCents>0?o.unitPriceCents:Math.round(o.priceCents/o.packageQuantity);
   return [{...item,store,name:o.name,matchedCategory:item.name,packs,packSize:o.packageQuantity,priceCents:o.priceCents,totalCents:o.priceCents*packs,unitPriceCents,selectionBasis:item.id==='carne'&&item.unit==='kg'?'unit-price':'basket-cost',productUrl:o.productUrl,observedAt:o.observedAt,sourceUrl:o.sourceUrl,storeProductId:o.storeProductId,minimumPurchaseUnits:o.minimumPurchaseUnits||1,channel:o.channel,sourcePostcode:o.sourcePostcode??null,locationVerified:false,matchType:'requirements-matched',estimatedPrice:estimated(o),brand:o.brand||'',composition:match.composition||null,ingredients:o.ingredients||null}];
  }).sort((a,b)=>(a.selectionBasis==='unit-price'?a.unitPriceCents-b.unitPriceCents:0)||a.totalCents-b.totalCents||a.packs-b.packs||String(a.storeProductId).localeCompare(String(b.storeProductId)));
  for(const offer of offers)offer.candidateCount=offers.length;
  return offers[0]??{...item,store,priceCents:null,totalCents:null,unitPriceCents:null,reason:'Sin precio reciente que cumpla todos tus requisitos.'};
 };
 const signature=queryFingerprint(input),lookupStores=snapshot.lookups?.[signature]?.stores||{};
 const baskets=RETAILERS.map(({name:store})=>{const rows=parsed.items.map(item=>offerFor(item,store));return {store,rows,lookup:lookupStores[store]||{status:'not-queried',checkedAt:null,errors:[]},estimatedPrice:rows.some(r=>r.estimatedPrice),complete:rows.length>0&&!parsed.pending.length&&rows.every(r=>r.totalCents!==null),knownSubtotalCents:rows.reduce((s,r)=>s+(r.totalCents??0),0),missing:rows.filter(r=>r.totalCents===null).map(r=>r.lineId)};}).map(b=>priceBasket(b,deliveryOptions));
 const productComparisons=parsed.items.map((item,i)=>{
  const offers=baskets.map(b=>b.rows[i]).filter(r=>r.totalCents!==null).sort((a,b)=>(a.selectionBasis==='unit-price'?a.unitPriceCents-b.unitPriceCents:0)||a.totalCents-b.totalCents);
  const unverified=snapshot.observations.filter(o=>o.packageUnit===item.unit&&usable(o,snapshot,now)).flatMap(o=>{const match=matchRequest(item,o);return match.status==='unverified'?[{...o,reason:match.reason}]:[];}).slice(0,12);
  const excluded=item.id==='carne'?snapshot.observations.filter(o=>o.packageUnit===item.unit&&usable(o,snapshot,now)&&sameCut(item,o.name)&&matchRequest({...item,constraints:{...item.constraints,minimumMeatPercent:null,allowVacuno:true}},o).status==='match'&&!/hamburgues|albondig/i.test(o.name)).flatMap(o=>{
   const match=matchRequest(item,o),composition=meatComposition(o.ingredients);if(match.status!=='different')return [];
   const below=composition&&item.constraints.minimumMeatPercent!==null&&composition.percent<item.constraints.minimumMeatPercent;
   return [{...o,reason:below?'La ficha acredita '+composition.percent+' % de carne; pides al menos '+item.constraints.minimumMeatPercent+' %.':match.reason}];
  }).sort((a,b)=>Number(!a.reason.startsWith('La ficha acredita'))-Number(!b.reason.startsWith('La ficha acredita'))).slice(0,6):[];
  if(!offers.length){
   pending.push({text:item.sourceText,lineId:item.lineId,kind:unverified.length?'unverified':'search',reason:unverified.length?'Hay productos parecidos, pero falta verificar un requisito: '+unverified[0].reason:'Sin coincidencias válidas guardadas. Puedes buscar este producto en las tiendas.'});
   if(item.id==='carne'&&item.constraints.species==='ternera'&&!item.constraints.allowVacuno&&!item.constraints.vacunoAnswered&&snapshot.observations.some(o=>usable(o,snapshot,now)&&matchRequest({...item,constraints:{...item.constraints,allowVacuno:true}},o).status!=='different')){
    clarifications.push({lineId:item.lineId,text:item.sourceText,field:'allowVacuno',question:'He encontrado etiquetado «vacuno». ¿Te vale también? Mantendré el porcentaje mínimo y el resto de requisitos.',options:[{label:'Sí, también vacuno',value:true},{label:'Solo ternera',value:false}]});
   }
  }
  return {item,offers,unverified,excluded,status:offers.length?'matched':unverified.length?'unverified':'not-found'};
 });
 const completeBaskets=baskets.filter(b=>b.complete);
 const ranked=completeBaskets.filter(b=>b.totalMaxCents!==null).sort(basketOrder);
 // A lower bound is not proof of being cheapest when delivery intervals overlap.
 const winner=ranked.length>=2&&ranked.slice(1).every(b=>ranked[0].totalMaxCents<b.totalMinCents)?{...ranked[0],scope:'observed-sample',localRecommendation:false}:null;
 let split=null;
 if(input.maxStores!==1&&!parsed.pending.length&&parsed.items.length)for(let a=0;a<baskets.length;a++)for(let b=a+1;b<baskets.length;b++){
  const rows=parsed.items.map((item,i)=>[baskets[a].rows[i],baskets[b].rows[i]].filter(r=>r.totalCents!==null).sort((x,y)=>x.totalCents-y.totalCents)[0]);if(rows.some(r=>!r))continue;
  const stores=[...new Set(rows.map(r=>r.store))];if(stores.length!==2)continue;
  const orders=stores.map(store=>priceBasket({store,complete:true,knownSubtotalCents:rows.filter(r=>r.store===store).reduce((sum,r)=>sum+r.totalCents,0)},deliveryOptions));
  if(orders.some(o=>o.totalMaxCents===null))continue;
  const subtotalCents=rows.reduce((s,r)=>s+r.totalCents,0),totalMinCents=orders.reduce((s,o)=>s+o.totalMinCents,0),totalMaxCents=orders.reduce((s,o)=>s+o.totalMaxCents,0);
  if(!split||totalMaxCents<split.totalMaxCents)split={stores,rows,orders,subtotalCents,totalMinCents,totalMaxCents,totalCents:totalMinCents===totalMaxCents?totalMinCents:null,estimatedPrice:rows.some(r=>r.estimatedPrice),savingsCents:ranked[0]?Math.max(0,ranked[0].totalMinCents-totalMaxCents):null,scope:'observed-sample'};
 }
 const primary=ranked[0]||completeBaskets.sort((a,b)=>a.knownSubtotalCents-b.knownSubtotalCents)[0]||[...baskets].filter(b=>b.rows.some(r=>r.totalCents!==null)).sort((a,b)=>b.rows.filter(r=>r.totalCents!==null).length-a.rows.filter(r=>r.totalCents!==null).length||a.knownSubtotalCents-b.knownSubtotalCents)[0]||baskets[0];
 return {mode:'observed',fulfillment,totalCents:primary.totalCents,totalMinCents:primary.totalMinCents,totalMaxCents:primary.totalMaxCents,delivery:primary.delivery,postcode:input.postcode,locationApplied:false,sourceScope:'mixed-public-reference',observedAt:null,items:parsed.items,coveragePending:baskets.some(b=>!b.lookup.checkedAt||now-Date.parse(b.lookup.checkedAt)>15*60*1000),estimatedPrice:primary.estimatedPrice,requests:parsed.requests,pending,clarifications,rows:primary.rows,baskets,productComparisons,knownSubtotalCents:primary.knownSubtotalCents,complete:primary.complete,winner,split,comparisonReady:ranked.length>=2,completeStores:completeBaskets.length,deliveryComparableStores:ranked.length,stores:sourceStatus(snapshot),reason:winner?'Total de referencia con la modalidad elegida. Cobertura, promociones y franja pendientes de confirmar.':ranked.length>=2?'Los intervalos de envío se solapan o los totales empatan; no hay una ganadora clara.':'No hay dos cestas completas con un total calculable para esta modalidad. Los subtotales no son totales de compra.',lastRun:snapshot.lastRun};
}
