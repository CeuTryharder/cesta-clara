import {test} from 'node:test';
import assert from 'node:assert/strict';
import {JSDOM} from 'jsdom';
import {createCartController,cartPlan} from '../dist/extension/cart.js';
import {cartPageStep} from '../extension/cart-page.js';

const input={text:'4 l leche',postcode:'28001',store:'Mercadona',acceptAlternatives:true};
const product={store:'Mercadona',name:'Leche entera Hacendado',productUrl:'https://tienda.mercadona.es/product/10380/leche-entera-hacendado-brick',packs:4,minimumPurchaseUnits:1};
const comparison={baskets:[{store:'Mercadona',complete:true,rows:[product]}]};

function simulatedChrome(options={}){
 const dom=new JSDOM('<main></main>',{url:product.productUrl,runScripts:'outside-only'}),w=dom.window;
 w.Element.prototype.getClientRects=function(){return this.hidden||this.closest('[hidden]')?[]:[{}];};
 const saved={},tabs=new Map(),events=[];let tabSequence=0,ticks=0,count=options.initialCount??2,pending=null,previousAdditionAt=options.previousAdditionAt??null,hydrated=false,blocked=options.blocked||false;
 function render(){
  w.document.querySelector('main').innerHTML=(blocked?'<div role="dialog">Inicia sesión</div>':'')+'<div class="private-product-detail"><div class="private-product-detail__right"><h1>Leche entera Hacendado</h1>'+(hydrated?'<label data-testid="product-feedback__quantity" aria-hidden="true">'+count+' uds.</label><button aria-label="Quitar 1 Unidad del carro">−</button><button id="increase" aria-label="Añadir 1 Unidad al carro" '+(pending?'disabled':'')+'>+</button>':'')+'</div><aside><button id="recommendation">Añadir al carro</button></aside></div><button id="cart">Mostrar carro</button><button id="checkout">Tramitar pedido</button>';
  const increase=w.document.getElementById('increase');if(increase)increase.onclick=()=>{events.push('add');pending={completeAt:ticks+2};render();};
  w.document.getElementById('recommendation').onclick=()=>assert.fail('No debe añadir una recomendación');
  w.document.getElementById('checkout').onclick=()=>assert.fail('No debe tramitar un pedido');
  w.document.getElementById('cart').onclick=()=>events.push('open-cart');
 }
 render();
 const api={
  storage:{local:{get:async key=>({[key]:structuredClone(saved[key])}),set:async value=>Object.assign(saved,structuredClone(value))}},
  permissions:{contains:async()=>true},
  tabs:{
   create:async({url,active})=>{const tab={id:++tabSequence,url:'about:blank',pendingUrl:url,status:'loading',active};tabs.set(tab.id,tab);events.push('tab-create');return {...tab};},
   get:async id=>{if(!tabs.has(id))throw new Error('No tab with id: '+id);return {...tabs.get(id)};},
   update:async(id,change)=>{if(!tabs.has(id))throw new Error('No tab with id: '+id);const tab=tabs.get(id);if(change.url&&change.url!==tab.url){events.push('navigate');tab.pendingUrl=change.url;tab.status='loading';}if(change.active)tab.active=true;return {...tab};},
   remove:async()=>assert.fail('La pestaña de la tienda debe permanecer abierta')
  },
  scripting:{executeScript:async({target,func,args})=>{
   const tab=tabs.get(target.tabId);assert.equal(tab.status,'complete','No debe inyectar en una navegación pendiente');
   events.push('script:'+args[1]);
   // Equivalent to Chrome's function serialization: imported closures are unavailable.
   const serialized=func.toString(),execute=w.eval('('+serialized+')');
   return [{result:execute(...structuredClone(args))}];
  }}
 };
 const sleep=async()=>{
  ticks++;for(const tab of tabs.values())if(ticks>=2&&tab.status==='loading'){tab.url=tab.pendingUrl;delete tab.pendingUrl;tab.status='complete';}
  if(ticks>=4&&!hydrated){hydrated=true;render();}
  if(previousAdditionAt!==null&&ticks>=previousAdditionAt){count++;previousAdditionAt=null;events.push('earlier-add-confirmed');render();}
  if(pending&&ticks>=pending.completeAt){count++;pending=null;render();}
 };
 const controller=createCartController(api,{compare:async()=>comparison,sleep});
 return {controller,api,saved,tabs,events,dom,get count(){return count;},unblock(){blocked=false;render();},closeTab(id){tabs.delete(id);},stop(){dom.window.close();}};
}
async function settled(controller){for(let n=0;n<100;n++){await new Promise(resolve=>setTimeout(resolve,1));const job=await controller.get();if(job&&['paused','complete'].includes(job.status))return job;}throw new Error('No llegó a estado final');}

