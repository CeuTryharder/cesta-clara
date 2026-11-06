// Distribution boundary: never turn a local lookup cache into a bundled sample.
const allowed=new Set('schemaVersion mode requestedPostcode locationVerified sourceScope maxAgeHours lastRun id store startedAt pages url observedAt count hash errors scheduling finishedAt observationCount status observations storeProductId name brand canonicalProductId category packageQuantity packageUnit priceCents unitPriceCents unitPriceBasis currency postcode sourcePostcode channel availability productUrl sourceUrl sourceMethod collectorVersion evidenceSha256 minimumPurchaseUnits promotion conditionalPrice validFrom validUntil ean estimatedPrice ingredients ingredientsSource declaredSpecies speciesEvidence text storeRuns DIA Mercadona Carrefour Alcampo Lidl ALDI Eroski Consum message'.split(' '));
export function assertPublicSnapshot(snapshot){
 function visit(value,path='sample'){
  if(Array.isArray(value)){for(const item of value)visit(item,path+'[]');return;}
  if(!value||typeof value!=='object')return;
  for(const [key,entry] of Object.entries(value)){
   if(!allowed.has(key))throw new Error('Campo no autorizado en la muestra pública: '+path+'.'+key);
   if(['postcode','requestedPostcode','sourcePostcode'].includes(key)&&entry!=null)throw new Error('La muestra pública no puede incluir zonas de una sesión.');
   if(key==='locationVerified'&&entry!==false)throw new Error('La muestra pública no confirma una zona.');
   if(/^(?:url|productUrl|sourceUrl|ingredientsSource)$/.test(key)&&entry){const url=new URL(entry);if(url.username||url.password||url.search||url.hash||url.protocol!=='https:')throw new Error('URL con datos de sesión en la muestra pública.');}
   visit(entry,path+'.'+key);
  }
 }
 if(!Array.isArray(snapshot.observations))throw new Error('Muestra pública no válida.');
 visit(snapshot);return snapshot;
}
