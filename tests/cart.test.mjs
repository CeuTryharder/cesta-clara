import {test} from 'node:test';import assert from 'node:assert/strict';import {JSDOM} from 'jsdom';
import {cartPlan,createCartController} from '../dist/extension/cart.js';
import {cartPageStep} from '../extension/cart-page.js';
const input={text:'4 l leche',postcode:'28001',store:'DIA',acceptAlternatives:true};
const row={name:'Leche entera Dia Láctea 1 L',store:'DIA',productUrl:'https://www.dia.es/leche/p/608',packs:4,minimumPurchaseUnits:1};
const comparison={baskets:[{store:'DIA',complete:true,rows:[row]}]};
function browser({block=false,initialCount=2}={}){
 const saved={},tabs=[],counts=new Map([[row.productUrl,initialCount]]);let clicks=0,blocked=block;
 const api={storage:{local:{get:async k=>({[k]:structuredClone(saved[k])}),set:async values=>Object.assign(saved,structuredClone(values))}},permissions:{contains:async()=>true},
 tabs:{create:async spec=>{tabs.push({id:1,...spec});return tabs[0];},get:async()=>tabs[0],update:async(id,spec)=>Object.assign(tabs[0],spec),remove:async()=>{throw new Error('No debe cerrar la tienda');}},
 scripting:{executeScript:async({args:[r,action]})=>{
  if(blocked)return [{result:{state:'paused',reason:'Inicia sesión'}}];
  let count=counts.get(r.productUrl)||0;if(action==='add'||action==='remove'){clicks++;counts.set(r.productUrl,count+(action==='remove'?-1:1));return [{result:{state:'clicked',count}}];}
  return [{result:{state:'ready',count,cartUrl:'https://www.dia.es/cart'}}];
 }}};
 const controller=createCartController(api,{compare:async()=>comparison,sleep:async()=>{}});
 return {api,controller,saved,tabs,counts,clicks:()=>clicks,unblock:()=>{blocked=false;}};
}
async function settled(c){for(let n=0;n<100;n++){await new Promise(r=>setTimeout(r,1));const j=await c.get();if(j&&['complete','paused'].includes(j.status))return j;}throw new Error('Cesta sin terminar');}
test('Completa lo que falta en la cesta existente y verifica cantidades finales y deja abierta la tienda',async()=>{
 const f=browser();await f.controller.start(input);const j=await settled(f.controller);assert.equal(j.status,'complete');assert.equal(f.clicks(),2);assert.equal(f.counts.get(row.productUrl),4);assert.equal(f.tabs[0].url,'https://www.dia.es/cart');
 await f.controller.start(input);assert.equal(f.clicks(),2);assert.equal(f.tabs.length,1);
});
test('Login pausa y conserva la pestaña; Continuar retoma la lista',async()=>{
 const f=browser({block:true});await f.controller.start(input);assert.equal((await settled(f.controller)).status,'paused');assert.equal(f.clicks(),0);f.unblock();await f.controller.resume();assert.equal((await settled(f.controller)).status,'complete');
});
test('Un doble clic no puede crear dos trabajos ni duplicar productos',async()=>{
 const f=browser(),results=await Promise.allSettled([f.controller.start(input),f.controller.start(input)]);assert.equal(results.filter(r=>r.status==='rejected').length,1);await settled(f.controller);assert.equal(f.clicks(),2);
});

test('Borrar datos detiene y espera una lectura de cesta en curso sin guardar datos después',async()=>{
 const f=browser();let releaseRead,startedRead;
 const reading=new Promise(resolve=>startedRead=resolve),original=f.api.scripting.executeScript;
 f.api.scripting.executeScript=async request=>{startedRead();await new Promise(resolve=>releaseRead=resolve);return original(request);};
 await f.controller.start(input);await reading;
 const stopping=f.controller.stopForPrivacy();
 while(f.saved.cartJob.status!=='cancelled')await new Promise(resolve=>setTimeout(resolve,1));
 releaseRead();await stopping;assert.equal(f.clicks(),0);assert.equal(f.saved.cartJob.status,'cancelled');
 delete f.saved.cartJob;await f.controller.onTabUpdated(1,{status:'complete'},{url:row.productUrl});
 await assert.rejects(()=>f.controller.resume(),/reiniciando/);await assert.rejects(()=>f.controller.start(input),/reiniciando/);assert.deepEqual(f.saved,{});
});
test('El borrado también espera la comprobación automática de una pestaña y evita reabrirla',async()=>{
 const f=browser({block:true});await f.controller.start(input);await settled(f.controller);f.saved.cartJob.pauseCode='session';
 let release,entered;const inspecting=new Promise(resolve=>entered=resolve);
 f.api.tabs.get=async()=>{entered();await new Promise(resolve=>release=resolve);throw new Error('No tab with id: 1');};
 const checking=f.controller.onTabUpdated(1,{status:'complete'},{url:row.productUrl}).catch(()=>{});await inspecting;
 let stopped=false;const stopping=f.controller.stopForPrivacy().then(()=>{stopped=true;});
 while(f.saved.cartJob.status!=='cancelled')await new Promise(resolve=>setTimeout(resolve,1));
 assert.equal(stopped,false);release();await stopping;await checking;
 assert.equal(f.tabs.length,1);assert.equal(f.saved.cartJob.status,'cancelled');delete f.saved.cartJob;
 await new Promise(resolve=>setTimeout(resolve,1));assert.deepEqual(f.saved,{});
});