for(const stage of ['focus','read','navigate'])test('Recupera una pestaña que desaparece durante '+stage,async()=>{
 const browser=simulatedChrome();let lost=false;
 try{
  const originalGet=browser.api.tabs.get,originalUpdate=browser.api.tabs.update;
  if(stage==='read'){browser.api.tabs.get=async id=>{const tab=await originalGet(id);if(!lost&&browser.events.some(e=>e.startsWith('script:'))){lost=true;browser.closeTab(id);throw new Error('No tab with id: '+id);}return tab;};}
  else{browser.api.tabs.update=async(id,change)=>{if(!lost){lost=true;browser.closeTab(id);throw new Error('No tab with id: '+id);}return originalUpdate(id,change);};}
  if(stage==='navigate'){const tab=await browser.api.tabs.create({url:'https://tienda.mercadona.es/product/old',active:true});const job=cartPlan(input,comparison);job.tabId=tab.id;job.status='paused';await browser.api.storage.local.set({cartJob:job});const original=browser.api.tabs.update;browser.api.tabs.update=async(id,change)=>change.url?original(id,change):originalUpdate(id,change);}
  await browser.controller.start(input);const job=await settled(browser.controller);assert.equal(lost,true);assert.equal(job.status,'complete',job.message);assert.equal(browser.count,4);assert.equal(browser.events.filter(e=>e==='add').length,2);
 }finally{browser.stop();}
});

test('Recupera el cierre entre leer la pestaña e inyectar sin duplicar adiciones',async()=>{
 const browser=simulatedChrome();let lost=false;try{
  const original=browser.api.scripting.executeScript;browser.api.scripting.executeScript=async args=>{if(!lost&&args.args[1]==='read'){lost=true;browser.closeTab(args.target.tabId);throw new Error('No tab with id: '+args.target.tabId);}return original(args);};
  await browser.controller.start(input);const job=await settled(browser.controller);assert.equal(job.status,'complete',job.message);assert.equal(browser.count,4);assert.equal(browser.events.filter(e=>e==='add').length,2);
 }finally{browser.stop();}
});

test('Volver a la tienda recupera una pestaña cerrada sin iniciar otra compra',async()=>{
 const browser=simulatedChrome();try{await browser.controller.start(input);const done=await settled(browser.controller);browser.closeTab(done.tabId);const opened=await browser.controller.open();assert.notEqual(opened.tabId,done.tabId);assert.equal(opened.status,'complete');assert.equal(browser.count,4);}finally{browser.stop();}
});

test('Si la pestaña desaparece durante una adición incierta la reabre sin repetirla',async()=>{
 const browser=simulatedChrome();let lost=false;try{const original=browser.api.scripting.executeScript;browser.api.scripting.executeScript=async args=>{const result=await original(args);if(!lost&&args.args[1]==='add'){lost=true;browser.closeTab(args.target.tabId);throw new Error('No tab with id: '+args.target.tabId);}return result;};
  await browser.controller.start(input);const paused=await settled(browser.controller);assert.equal(paused.status,'paused');assert.equal(paused.rows[0].inFlight,true);await browser.controller.resume();const done=await settled(browser.controller);assert.equal(done.status,'complete',done.message);assert.equal(browser.count,4);assert.equal(browser.events.filter(e=>e==='add').length,2);
 }finally{browser.stop();}
});

