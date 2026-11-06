import {parseVoiceIntent} from '../extension/voice-intent.js';
import {friendlyIssue} from '../extension/feedback.js';
import {setupDictation} from '../extension/voice.js';
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import {JSDOM} from 'jsdom';
import {compareObserved,observedList} from '../observed.js';
import {RETAILERS,allowedProductUrl,sourceStatus} from '../collectors/registry.js';
import {normalizeText,splitShoppingList,requestKey} from '../engine.js';
const html=await readFile(new URL('../extension/panel.html',import.meta.url),'utf8');
const script=(await readFile(new URL('../extension/panel.js',import.meta.url),'utf8')).replace(/^import .+;\r?$/gm,'');
const snapshot=JSON.parse(await readFile(new URL('../data/dia-latest.json',import.meta.url))),now=Math.max(...snapshot.observations.map(o=>Date.parse(o.observedAt)));
async function until(predicate){for(let n=0;n<100;n++){if(predicate())return;await new Promise(r=>setTimeout(r,1));}throw new Error('El panel no llegó al estado esperado.');}
async function panel(saved={},options={}){
 const dom=new JSDOM(html,{url:'chrome-extension://test/panel.html',runScripts:'outside-only'}),w=dom.window,calls=[];
 Object.assign(w,{setupDictation,parseVoiceIntent,friendlyIssue,RETAILERS,allowedProductUrl,normalizeText,splitShoppingList,requestKey});
 const recognitions=[],spoken=[];if(options.voice){w.SpeechRecognition=class{constructor(){recognitions.push(this);}start(){this.started=true;this.onstart?.();}stop(){this.stopped=true;if(!options.deferEnd)this.onend?.();}abort(){this.onend?.();}};Object.defineProperty(w.navigator,'permissions',{value:{query:async()=>({state:'granted'})}});w.SpeechSynthesisUtterance=class{constructor(text){this.text=text;}};w.speechSynthesis={cancel:()=>{},speak:u=>spoken.push(u.text)};}
 w.chrome={runtime:{sendMessage:async message=>{
  calls.push(message);
  if(message.type==='status')return {ok:true,data:{postcode:options.postcode??'28001',automatic:options.automatic===true,count:snapshot.observations.length,stores:options.stores||sourceStatus(snapshot)}};
  if(message.type==='clear-data'){for(const k of Object.keys(saved))delete saved[k];return {ok:true,data:{cleared:true}};}
  if(message.type==='draft'){if(message.draft)saved.draft=JSON.parse(JSON.stringify(message.draft));return {ok:true,data:saved.draft||null};}
  if(message.type==='compare')return {ok:true,data:compareObserved(message,snapshot,now)};
  if(message.type==='catalog')return {ok:true,data:observedList(snapshot,{query:message.query},options.catalogNow??now)};
  if(message.type==='cart-status')return {ok:true,data:saved.cartJob||null};
  if(message.type==='resource-usage')return {ok:true,data:{storageBytes:1048576,httpRequests:4,httpFailures:1,decodedBytes:524288,browserPages:2,peakBrowserPages:1,recent:[]}};
  if(message.type==='cart-open')return {ok:true,data:saved.cartJob||null};
  if(message.type==='cart-cancel'){saved.cartJob={...saved.cartJob,status:'cancelled'};return {ok:true,data:saved.cartJob};}
  if(message.type==='cart-start'){if(options.cartError)return {ok:false,error:options.cartError};saved.cartJob={store:message.store,tabId:42,status:'paused',message:'Elige tu zona y continúa.',rows:[{name:'Leche entera',cartUnits:4,status:'pending'}]};return {ok:true,data:saved.cartJob};}
  return {ok:false,error:'Operación no disponible en esta prueba.'};
 }},permissions:{contains:async()=>options.allowed===true,request:async args=>{calls.push({type:'permission',...args});return options.allowed===true;}},tabs:{create:async()=>({id:42}),update:async(id,args)=>{calls.push({type:'tab-update',id,...args});return {id};}}};
 vm.runInContext(script,dom.getInternalVMContext());const d=w.document;
 await until(()=>d.getElementById('status').textContent.includes('guardados'));
 d.getElementById('brandMode').value=saved.draft?.brandPreference?.mode||'any';
 const submit=async text=>{d.getElementById('list').value=text;d.getElementById('list').dispatchEvent(new w.Event('input'));d.getElementById('form').dispatchEvent(new w.Event('submit',{bubbles:true,cancelable:true}));await until(()=>!d.getElementById('compare').disabled&&d.querySelector('.request-row'));};
 const say=(text,index=0)=>{const result=Object.assign([{transcript:text}],{isFinal:true}),results=[];results[index]=result;recognitions.at(-1).onresult({resultIndex:index,results});};
 return {dom,w,d,calls,submit,saved,recognitions,spoken,say};
}
test('Una instalación sin zona solicita el código postal antes de comparar',async()=>{
 const p=await panel({}, {postcode:''});p.d.getElementById('list').value='4 l leche';p.d.getElementById('form').dispatchEvent(new p.w.Event('submit',{cancelable:true}));
 assert.equal(p.calls.some(c=>c.type==='compare'),false);assert.match(p.d.getElementById('error').textContent,/código postal/);assert.equal(p.d.querySelector('.purchase-settings').open,true);assert.equal(p.d.activeElement.id,'postcode');p.dom.window.close();
});

