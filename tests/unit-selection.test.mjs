import {test} from 'node:test';import assert from 'node:assert/strict';
import {compareObserved} from '../observed.js';
const at='2026-11-03T08:00:00Z',now=Date.parse(at),input={text:'1 kg filete vacuno',postcode:'28001',fulfillment:'store',acceptAlternatives:true};
const offer=(id,q,price,rate,more={})=>({store:'DIA',storeProductId:id,name:'Filetes de vacuno Selección de Dia '+q+' kg',packageQuantity:q,packageUnit:'kg',priceCents:price,unitPriceCents:rate,unitPriceBasis:'KILO',conditionalPrice:false,availability:'unknown',observedAt:at,productUrl:'https://www.dia.es/carnes/vacuno/p/'+id,...more});
test('Carne: el menor €/kg prevalece sobre el menor total de envases y el orden de descubrimiento',()=>{
 const expensive=offer('1',.5,600,1200),cheap=offer('2',.7,770,1100);
 for(const observations of [[expensive,cheap],[cheap,expensive]]){const d=compareObserved(input,{observations,maxAgeHours:24},now),row=d.baskets.find(b=>b.store==='DIA').rows[0];assert.equal(row.storeProductId,'2');assert.equal(row.unitPriceCents,1100);assert.equal(row.packs,2);assert.equal(row.totalCents,1540);assert.equal(row.candidateCount,2);assert.equal(row.selectionBasis,'unit-price');}
});
test('Un €/kg más bajo no permite saltarse especie, composición, marca o promociones',()=>{
 const valid=offer('1',.5,700,1400),wrong=offer('2',.5,300,600,{name:'Filetes de cerdo 500 g'}),promo=offer('3',.5,250,500,{conditionalPrice:true});
 const d=compareObserved(input,{observations:[wrong,promo,valid],maxAgeHours:24},now);assert.equal(d.rows[0].storeProductId,'1');
});
test('Calcula el precio por kg si falta la tarifa unitaria de la fuente',()=>{const d=compareObserved(input,{observations:[offer('1',.4,480,null),offer('2',.6,660,null)],maxAgeHours:24},now);assert.equal(d.rows[0].storeProductId,'2');assert.equal(d.rows[0].unitPriceCents,1100);});
