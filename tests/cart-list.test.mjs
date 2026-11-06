import {test} from 'node:test';
import assert from 'node:assert/strict';
import {JSDOM} from 'jsdom';
import {createCartController} from '../dist/extension/cart.js';
import {cartPageStep} from '../extension/cart-page.js';

function shop(store,{login=false,outOfStock=false,loginIntercept=false}={}){
 const origin=store==='Carrefour'?'https://www.carrefour.es':store==='DIA'?'https://www.dia.es':'https://www.compraonline.alcampo.es';
 const rows=[{name:'Filetes de vacuno 500 g',packs:2},{name:'Leche entera 1 l',packs:4},{name:'Huevos M 24 ud',packs:1}].map((r,i)=>({...r,store,productUrl:origin+(store==='Carrefour'?'/supermercado/producto/R-'+(i+1)+'/p':store==='DIA'?'/carnes/vacuno/p/'+(i+1):'/products/producto/'+(i+1)),minimumPurchaseUnits:1}));
 if(store==='Carrefour'){rows[1].packs=1;rows[1].minimumPurchaseUnits=6;}
 const saved={},counts=[0,0,0],clicks=[0,0,0],events=[],dom=new JSDOM('<main></main>',{url:rows[0].productUrl,runScripts:'outside-only'}),w=dom.window;
 let url=rows[0].productUrl,needsLogin=login||loginIntercept,loginModal=false,listener,intervention=store==='DIA';
 w.Element.prototype.getClientRects=()=>[{}];
 function render(){dom.reconfigure({url});const i=rows.findIndex(r=>r.productUrl===url);if(i<0){w.document.querySelector('main').innerHTML='<h1>Acceso o cesta</h1>';return;}
  const count=counts[i],name=rows[i].name;
  const control=store==='DIA'?(count?'<div data-test-id="add2cart-mix-button"><button aria-label="remove one unit"></button><input aria-label="add to cart input" data-test-id="add2cart-mix-button-input" type="tel" value="'+count+'"><button class="add" aria-label="add one unit to cart"></button></div>':'<button class="add" aria-label="add to cart button">Añadir</button>'):count?'<input type="number" value="'+count+'"><button aria-label="Quitar una unidad de '+name+'">−</button><button class="add" aria-label="Añadir una unidad de '+name+'">+</button>':'<button class="add" aria-label="Añadir '+name+' al carrito">Añadir</button>';
  // Responsive duplicate controls refer to the same product, not recommendations.
  w.document.querySelector('main').innerHTML='<div class="primary-information"><h1>'+name+'</h1><div>'+control+'</div>'+(store==='Alcampo'?'<div class="sticky">'+control+'</div>':'')+'</div><a href="'+(store==='Carrefour'?'/MiCarrito':'/basket')+'">Carrito</a><aside><button>Añadir recomendación</button></aside>';
  if(outOfStock&&i===0)w.document.querySelector('.primary-information').innerHTML='<h1>'+name+'</h1><button class="add-2-cart__basic-button--disabled" aria-label="add to cart button">Agotado</button>';
  if(store==='DIA'&&counts[0]&&intervention)w.document.querySelector('main').insertAdjacentHTML('beforeend','<div role="dialog">Nos preocupamos por tu privacidad<button>Rechazar todas</button></div>');
  if(loginModal)w.document.querySelector('main').insertAdjacentHTML('beforeend','<div id="modal"><h2>Iniciar sesión/registrarse</h2><p>Para ofrecerte el mejor surtido elige tu tienda y tu franja horaria inicia sesión o regístrate</p></div>');
  for(const b of w.document.querySelectorAll('.add'))b.onclick=()=>{if(needsLogin&&loginIntercept){loginModal=true;render();return;}counts[i]+=rows[i].minimumPurchaseUnits;clicks[i]++;if(needsLogin){url=origin+'/access';render();}else render();};
 }
 render();
 const api={storage:{local:{get:async k=>({[k]:structuredClone(saved[k])}),set:async v=>Object.assign(saved,structuredClone(v))}},permissions:{contains:async()=>true},tabs:{
  onUpdated:{addListener:fn=>listener=fn},create:async options=>{url=options.url;render();return {id:1,url,status:'complete'};},get:async()=>({id:1,url,status:'complete'}),update:async(id,change)=>{if(change.url){url=change.url;render();}return {id,url,status:'complete'};}
 },scripting:{executeScript:async({func,args})=>{events.push(args[1]);return [{result:w.eval('('+func.toString()+')')(...structuredClone(args))}];}}};
 const controller=createCartController(api,{compare:async()=>({baskets:[{store,complete:true,rows}]}),sleep:async()=>{}});
 return {controller,counts,clicks,rows,events,saved,resolveNotice:()=>{intervention=false;render();},finishLogin:async()=>{needsLogin=false;loginModal=false;url=loginIntercept?rows[0].productUrl:origin+'/MiCarrito';render();await listener?.(1,{status:'complete'},{id:1,url,status:'complete'});},authEvent:async()=>listener?.(1,{status:'complete'},{id:1,url:origin+'/access',status:'complete'}),close:()=>dom.window.close()};
}
async function settled(c){for(let i=0;i<100;i++){await new Promise(r=>setTimeout(r,1));const j=await c.get();if(['paused','complete'].includes(j?.status))return j;}throw new Error('No termina');}

