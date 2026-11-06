// Public standard grocery delivery tariffs, checked against the linked sources.
// Memberships, coupons, express delivery and verified local coverage are not assumed.
export const DELIVERY_REVIEWED_AT='2026-11-03T00:00:00+01:00';
export const DELIVERY_SOURCES={
 DIA:['https://www.dia.es/condiciones-de-compra'],
 Mercadona:['https://ayuda.tienda.mercadona.es/hc/es/articles/360000857071-Coste-de-preparaci%C3%B3n','https://ayuda.tienda.mercadona.es/hc/es/articles/360000841092-Pedido-m%C3%ADnimo'],
 Carrefour:['https://www.carrefour.es/supermercado/servicios/entrega-recogida-pedidos/supermercado.e','https://www.carrefour.es/supermercado'],
 Alcampo:['https://www.compraonline.alcampo.es/content/servicios-entrega-recogida','https://www.compraonline.alcampo.es/content/preguntas-frecuentes-compra-online'],
 Eroski:['https://supermercado.eroski.es/es/statics/footer/purchaseconditions/','https://supermercado.eroski.es/es/supermercado/enviogratis/'],
 Consum:['https://tienda.consum.es/site/es/faq'],
 Lidl:['https://atencion-al-cliente.lidl.es/SelfServiceES/s/topic/0TO58000000LfKbGAK/ecommerce'],
 ALDI:['https://www.aldi.es/']
};
export function deliveryQuote(store,subtotalCents,{postcode,fulfillment='delivery',now=Date.now()}={}){
 if(!['delivery','store'].includes(fulfillment))throw new Error('Elige entrega a domicilio o compra presencial.');
 const base={mode:fulfillment,reviewedAt:DELIVERY_REVIEWED_AT,sources:DELIVERY_SOURCES[store]||[],coverageVerified:false,minimumOrderCents:null,remainingCents:0,extraFeeCents:0};
 if(fulfillment==='store')return {...base,status:'not-applicable',eligible:true,minCents:0,maxCents:0,note:'Compra presencial; sin reparto. Los precios online pueden variar en tienda.'};
 if(['Lidl','ALDI'].includes(store))return {...base,status:'unsupported',eligible:false,minCents:null,maxCents:null,note:'Sin cesta online de alimentación compatible. Compra en tienda física.'};
 // Older versions must not present an indefinitely cached tariff as current.
 if(now>Date.parse(DELIVERY_REVIEWED_AT)+30*86400000)return {...base,status:'needs-review',eligible:false,minCents:null,maxCents:null,note:'Tarifa pendiente de revisión. Consulta los gastos actuales en la tienda.'};
 let minCents,maxCents,note,minimumOrderCents=null,extraFeeCents=0;
 if(store==='DIA'){minCents=maxCents=subtotalCents>=10000?0:499;note='4,99 €; gratis desde 100 € después de descuentos.';}
 if(store==='Mercadona'){minCents=maxCents=820;minimumOrderCents=6000;note='8,20 € de preparación y envío. Pedido mínimo: 60 €.';}
 if(store==='Carrefour'){
  // The two official pages disagree at exactly €140: preserve that uncertainty.
  minCents=subtotalCents>=14000?0:399;maxCents=subtotalCents>14000?0:399;
  note='3,99 €; gratis por encima de 140 € después de descuentos. Confirma la tarifa si tu cesta suma exactamente 140 €.';
 }
 if(store==='Alcampo'){
  const madrid=/^28\d{3}$/.test(postcode||'');minCents=madrid?99:700;maxCents=madrid?599:700;
  note=madrid?'Madrid: 0,99–5,99 € según franja, desde el día siguiente. Otra FAQ publica 3,99–5,99 €; confirma la franja disponible.':'Tarifa nacional: 7 € desde el día siguiente. Confirma cobertura y franja.';
 }
 if(store==='Eroski'){minCents=395;maxCents=695;extraFeeCents=60;note='3,95–6,95 € según franja + 0,60 € de bolsas. No se aplican ventajas de tarjetas ni promociones.';}
 if(store==='Consum'){minCents=maxCents=subtotalCents>=6000?400:700;note='7 € por debajo de 60 €; 4 € desde 60 €. Cobertura pendiente de confirmar.';}
 if(minCents===undefined)return {...base,status:'unknown',eligible:false,minCents:null,maxCents:null,note:'Gastos de envío pendientes de confirmar.'};
 return {...base,minimumOrderCents,remainingCents:Math.max(0,(minimumOrderCents||0)-subtotalCents),extraFeeCents,status:minCents===maxCents?'reference':'range',eligible:subtotalCents>=(minimumOrderCents||0),minCents,maxCents,note};
}
export function priceBasket(basket,options){
 const delivery=deliveryQuote(basket.store,basket.knownSubtotalCents,options),canTotal=basket.complete&&delivery.eligible;
 const totalMinCents=canTotal?basket.knownSubtotalCents+delivery.minCents+delivery.extraFeeCents:null;
 const totalMaxCents=canTotal?basket.knownSubtotalCents+delivery.maxCents+delivery.extraFeeCents:null;
 return {...basket,delivery,totalMinCents,totalMaxCents,totalCents:totalMinCents!==null&&totalMinCents===totalMaxCents?totalMinCents:null};
}
export function basketOrder(a,b){return (a.totalMaxCents??Infinity)-(b.totalMaxCents??Infinity)||(a.totalMinCents??Infinity)-(b.totalMinCents??Infinity)||a.knownSubtotalCents-b.knownSubtotalCents;}