test('El borrado del panel requiere un segundo clic, puede cancelarse y envía una orden explícita',async()=>{
 const p=await panel({draft:{text:'4 l leche',postcode:'28001'}});
 p.d.getElementById('clearData').click();assert.equal(p.d.getElementById('clearDataConfirm').hidden,false);assert.equal(p.calls.some(c=>c.type==='clear-data'),false);
 p.d.getElementById('cancelClearData').click();assert.equal(p.d.getElementById('clearDataConfirm').hidden,true);assert.ok(p.saved.draft);
 p.d.getElementById('clearData').click();p.d.getElementById('confirmClearData').click();await until(()=>p.d.getElementById('notice').textContent.includes('Datos locales borrados'));
 assert.equal(p.calls.find(c=>c.type==='clear-data').confirmed,true);assert.deepEqual(p.saved,{});p.dom.window.close();
});

test('El borrado descarta el último resultado de voz que llegue después de detener la escucha',async()=>{
 const p=await panel({}, {voice:true,deferEnd:true});p.d.getElementById('dictate').click();await until(()=>p.recognitions.at(-1)?.started);p.recognitions.at(-1).onstart();
 p.d.getElementById('clearData').click();p.d.getElementById('confirmClearData').click();p.say('4 litros de leche');p.recognitions.at(-1).onend();
 await until(()=>p.d.getElementById('notice').textContent.includes('Datos locales borrados'));assert.equal(p.d.getElementById('list').value,'');assert.deepEqual(p.saved,{});p.dom.window.close();
});