test('DIA: contador tel y botones ingleses; tras cerrar cookies continúa los tres productos sin otro clic',async()=>{
 const s=shop('DIA');try{await s.controller.start({store:'DIA',text:'1 kg filetes vacuno\n4 l leche\n24 huevos',postcode:'28001'});const paused=await settled(s.controller);assert.equal(paused.pauseCode,'intervention');assert.deepEqual(s.counts,[1,0,0]);s.resolveNotice();const done=await settled(s.controller);assert.equal(done.status,'complete',done.message);assert.deepEqual(s.counts,[2,4,1]);assert.deepEqual(s.clicks,[2,4,1]);}finally{s.close();}
});

test('Un primer producto agotado no se pulsa y se preparan los otros dos',async()=>{
 const s=shop('DIA',{outOfStock:true});try{await s.controller.start({store:'DIA',text:'1 kg filetes vacuno\n4 l leche\n24 huevos',postcode:'28001'});const job=await settled(s.controller);assert.equal(job.status,'paused');assert.equal(job.pauseCode,'out-of-stock');assert.deepEqual(s.counts,[0,4,1]);assert.deepEqual(s.clicks,[0,4,1]);assert.match(job.message,/2 de 3/);assert.equal(job.rows[0].status,'unavailable');}finally{s.close();}
});

test('Alcampo: controles principal y fijo duplicados completan filetes, leche y huevos',async()=>{
 const s=shop('Alcampo');try{await s.controller.start({store:'Alcampo',text:'1 kg filetes vacuno\n4 l leche\n24 huevos',postcode:'28001'});const job=await settled(s.controller);assert.equal(job.status,'complete',job.message);assert.deepEqual(s.counts,[2,4,1]);assert.deepEqual(s.clicks,[2,4,1]);assert.equal(job.rows.filter(r=>r.status==='done').length,3);}finally{s.close();}
});
test('Carrefour: al volver del acceso retoma el primer producto y termina los otros dos',async()=>{
 const s=shop('Carrefour',{login:true});try{await s.controller.start({store:'Carrefour',text:'1 kg filetes vacuno\n4 l leche\n24 huevos',postcode:'28001'});const paused=await settled(s.controller);assert.equal(paused.status,'paused');assert.equal(paused.pauseCode,'session');assert.deepEqual(s.counts,[1,0,0]);
  await s.authEvent();assert.equal((await s.controller.get()).status,'paused');await s.finishLogin();const done=await settled(s.controller);assert.equal(done.status,'complete',done.message);assert.deepEqual(s.counts,[2,6,1]);assert.deepEqual(s.clicks,[2,1,1]);assert.equal(done.rows.filter(r=>r.status==='done').length,3);
 }finally{s.close();}
});

test('Detener durante el acceso impide la reanudación automática tras identificarse',async()=>{
 const s=shop('Carrefour',{login:true});try{await s.controller.start({store:'Carrefour',text:'1 kg filetes vacuno\n4 l leche\n24 huevos',postcode:'28001'});await settled(s.controller);await s.controller.cancel();await s.finishLogin();assert.equal((await s.controller.get()).status,'cancelled');assert.deepEqual(s.counts,[1,0,0]);}finally{s.close();}
});

test('Detener durante cookies impide reanudar al cerrarlas',async()=>{
 const s=shop('DIA');try{await s.controller.start({store:'DIA',text:'1 kg filetes vacuno\n4 l leche\n24 huevos',postcode:'28001'});await settled(s.controller);await s.controller.cancel();s.resolveNotice();assert.equal((await s.controller.get()).status,'cancelled');assert.deepEqual(s.counts,[1,0,0]);}finally{s.close();}
});

test('El diálogo de privacidad oculto no bloquea el contador real de DIA',()=>{
 const item={name:'Escalopines de vacuno',productUrl:'https://www.dia.es/carnes/vacuno/p/170629'},dom=new JSDOM('<div style="display:none"><div role="dialog">Privacidad</div></div><div class="primary-information"><h1>Escalopines de vacuno</h1><button aria-label="remove one unit"></button><input type="tel" aria-label="add to cart input" data-test-id="add2cart-mix-button-input" value="3"><button aria-label="add one unit to cart"></button></div>',{url:item.productUrl,runScripts:'outside-only'});
 try{dom.window.Element.prototype.getClientRects=()=>[{}];const state=dom.window.eval('('+cartPageStep.toString()+')')(item);assert.equal(state.state,'ready');assert.equal(state.count,3);}finally{dom.window.close();}
});

