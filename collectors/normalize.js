import {allowedProductUrl} from './registry.js';
export const normal=s=>String(s).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'');
export function canonicalType(name){const n=normal(name);
 if(/sin lactosa|leche fresca|pasteuriz|ecologic|integral|sin gluten|no gluten|cocid|preparad|tarrina|vasos|vasitos|con salsa|bolonesa|chocolate|calcio|semidesnat|desnat|spray|trufa|oruj|girasol|vaporiz|basmati|largo|camper|codorniz/.test(n))return null;
 if(/\bleche (?:de vaca )?entera\b/.test(n)&&!/arroz|postre|yogur|batido|natilla|condensada|sabor|azucar|crema/.test(n))return 'leche';
 if(/huevos?/.test(n)&&/\bmedianos?\b|\bM\b/.test(name))return 'huevos';
 if(/arroz/.test(n)&&(/redondo/.test(n)||/categoria primera carrefour/.test(n)))return 'arroz';
 if(/macarron/.test(n)&&!/huevo|rellen|maiz|arroz/.test(n))return 'pasta';
 if(/aceite.*oliva.*virgen extra/.test(n))return 'aceite';return null;
}
export function parsePackage(text){
 const s=normal(text).replace(/,/g,'.').replace(/producto alcampo|unidad$/g,'').replace(/(\d+)\s*por envase/g,'$1 ud').replace(/(\d+)\s*docenas?/g,(_,n)=>Number(n)*12+' ud').trim();
 const matches=[...s.matchAll(/(?:(\d+)\s*[x×]\s*)?(\d+(?:\.\d+)?)\s*(mililitros?|ml|kilogramos?|kg|gramos?|g\b|litros?|l\b|unidades?|uds?\b)/g)];
 if(!matches.length)return null;const m=matches[matches.length-1];let quantity=Number(m[2])*(Number(m[1])||1),unit=m[3];
 if(/^m/.test(unit)){quantity/=1000;unit='l';}else if(/^g/.test(unit)){quantity/=1000;unit='kg';}else if(/^k/.test(unit))unit='kg';else if(/^l/.test(unit))unit='l';else unit='ud';
 return quantity>0&&quantity<=1000?{quantity:Math.round(quantity*1e6)/1e6,unit}:null;
}
export function makeObservation(raw,{store,url,observedAt,hash,requestedPostcode=null,method='public-html',channel='online-public'}){
 if(!allowedProductUrl(raw.productUrl||url,store))throw new Error('URL de producto fuera de la fuente.');
 const name=String(raw.name||'').trim(),id=String(raw.id||'');let price=Number(raw.priceCents),pack=parsePackage(raw.quantityText||name)||parsePackage(name);
 if(name.length<3||!id||!Number.isInteger(price)||price<=0||price>1000000)throw new Error('Falta un precio verificable.');
 const minimum=raw.minimumPurchaseUnits||1;if(!Number.isInteger(minimum)||minimum<1||minimum>100)throw new Error('Formato mínimo de compra inválido.');
 if(minimum>1){price*=minimum;if(pack)pack.quantity*=minimum;}
 const type=canonicalType(name);
 return {store,storeProductId:id,name,declaredSpecies:['vacuno','ternera','cerdo','pollo','pavo'].includes(raw.declaredSpecies)?raw.declaredSpecies:null,speciesEvidence:raw.speciesEvidence||null,estimatedPrice:raw.estimatedPrice===true||/aprox|peso variable|al corte|al peso|compra m[ií]nima/i.test(raw.quantityText||name),brand:String(raw.brand||''),ingredients:typeof raw.ingredients==='string'?raw.ingredients.slice(0,5000):null,ingredientsSource:raw.ingredients?raw.productUrl||url:null,canonicalProductId:type,category:({leche:'Leche',huevos:'Huevos',arroz:'Arroz',pasta:'Pasta',aceite:'Aceite'})[type]||(/picad|molid/i.test(name)?'Carne picada':'Otros'),packageQuantity:pack?.quantity??null,packageUnit:pack?.unit??null,priceCents:price,unitPriceCents:pack?Math.round(price/pack.quantity):null,unitPriceBasis:pack?.unit??null,currency:'EUR',postcode:null,requestedPostcode,sourcePostcode:raw.sourcePostcode||null,locationVerified:false,channel,availability:raw.availability==='unavailable'?'unavailable':'unknown',productUrl:raw.productUrl||url,sourceUrl:url,observedAt,sourceMethod:method,collectorVersion:'0.5.0',evidenceSha256:hash,minimumPurchaseUnits:minimum,promotion:raw.promotion||[],conditionalPrice:raw.conditionalPrice===true,validFrom:raw.validFrom||null,validUntil:raw.validUntil||null,ean:raw.ean||null};
}