test('El panel conserva el 97% y ofrece buscar cuando no hay una coincidencia acreditada',async()=>{
 const p=await panel();await p.submit('un kilo de ternera picada, 97% carne o más');
 assert.equal(p.d.querySelectorAll('.request-row').length,1);assert.match(p.d.getElementById('understood').textContent,/Mínimo 97 % de carne/);
 assert.match(p.d.getElementById('result').textContent,/Consultar todos los supermercados/);
 assert.equal(p.d.querySelector('.total'),null);assert.equal(p.d.getElementById('error').hidden,true);p.dom.window.close();
});
test('El botón de aclaración vuelve a comparar y mantiene la cantidad y el porcentaje',async()=>{
 const p=await panel();await p.submit('un kilo de ternera, 97% carne o más');
 assert.match(p.d.querySelector('.question').textContent,/Cómo quieres la ternera/);
 [...p.d.querySelectorAll('.choice')].find(b=>b.textContent==='Picada').click();
 await until(()=>p.calls.filter(c=>c.type==='compare').length===2&&!p.d.getElementById('compare').disabled);
 assert.match(p.d.getElementById('understood').textContent,/Mínimo 97 %/);assert.match(p.d.getElementById('understood').textContent,/picada/);
 assert.equal(p.d.getElementById('list').value,'un kilo de ternera, 97% carne o más');
 const comparison=p.calls.filter(c=>c.type==='compare').at(-1);assert.equal(Object.values(comparison.resolutions)[0].cut,'picada');p.dom.window.close();
});
test('Admite una respuesta escrita a la pregunta, sin reescribir la lista',async()=>{
 const p=await panel();await p.submit('1 kg ternera');
 const q=p.d.querySelector('.reply-form'),reply=q.querySelector('input');reply.value='La quiero picada';q.dispatchEvent(new p.w.Event('submit',{bubbles:true,cancelable:true}));
 await until(()=>p.calls.filter(c=>c.type==='compare').length===2&&!p.d.getElementById('compare').disabled);
 assert.match(p.d.getElementById('understood').textContent,/picada/);assert.equal(p.d.getElementById('error').hidden,true);p.dom.window.close();
});
test('La falta de permiso no borra la lista ni arranca una consulta',async()=>{
 const p=await panel();await p.submit('1 kg ternera picada 97% carne');p.d.querySelector('.search-callout button').click();await until(()=>!p.d.getElementById('error').hidden);
 assert.match(p.d.getElementById('error').textContent,/No has permitido/);assert.equal(p.calls.filter(c=>c.type==='search').length,0);assert.equal(p.d.querySelectorAll('.request-row').length,1);p.dom.window.close();
});
test('Los resultados dejan claro qué cadenas están incompletas y no muestran ceros como ofertas',async()=>{
 const p=await panel();await p.submit('6 litros leche entera\n12 huevos M\n1 kg arroz redondo');
 assert.ok(p.d.querySelectorAll('.store-table tbody tr').length>=8);const noData=[...p.d.querySelectorAll('.store-table tbody tr')].filter(r=>r.lastElementChild.textContent==='—');assert.ok(noData.length);assert.ok(noData.every(r=>r.textContent.includes('Sin consultar esta lista')));p.dom.window.close();
});
test('Productos y Tiendas funcionan y las pestañas admiten teclado',async()=>{
 const p=await panel();p.d.getElementById('tab-basket').dispatchEvent(new p.w.KeyboardEvent('keydown',{key:'ArrowRight',bubbles:true}));
 await until(()=>p.d.querySelectorAll('#products .product').length>0);assert.equal(p.d.getElementById('catalog').hidden,false);assert.equal(p.d.getElementById('tab-catalog').getAttribute('aria-selected'),'true');
 p.d.getElementById('tab-sources').click();await until(()=>p.d.querySelectorAll('.sourcecard').length===8);assert.equal(p.d.getElementById('sources').hidden,false);p.dom.window.close();
});
test('Recupera el borrador, las respuestas y los ajustes al volver a abrir el panel',async()=>{
 const saved={draft:{text:'un kilo ternera',postcode:'28001',maxStores:1,resolutions:{[requestKey('un kilo ternera',0)]:{cut:'picada'}}}},p=await panel(saved);
 assert.equal(p.d.getElementById('list').value,'un kilo ternera');assert.equal(p.d.getElementById('maxStores').value,'1');p.d.getElementById('form').dispatchEvent(new p.w.Event('submit',{cancelable:true}));await until(()=>p.d.querySelector('.request-row')&&!p.d.getElementById('compare').disabled);assert.match(p.d.getElementById('understood').textContent,/picada/);p.dom.window.close();
});
test('Una cadena introducida por el usuario se muestra como texto, sin interpretar HTML',async()=>{
 const p=await panel();await p.submit('1 kg <img src=x onerror=alert(1)> brócoli');assert.equal(p.d.querySelector('#understood img'),null);assert.match(p.d.getElementById('understood').textContent,/<img/);p.dom.window.close();
});