test('Conserva el contador aunque esté fuera del contenedor de los botones con nombre',()=>{
 const item={name:'Filetes de vacuno',productUrl:'https://www.compraonline.alcampo.es/products/filetes/1'},dom=new JSDOM('<div class="primary-information"><h1>Filetes de vacuno</h1><input type="number" value="3"><div><button aria-label="Quitar una unidad de Filetes de vacuno">−</button><button aria-label="Añadir una unidad de Filetes de vacuno">+</button></div></div>',{url:item.productUrl,runScripts:'outside-only'});
 try{dom.window.Element.prototype.getClientRects=()=>[{}];const execute=dom.window.eval('('+cartPageStep.toString()+')');assert.equal(execute(item).count,3);}finally{dom.window.close();}
});

test('Los contadores duplicados discrepantes esperan sincronización sin añadir',()=>{
 const item={name:'Filetes de vacuno',productUrl:'https://www.compraonline.alcampo.es/products/filetes/1'},dom=new JSDOM('<div class="primary-information"><h1>Filetes de vacuno</h1><input type="number" value="1"><input type="number" value="2"><button>Quitar</button><button>+</button></div>',{url:item.productUrl,runScripts:'outside-only'});
 try{dom.window.Element.prototype.getClientRects=()=>[{}];assert.equal(dom.window.eval('('+cartPageStep.toString()+')')(item,'add').state,'loading');}finally{dom.window.close();}
});

test('Dos botones genéricos de añadir no se confunden con copias acreditadas del mismo producto',()=>{
 const item={name:'Filetes de vacuno',productUrl:'https://www.compraonline.alcampo.es/products/filetes/1',expectedCount:0},dom=new JSDOM('<div class="primary-information"><h1>Filetes de vacuno</h1><button>Añadir</button><section><h2>Otro producto</h2><button>Añadir</button></section></div>',{url:item.productUrl,runScripts:'outside-only'});
 try{dom.window.Element.prototype.getClientRects=()=>[{}];for(const b of dom.window.document.querySelectorAll('button'))b.onclick=()=>assert.fail('No puede escoger entre productos ambiguos');assert.equal(dom.window.eval('('+cartPageStep.toString()+')')(item,'add').state,'loading');}finally{dom.window.close();}
});

test('Alcampo: el aviso real de acceso rechaza Añadir; tras identificarse reintenta y termina toda la lista',async()=>{
 const s=shop('Alcampo',{loginIntercept:true});try{await s.controller.start({store:'Alcampo',text:'1 kg filetes vacuno\n4 l leche\n24 huevos',postcode:'28001'});const paused=await settled(s.controller);assert.equal(paused.pauseCode,'session');assert.deepEqual(s.counts,[0,0,0]);assert.equal(paused.rows[0].sessionInterrupted,true);await s.finishLogin();const done=await settled(s.controller);assert.equal(done.status,'complete',done.message);assert.deepEqual(s.counts,[2,4,1]);assert.deepEqual(s.clicks,[2,4,1]);}finally{s.close();}
});
test('Alcampo detecta la sesión ausente antes de pulsar Añadir',()=>{
 const item={name:'Filetes de vacuno',productUrl:'https://www.compraonline.alcampo.es/products/filetes/1'},dom=new JSDOM('<header><button>Iniciar sesión</button></header><div><h1>Filetes de vacuno</h1><button>Añadir Filetes de vacuno al carrito</button></div>',{url:item.productUrl,runScripts:'outside-only'});
 try{dom.window.Element.prototype.getClientRects=()=>[{}];for(const b of dom.window.document.querySelectorAll('button'))b.onclick=()=>assert.fail('No debe intentar añadir sin sesión');assert.equal(dom.window.eval('('+cartPageStep.toString()+')')(item,'add').code,'session');}finally{dom.window.close();}
});
test('DIA: lee precio real y pulsa menos para corregir cuatro bandejas a tres',()=>{
 const item={name:'Escalopines de vacuno',productUrl:'https://www.dia.es/carnes/vacuno/p/170629',target:3,expectedCount:4},dom=new JSDOM('<div class="primary-information"><h1>Escalopines de vacuno</h1><p data-test-id="buy-box-active-price">7,98 €</p><p>18,99 €/KILO</p><button id="minus" aria-label="remove one unit"></button><input type="tel" aria-label="add to cart input" value="4"><button aria-label="add one unit to cart"></button></div>',{url:item.productUrl,runScripts:'outside-only'});
 try{dom.window.Element.prototype.getClientRects=()=>[{}];dom.window.document.getElementById('minus').onclick=()=>dom.window.document.querySelector('input').value='3';const execute=dom.window.eval('('+cartPageStep.toString()+')');assert.equal(execute(item).priceCents,798);assert.equal(execute(item,'remove').state,'clicked');assert.equal(execute(item).count,3);}finally{dom.window.close();}
});
