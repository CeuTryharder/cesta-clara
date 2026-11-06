import {test} from 'node:test';import assert from 'node:assert/strict';import {readFile} from 'node:fs/promises';
import {parseDiaPage} from '../collectors/dia.js';import {compareObserved} from '../observed.js';
test('DIA conserva el agotado explícito del estado público',async()=>{
 const state=JSON.parse(await readFile(new URL('./fixtures/dia-meat-category.json',import.meta.url)));state.INITIAL_STATE.l2.plp_items[0].units_in_stock=0;
 const result=parseDiaPage('<script id="vike_pageContext">'+JSON.stringify(state)+'</script>',{url:'https://www.dia.es/carnes/vacuno/c/L2013',category:'Carne',observedAt:'2026-11-03T08:00:00Z',hash:'fixture',limit:40});assert.equal(result.observations[0].availability,'unavailable');
});
test('El precio por docena no se etiqueta como precio por huevo',()=>{
 const now=Date.parse('2026-11-03T08:00:00Z'),d=compareObserved({text:'24 huevos M',postcode:'28001',acceptAlternatives:true},{maxAgeHours:24,observations:[{store:'DIA',storeProductId:'24',name:'Huevos medianos M Dia 24 unidades',packageQuantity:24,packageUnit:'ud',priceCents:525,unitPriceCents:263,unitPriceBasis:'DOCENA',conditionalPrice:false,observedAt:new Date(now).toISOString(),productUrl:'https://www.dia.es/huevos/p/24'}]},now);assert.equal(d.rows[0].unitPriceCents,22);assert.equal(d.rows[0].totalCents,525);
});