test('Una respuesta que añade un porcentaje se conserva y se vuelve a interpretar',async()=>{
 const p=await panel();await p.submit('un kilo de ternera');const form=p.d.querySelector('.reply-form');form.querySelector('input').value='picada con un mínimo de 97% de carne';form.dispatchEvent(new p.w.Event('submit',{bubbles:true,cancelable:true}));
 await until(()=>p.calls.filter(c=>c.type==='compare').length===2&&!p.d.getElementById('compare').disabled);
 assert.match(p.d.getElementById('understood').textContent,/Mínimo 97 % de carne/);assert.match(p.d.getElementById('list').value,/97%/);assert.equal(p.d.getElementById('error').hidden,true);p.dom.window.close();
});
test('Si falta la cantidad de carne, pregunta por ella y conserva el requisito de composición',async()=>{
 const p=await panel();await p.submit('ternera picada 97% carne');assert.match(p.d.querySelector('.question').textContent,/cantidad/);
 const form=p.d.querySelector('.reply-form');form.querySelector('input').value='750 g';form.dispatchEvent(new p.w.Event('submit',{bubbles:true,cancelable:true}));
 await until(()=>p.calls.filter(c=>c.type==='compare').length===2&&!p.d.getElementById('compare').disabled);
 assert.match(p.d.getElementById('understood').textContent,/0.75 kg/);assert.match(p.d.getElementById('understood').textContent,/Mínimo 97 %/);p.dom.window.close();
});
test('Antes de comparar solicita preferencia de marca y no inicia consultas sin elegir',async()=>{
 const p=await panel();p.d.getElementById('brandMode').value='';p.d.getElementById('list').value='4 l leche';p.d.getElementById('form').dispatchEvent(new p.w.Event('submit',{cancelable:true}));await new Promise(r=>setTimeout(r,1));assert.equal(p.calls.some(c=>c.type==='compare'),false);assert.match(p.d.getElementById('error').textContent,/marca/);p.dom.window.close();
});
test('La marca concreta se envía al motor y se conserva en el borrador',async()=>{
 const p=await panel();p.d.getElementById('brandMode').value='specific';p.d.getElementById('brandName').value='Pascual';await p.submit('4 l leche');assert.equal(p.calls.find(c=>c.type==='compare').brandPreference.name,'Pascual');assert.equal(p.saved.draft.brandPreference.mode,'specific');assert.match(p.d.getElementById('understood').textContent,/Marca: Pascual/);p.dom.window.close();
});
test('La tabla diferencia preparar cesta de actualizar precios',async()=>{
 const p=await panel();await p.submit('4 l leche');const text=p.d.querySelector('.store-table').textContent;assert.match(text,/Preparar cesta en Mercadona/);assert.match(text,/Actualizar precios/);assert.doesNotMatch(text,/Consultar esta tienda/);p.dom.window.close();
});
test('Preparar cesta muestra su estado y enfoca el progreso en vez de quedar fuera de vista',async()=>{
 const p=await panel({}, {allowed:true});await p.submit('4 l leche');
 [...p.d.querySelectorAll('button')].find(b=>b.textContent==='Preparar cesta en DIA').click();
 await until(()=>p.calls.some(c=>c.type==='cart-start')&&!p.d.getElementById('compare').disabled);
 assert.equal(p.saved.cartJob.store,'DIA');assert.equal(p.d.activeElement.id,'cartProgress');assert.match(p.d.getElementById('cartProgress').textContent,/Elige tu zona/);assert.equal(p.calls.some(c=>c.type==='permission'),false);p.dom.window.close();
});
test('Dicta, dice comparar y responde marca blanca sin escribir comandos como productos',async()=>{
 const p=await panel({}, {voice:true});p.d.getElementById('brandMode').value='';p.d.getElementById('dictate').click();await until(()=>p.recognitions[0]?.started);
 p.say('cuatro litros de leche',0);p.say('comparar',1);await until(()=>!p.d.getElementById('voiceQuestion').hidden);
 assert.match(p.d.getElementById('voiceQuestionText').textContent,/marcas/);assert.equal(p.spoken.length,1);
 p.d.getElementById('voiceReply').click();await until(()=>p.recognitions[1]?.started);p.say('marca blanca');await until(()=>p.calls.some(c=>c.type==='compare')&&!p.d.getElementById('compare').disabled);
 assert.equal(p.calls.find(c=>c.type==='compare').brandPreference.mode,'private');assert.equal(p.d.getElementById('list').value,'cuatro litros de leche');p.dom.window.close();
});
test('La respuesta hablada resuelve el corte y no añade una nueva línea de compra',async()=>{
 const p=await panel({}, {voice:true});await p.submit('un kilo de ternera');[...p.d.querySelector('.question').querySelectorAll('button')].find(b=>b.textContent==='Responder por voz').click();await until(()=>p.recognitions[0]?.started);p.say('picada');
 await until(()=>p.calls.filter(c=>c.type==='compare').length===2&&!p.d.getElementById('compare').disabled);
 assert.match(p.d.getElementById('understood').textContent,/picada/);assert.equal(p.d.getElementById('list').value,'un kilo de ternera');p.dom.window.close();
});
test('Preparar por voz usa el permiso ya concedido y conserva la lista',async()=>{
 const p=await panel({}, {voice:true,allowed:true});await p.submit('4 l leche');p.d.getElementById('dictate').click();await until(()=>p.recognitions[0]?.started);p.say('preparar cesta en DIA');await until(()=>p.calls.some(c=>c.type==='cart-start')&&!p.d.getElementById('compare').disabled);
 assert.equal(p.calls.find(c=>c.type==='cart-start').store,'DIA');assert.equal(p.calls.some(c=>c.type==='permission'),false);assert.equal(p.d.getElementById('list').value,'4 l leche');p.dom.window.close();
});
test('Si falta permiso al preparar por voz, muestra un botón y no pide permiso sin clic',async()=>{
 const p=await panel({}, {voice:true});await p.submit('4 l leche');p.d.getElementById('dictate').click();await until(()=>p.recognitions[0]?.started);p.say('preparar cesta en DIA');await until(()=>p.d.getElementById('cartProgress').textContent.includes('Permitir y preparar cesta'));
 assert.equal(p.calls.some(c=>c.type==='permission'||c.type==='cart-start'),false);p.dom.window.close();
});