test('Chrome realista: about:blank, hidratación y confirmaciones lentas ejecutan el código inyectado',async()=>{
 const browser=simulatedChrome();try{
  await browser.controller.start(input);const job=await settled(browser.controller);
  assert.equal(job.status,'complete',job.message);assert.equal(browser.count,4);
  assert.equal(browser.events.filter(event=>event==='add').length,2);
  assert.equal(browser.events.filter(event=>event==='navigate').length,0,'No debe recargar la pestaña recién abierta');
  assert.equal(browser.events.at(-1),'open-cart');assert.equal(browser.tabs.size,1);
 }finally{browser.stop();}
});
test('Pulsar Preparar otra vez reanuda un trabajo pausado en vez de solo enfocar la tienda',async()=>{
 const browser=simulatedChrome({blocked:true});try{
  await browser.controller.start(input);assert.equal((await settled(browser.controller)).status,'paused');browser.unblock();
  await browser.controller.start(input);assert.equal((await settled(browser.controller)).status,'complete');assert.equal(browser.count,4);assert.equal(browser.tabs.size,1);
 }finally{browser.stop();}
});
test('Una pestaña cerrada se recrea y el trabajo completado no añade otra vez',async()=>{
 const browser=simulatedChrome();try{
  await browser.controller.start(input);const done=await settled(browser.controller);browser.closeTab(done.tabId);
  const reopened=await browser.controller.start(input);assert.equal(reopened.status,'complete');assert.notEqual(reopened.tabId,done.tabId);
  assert.equal(browser.count,4);assert.equal(browser.events.filter(event=>event==='add').length,2);assert.equal(browser.tabs.size,1);
 }finally{browser.stop();}
});
test('Una escritura confirmada antes del reinicio no se repite al recuperar el trabajo',async()=>{
 const browser=simulatedChrome({initialCount:3});try{
  const tab=await browser.api.tabs.create({url:product.productUrl,active:true}),job=cartPlan(input,comparison);job.tabId=tab.id;job.status='paused';job.rows[0].target=4;job.rows[0].expectedCount=2;job.rows[0].inFlight=true;
  await browser.api.storage.local.set({cartJob:job});await browser.controller.resume();assert.equal((await settled(browser.controller)).status,'complete');assert.equal(browser.count,4);assert.equal(browser.events.filter(event=>event==='add').length,1);
 }finally{browser.stop();}
});
test('Al recrear una pestaña espera la adición anterior tardía sin repetir su clic',async()=>{
 const browser=simulatedChrome({previousAdditionAt:20});try{
  const tab=await browser.api.tabs.create({url:product.productUrl,active:true}),job=cartPlan(input,comparison);job.tabId=tab.id;job.status='paused';job.rows[0].target=4;job.rows[0].expectedCount=2;job.rows[0].inFlight=true;
  await browser.api.storage.local.set({cartJob:job});browser.closeTab(tab.id);await browser.controller.resume();
  const done=await settled(browser.controller);assert.equal(done.status,'complete',done.message);assert.notEqual(done.tabId,tab.id);assert.equal(browser.count,4);
  assert.equal(browser.events.filter(event=>event==='add').length,1);assert.ok(browser.events.indexOf('earlier-add-confirmed')<browser.events.indexOf('add'));
 }finally{browser.stop();}
});
test('Una adición incierta se conserva pendiente aunque se pulse Preparar varias veces',async()=>{
 const browser=simulatedChrome();try{
  const tab=await browser.api.tabs.create({url:product.productUrl,active:true}),job=cartPlan(input,comparison);job.tabId=tab.id;job.status='paused';job.rows[0].target=4;job.rows[0].expectedCount=2;job.rows[0].inFlight=true;
  await browser.api.storage.local.set({cartJob:job});
  for(let retry=0;retry<2;retry++){
   await browser.controller.start(input);const paused=await settled(browser.controller);assert.equal(paused.status,'paused');assert.match(paused.message,/evitar duplicados/);assert.equal(paused.rows[0].inFlight,true);
  }
  assert.equal(browser.count,2);assert.equal(browser.events.filter(event=>event==='add').length,0);
 }finally{browser.stop();}
});
test('Un fallo al abrir el carro después de verificar cantidades conserva el estado completado',async()=>{
 const browser=simulatedChrome();try{
  const original=browser.api.scripting.executeScript;browser.api.scripting.executeScript=async args=>{if(args.args[1]==='open-cart')throw new Error('Frame was removed');return original(args);};
  await browser.controller.start(input);const job=await settled(browser.controller);assert.equal(job.status,'complete');assert.equal(browser.count,4);assert.match(job.message,/cabecera/);
 }finally{browser.stop();}
});
test('La lectura funciona sin metadatos URL si Chrome permite inyectar en la ficha',async()=>{
 const browser=simulatedChrome();try{
  const original=browser.api.tabs.get;browser.api.tabs.get=async id=>{const tab=await original(id);if(tab.status==='complete'){delete tab.url;delete tab.pendingUrl;}return tab;};
  await browser.controller.start(input);assert.equal((await settled(browser.controller)).status,'complete');assert.equal(browser.count,4);
 }finally{browser.stop();}
});
test('Volver a preparar tras cancelar completa el objetivo anterior sin duplicar lo añadido',async()=>{
 const browser=simulatedChrome({initialCount:3});try{
  const tab=await browser.api.tabs.create({url:product.productUrl,active:true}),job=cartPlan(input,comparison);job.tabId=tab.id;job.status='cancelled';job.rows[0].target=4;job.rows[0].expectedCount=2;job.rows[0].inFlight=true;
  await browser.api.storage.local.set({cartJob:job});await browser.controller.start(input);assert.equal((await settled(browser.controller)).status,'complete');assert.equal(browser.count,4);assert.equal(browser.events.filter(event=>event==='add').length,1);
 }finally{browser.stop();}
});
test('Volver a comprobar una lista idéntica conserva la cantidad solicitada sin acumular otra compra',async()=>{
 const browser=simulatedChrome();try{
  await browser.controller.start(input);const first=await settled(browser.controller);await browser.controller.start(input);assert.equal(browser.count,4);
  await browser.controller.start({...input,newPurchase:true});const second=await settled(browser.controller);assert.notEqual(second.id,first.id);assert.equal(second.status,'complete');assert.equal(browser.count,4);
 }finally{browser.stop();}
});