test('Convierte correctamente el mínimo de seis bricks a unidades de tienda',()=>{
 const plan=cartPlan({...input,store:'Carrefour'},{baskets:[{store:'Carrefour',complete:true,rows:[{...row,store:'Carrefour',productUrl:'https://www.carrefour.es/supermercado/leche/R-1/p',packs:1,minimumPurchaseUnits:6}]}]});assert.equal(plan.rows[0].cartUnits,6);
});
test('Rechaza cestas incompletas, tiendas físicas y URLs ajenas',()=>{
 assert.throws(()=>cartPlan(input,{baskets:[{store:'DIA',complete:false,rows:[]}]}));
 assert.throws(()=>cartPlan({...input,store:'ALDI'},{baskets:[{store:'ALDI',complete:true,rows:[row]}]}));
 assert.throws(()=>cartPlan(input,{baskets:[{store:'DIA',complete:true,rows:[{...row,productUrl:'https://other.test/p/1'}]}]}));
});
function page(html,fn){const dom=new JSDOM(html,{url:row.productUrl}),old={document:globalThis.document,location:globalThis.location};dom.window.Element.prototype.getClientRects=function(){return this.hidden?[]:[{}];};globalThis.document=dom.window.document;globalThis.location=dom.window.location;try{fn(dom.window);}finally{Object.assign(globalThis,old);dom.window.close();}}
test('Solo pulsa Añadir en el producto principal; jamás recomendaciones o pago',()=>page('<div class="primary-information"><h1>'+row.name+'</h1><button aria-label="add to cart button">Añadir</button></div><aside><button>Añadir</button></aside><button>Pagar</button>',w=>{
 let clicks=0;w.document.querySelector('.primary-information button').onclick=()=>clicks++;w.document.querySelector('aside button').onclick=()=>assert.fail('Recomendación');w.document.querySelector('body>button').onclick=()=>assert.fail('Pago');assert.equal(cartPageStep({...row,expectedCount:0},'add').state,'clicked');assert.equal(clicks,1);
}));
test('Un modal de sesión impide clicar y no marca productos como añadidos',()=>page('<div role="dialog">Inicia sesión</div><div class="primary-information"><h1>'+row.name+'</h1><button>Añadir</button></div>',()=>assert.equal(cartPageStep({...row,expectedCount:0},'add').state,'paused')));
test('Una cantidad desconocida espera la hidratación sin interpretarla como adición confirmada',()=>page('<div class="primary-information"><h1>'+row.name+'</h1><button>Quitar</button><button>+</button></div>',()=>assert.equal(cartPageStep(row).state,'loading')));
test('Lee el contador de Mercadona aunque su etiqueta esté oculta solo a accesibilidad',()=>page('<div class="private-product-detail"><div class="private-product-detail__right"><h1>'+row.name+'</h1><label data-testid="product-feedback__quantity" aria-hidden="true">4 ud.</label><button>Quitar 1 Unidad del carro</button><button>Añadir 1 Unidad al carro</button></div><aside><button>Añadir al carro</button></aside></div>',()=>assert.equal(cartPageStep(row).count,4)));
test('Si la tienda no confirma el incremento, pausa sin repetir clics ni marcar éxito',async()=>{
 const f=browser();let clicks=0;f.api.scripting.executeScript=async({args:[r,action]})=>[{result:action==='add'?(clicks++,{state:'clicked',count:2}):{state:'ready',count:2}}];
 await f.controller.start(input);const job=await settled(f.controller);assert.equal(job.status,'paused');assert.equal(clicks,1);assert.equal(job.rows[0].inFlight,true);assert.equal(job.rows[0].status,'pending');
});
test('Un reinicio del servicio ofrece continuar en vez de quedar trabajando para siempre',async()=>{
 const f=browser();const job=cartPlan(input,comparison);job.status='running';job.tabId=1;await f.api.storage.local.set({cartJob:job});assert.equal((await f.controller.get()).status,'paused');
});

test('Reduce solo la línea solicitada cuando hay unidades sobrantes de intentos anteriores',async()=>{
 const f=browser({initialCount:5});f.counts.set('unrelated-sku',7);await f.controller.start(input);const j=await settled(f.controller);assert.equal(j.status,'complete',j.message);assert.equal(f.counts.get(row.productUrl),4);assert.equal(f.counts.get('unrelated-sku'),7);assert.equal(f.clicks(),1);assert.equal(j.rows[0].initialCount,5);assert.equal(j.rows[0].finalCount,4);
});
test('Una cesta completada por una versión antigua se vuelve a comprobar y ajustar',async()=>{
 const f=browser({initialCount:6}),job=cartPlan(input,comparison);delete job.quantityPolicy;job.status='complete';job.index=1;job.rows[0].status='done';job.rows[0].target=6;await f.api.storage.local.set({cartJob:job});await f.controller.start(input);const done=await settled(f.controller);assert.equal(done.status,'complete',done.message);assert.equal(f.counts.get(row.productUrl),4);assert.equal(f.clicks(),2);
});
test('Dos líneas que eligen el mismo SKU se acumulan en un único objetivo verificable',()=>{
 const plan=cartPlan(input,{baskets:[{store:'DIA',complete:true,rows:[row,{...row,packs:2}]}]});assert.equal(plan.rows.length,1);assert.equal(plan.rows[0].cartUnits,6);
});
test('Un mínimo incompatible con lo ya existente pausa antes de oscilar entre añadir y quitar',async()=>{
 const f=browser({initialCount:3}),job=cartPlan(input,comparison);job.rows[0].minimumPurchaseUnits=6;job.rows[0].cartUnits=6;job.status='paused';await f.api.storage.local.set({cartJob:job});await f.controller.start(input);const paused=await settled(f.controller);assert.equal(paused.status,'paused');assert.match(paused.message,/mínimo de compra/);assert.equal(f.clicks(),0);
});