test('Un error al preparar sustituye Abriendo por una explicación y permite reintentar',async()=>{
 const options={allowed:true,cartError:'La tienda no está disponible.'},p=await panel({},options);await p.submit('4 l leche');
 [...p.d.querySelectorAll('button')].find(b=>b.textContent==='Preparar cesta en DIA').click();await until(()=>p.d.getElementById('cartProgress').dataset.state==='paused');
 const area=p.d.getElementById('cartProgress');assert.match(area.textContent,/La tienda no está disponible/);assert.doesNotMatch(area.textContent,/Abriendo/);
 options.cartError=null;[...area.querySelectorAll('button')].find(b=>b.textContent==='Volver a intentarlo').click();await until(()=>p.calls.filter(c=>c.type==='cart-start').length===2&&!p.d.getElementById('compare').disabled);
 assert.match(area.textContent,/Elige tu zona/);assert.equal(p.d.getElementById('error').hidden,true);p.dom.window.close();
});

test('Añadir composición en una aclaración conserva la marca y cantidad ya elegidas',async()=>{
 const saved={draft:{text:'ternera',postcode:'28001',brandPreference:{mode:'any'},resolutions:{[requestKey('ternera',0)]:{quantity:1,unit:'kg',brandPreference:{mode:'specific',name:'Roler'}}}}},p=await panel(saved);
 await p.submit('ternera');const form=p.d.querySelector('.reply-form');form.querySelector('input').value='picada 97% carne';form.dispatchEvent(new p.w.Event('submit',{cancelable:true}));
 await until(()=>p.calls.filter(c=>c.type==='compare').length===2&&!p.d.getElementById('compare').disabled);
 const answers=Object.values(p.calls.filter(c=>c.type==='compare').at(-1).resolutions)[0];assert.equal(answers.brandPreference.name,'Roler');assert.equal(answers.quantity,1);assert.equal(answers.unit,'kg');assert.match(p.d.getElementById('understood').textContent,/Mínimo 97 %/);assert.match(p.d.getElementById('understood').textContent,/Roler/);p.dom.window.close();
});

test('Una respuesta de voz inválida puede corregirse sin añadir un producto',async()=>{
 const p=await panel({}, {voice:true});await p.submit('1 kg ternera');[...p.d.querySelector('.question').querySelectorAll('button')].find(b=>b.textContent==='Responder por voz').click();await until(()=>p.recognitions[0]?.started);p.say('a trozos');
 await until(()=>!p.d.getElementById('error').hidden);p.d.getElementById('dictate').click();await until(()=>p.recognitions[1]?.started);p.say('picada');
 await until(()=>p.calls.filter(c=>c.type==='compare').length===2&&!p.d.getElementById('compare').disabled);assert.equal(p.d.getElementById('list').value,'1 kg ternera');assert.match(p.d.getElementById('understood').textContent,/picada/);p.dom.window.close();
});

test('Editar la lista descarta una pregunta de voz anterior y permite dictar otro producto',async()=>{
 const p=await panel({}, {voice:true});await p.submit('1 kg ternera');[...p.d.querySelector('.question').querySelectorAll('button')].find(b=>b.textContent==='Responder por voz').click();await until(()=>p.recognitions[0]?.started);p.say('a trozos');await until(()=>!p.d.getElementById('error').hidden);
 p.d.getElementById('list').value='4 l leche';p.d.getElementById('list').dispatchEvent(new p.w.Event('input'));p.d.getElementById('dictate').click();await until(()=>p.recognitions[1]?.started);p.say('12 huevos');
 assert.equal(p.d.getElementById('list').value,'4 l leche\n12 huevos');p.dom.window.close();
});