test('Una preparación antigua se reconcilia con la cantidad de la lista tras migrar',async()=>{
 const browser=simulatedChrome({initialCount:3});try{
  const tab=await browser.api.tabs.create({url:product.productUrl,active:true}),job=cartPlan(input,comparison);const key=JSON.parse(job.signature.slice(0,-('|'+input.store).length));job.signature=JSON.stringify(key.slice(1))+'|'+input.store;job.tabId=tab.id;job.status='paused';job.rows[0].target=4;job.rows[0].expectedCount=2;job.rows[0].inFlight=true;
  await browser.api.storage.local.set({cartJob:job});await browser.controller.start(input);const done=await settled(browser.controller);assert.equal(done.status,'complete',done.message);assert.equal(browser.count,4);assert.equal(browser.events.filter(e=>e==='add').length,1);
 }finally{browser.stop();}
});

test('Cambiar a un SKU más barato tras una adición requiere detener la preparación anterior',async()=>{
 const browser=simulatedChrome({blocked:true}),originalRows=comparison.baskets[0].rows;try{
  const tab=await browser.api.tabs.create({url:product.productUrl,active:true}),job=cartPlan(input,comparison),key=JSON.parse(job.signature.slice(0,-('|'+input.store).length));job.signature=JSON.stringify(key.slice(1))+'|'+input.store;job.tabId=tab.id;job.status='paused';job.rows[0].target=4;
  await browser.api.storage.local.set({cartJob:job});comparison.baskets[0].rows=[{...product,productUrl:'https://tienda.mercadona.es/product/99999/leche-entera'}];
  await assert.rejects(()=>browser.controller.start(input),/nueva comparación elige otros productos/);await browser.controller.cancel();const replacement=await browser.controller.start(input);await settled(browser.controller);assert.notEqual(replacement.id,job.id);assert.equal(replacement.rows[0].productUrl,comparison.baskets[0].rows[0].productUrl);assert.equal(browser.events.filter(e=>e==='add').length,0);
 }finally{comparison.baskets[0].rows=originalRows;browser.stop();}
});
test('Nueva compra no puede saltarse un trabajo pausado ni omitir permisos',async()=>{
 const browser=simulatedChrome({blocked:true});try{
  await browser.controller.start(input);await settled(browser.controller);await assert.rejects(()=>browser.controller.start({...input,newPurchase:true}),/Termina o detén/);
  browser.api.permissions.contains=async()=>false;await assert.rejects(()=>browser.controller.start(input),/Permite/);assert.equal(browser.count,2);
 }finally{browser.stop();}
});
test('No interpreta un contador deshabilitado como cesta vacía ni pulsa durante la petición',()=>{
 const dom=new JSDOM('<div class="primary-information"><h1>'+product.name+'</h1><input type="number" value="2"><button disabled>Quitar</button><button disabled>Añadir una unidad</button></div>',{url:product.productUrl,runScripts:'outside-only'});
 try{dom.window.Element.prototype.getClientRects=()=>[{}];const execute=dom.window.eval('('+cartPageStep.toString()+')'),state=execute({...product,expectedCount:2},'add');assert.equal(state.count,2);assert.equal(state.state,'loading');}finally{dom.window.close();}
});
test('La ficha en un diálogo de producto no se confunde con una petición de login',()=>{
 const dom=new JSDOM('<div role="dialog"><div class="primary-information"><h1>'+product.name+'</h1><button>Añadir</button></div></div>',{url:product.productUrl,runScripts:'outside-only'});
 try{dom.window.Element.prototype.getClientRects=()=>[{}];const execute=dom.window.eval('('+cartPageStep.toString()+')');assert.equal(execute(product).state,'ready');}finally{dom.window.close();}
});