test('Comparar por voz conserva la orden y la lista mientras termina el reconocimiento',async()=>{
 const p=await panel({}, {voice:true,deferEnd:true});p.d.getElementById('dictate').click();await until(()=>p.recognitions[0]?.started);p.say('4 litros de leche',0);p.say('comparar',1);p.say('preparar cesta en DIA',2);p.say('12 huevos',3);
 assert.equal(p.calls.some(c=>c.type==='compare'||c.type==='cart-start'),false);p.recognitions[0].onend();await until(()=>p.calls.some(c=>c.type==='compare')&&!p.d.getElementById('compare').disabled);
 assert.equal(p.calls.some(c=>c.type==='cart-start'),false);assert.equal(p.d.getElementById('list').value,'4 litros de leche');p.dom.window.close();
});

test('La pausa muestra una acción de apertura recuperable y no una barra vacía',async()=>{
 const p=await panel({cartJob:{store:'Carrefour',tabId:123,status:'paused',message:'No tab with id: 123',rows:[{name:'Leche',cartUnits:6,status:'pending'}]}});
 await until(()=>p.d.querySelector('.cart-status'));const area=p.d.getElementById('cartProgress');assert.equal(p.d.querySelector('.cart-status').textContent,'Necesita tu atención');assert.equal(area.querySelector('progress'),null);assert.doesNotMatch(area.textContent,/No tab with id/);
 [...area.querySelectorAll('button')].find(b=>b.textContent==='Abrir Carrefour').click();await until(()=>p.calls.some(c=>c.type==='cart-open'));assert.equal(p.calls.some(c=>c.type==='tab-update'),false);p.dom.window.close();
});
test('El panel desglosa productos, envío, mínimos y fuentes sin mezclar subtotales con totales',async()=>{
 const p=await panel();await p.submit('4 l leche entera');
 assert.equal(p.d.getElementById('fulfillment').value,'delivery');
 const rows=[...p.d.querySelectorAll('.store-table tbody tr')],dia=rows.find(r=>r.firstElementChild.firstChild.textContent==='DIA'),mercadona=rows.find(r=>r.firstElementChild.firstChild.textContent==='Mercadona');
 assert.match(dia.textContent,/Productos: 3,84/);assert.match(dia.textContent,/Envío: 4,99/);assert.match(dia.lastElementChild.textContent,/8,83/);assert.match(mercadona.textContent,/Pedido mínimo: 60,00/);assert.ok(dia.querySelector('a[href="https://www.dia.es/condiciones-de-compra"]'));p.dom.window.close();
});
test('La modalidad presencial guardada se restaura y el cambio a domicilio se aplica al comparar',async()=>{
 const p=await panel({draft:{text:'4 l leche entera',postcode:'28001',fulfillment:'store'}});await p.submit('4 l leche entera');assert.equal(p.calls.filter(c=>c.type==='compare').at(-1).fulfillment,'store');assert.match(p.d.querySelector('.total').textContent,/Compra presencial/);
 p.d.getElementById('fulfillment').value='delivery';p.d.getElementById('fulfillment').dispatchEvent(new p.w.Event('change'));await until(()=>p.calls.filter(c=>c.type==='compare').length===2&&!p.d.getElementById('compare').disabled);assert.equal(p.calls.filter(c=>c.type==='compare').at(-1).fulfillment,'delivery');assert.match(p.d.querySelector('.total').textContent,/envío estándar/);p.dom.window.close();
});
test('El consumo se pide solo al pulsar y aclara que no mide el tráfico total ni RAM/CPU',async()=>{
 const p=await panel();assert.equal(p.calls.some(c=>c.type==='resource-usage'),false);p.d.getElementById('readUsage').click();await until(()=>p.d.getElementById('resourceStats').textContent.includes('Almacenamiento local'));
 const text=p.d.getElementById('resourceStats').textContent;assert.match(text,/1 MiB/);assert.match(text,/Peticiones HTTP: 4/);assert.match(text,/no representan el tráfico total/);assert.match(text,/CPU y RAM/);assert.equal(p.calls.filter(c=>c.type==='resource-usage').length,1);p.dom.window.close();
});
test('Comparar pliega la edición, deja las ocho tiendas accesibles y permite volver a editar sin perder la lista',async()=>{
 const p=await panel();await p.submit('4 l leche entera');assert.equal(p.d.getElementById('listEditor').open,false);assert.equal(p.d.getElementById('reviewDetails').hidden,false);assert.equal(p.d.querySelector('.all-stores').open,true);assert.equal(p.d.querySelectorAll('.store-table tbody tr').length,8);
 assert.ok([...p.d.querySelectorAll('.store-details')].every(e=>!e.open));[...p.d.querySelectorAll('.total button')].find(b=>b.textContent==='Editar lista').click();assert.equal(p.d.getElementById('listEditor').open,true);assert.equal(p.d.getElementById('list').value,'4 l leche entera');p.dom.window.close();
});
test('Las preguntas se muestran desplegadas y los requisitos no se pierden al responder',async()=>{
 const p=await panel();await p.submit('1 kg ternera 97% carne');assert.equal(p.d.getElementById('reviewDetails').open,true);assert.ok(p.d.querySelector('.question'));assert.match(p.d.getElementById('understood').textContent,/97/);p.dom.window.close();
});
test('Una cesta en curso da prioridad a continuar y devuelve las opciones al detenerla',async()=>{
 const p=await panel({}, {allowed:true});await p.submit('4 l leche');p.d.querySelector('.total [data-prepare-store]').click();await until(()=>p.d.querySelector('.cart-status'));assert.ok([...p.d.querySelectorAll('[data-prepare-store]')].every(b=>b.hidden));p.d.querySelector('.cart-cancel').click();await until(()=>p.d.getElementById('cartProgress').dataset.state==='cancelled');assert.ok([...p.d.querySelectorAll('[data-prepare-store]')].every(b=>!b.hidden));p.dom.window.close();
});
test('Un catálogo sin resultados da una salida y la marca vuelve al panel de compra',async()=>{
 const p=await panel();p.d.getElementById('tab-catalog').click();await until(()=>p.d.querySelector('#products .product'));p.d.getElementById('query').value='zzzzsinproducto';p.d.getElementById('query').dispatchEvent(new p.w.Event('input'));await until(()=>p.d.querySelector('.empty-state'));assert.match(p.d.querySelector('.empty-state').textContent,/Prueba otra palabra/);p.d.querySelector('.brand').click();assert.equal(p.d.getElementById('basket').hidden,false);assert.equal(p.d.getElementById('listEditor').open,true);p.dom.window.close();
});
test('Los límites de la versión están en Tiendas',async()=>{
 const p=await panel();const text=p.d.getElementById('limits').textContent;
 for(const part of ['no arranca solo','código postal','al menos una tienda','29 de octubre de 2026','más de 24 horas','no declara una cesta ganadora','Mercadona, Carrefour, Alcampo y Consum','pueden abrir pestañas','Chrome retrasa la alarma','no renueva precios','no una garantía','intento sin permiso','no se renovaron','precios antiguos','no los usa en el total','micrófono físico','carrito con sesión','ni una compra','Lidl y ALDI','Chrome Web Store','preliminar','no tiene autenticación','127.0.0.1'])assert.match(text,new RegExp(part));
 p.dom.window.close();
});
test('Un intento sin permiso no se presenta como precio renovado',async()=>{
 const stores=sourceStatus(snapshot).map(s=>s.store==='DIA'?{...s,status:'permission-required',lastRun:{status:'permission-required',finishedAt:'2026-11-06T08:05:00.000Z',pages:[],errors:[{message:'No has permitido el acceso a esta cadena.'}],observationCount:0}}:s);
 const p=await panel({}, {stores});p.d.getElementById('tab-sources').click();await until(()=>p.d.getElementById('sourcesList').textContent.includes('Intento sin permiso'));
 const card=p.d.querySelector('.sourcecard').textContent;assert.match(card,/Intento sin permiso/);assert.match(card,/No se renovaron precios/);assert.doesNotMatch(card,/Última consulta/);p.dom.window.close();
});
test('El catálogo marca un precio de más de 24 horas y lo deja fuera del total',async()=>{
 const p=await panel({}, {catalogNow:now+25*3600000});p.d.getElementById('tab-catalog').click();await until(()=>p.d.getElementById('products').textContent.includes('Precio antiguo'));
 assert.match(p.d.getElementById('products').textContent,/No se usa en el total/);assert.equal(p.d.querySelector('.total'),null);p.dom.window.close();
});
