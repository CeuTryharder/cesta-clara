import {setupDictation} from './voice.js';
import {parseVoiceIntent} from './voice-intent.js';
import {friendlyIssue} from './feedback.js';
import {RETAILERS,allowedProductUrl} from './shared/collectors/registry.js';
import {normalizeText,splitShoppingList,requestKey} from './shared/engine.js';
const $=id=>document.getElementById(id),money=n=>new Intl.NumberFormat('es-ES',{style:'currency',currency:'EUR'}).format(n/100),date=s=>s?new Date(s).toLocaleString('es-ES',{dateStyle:'short',timeStyle:'short'}):'Sin consulta';
const node=(tag,text,cls)=>{const el=document.createElement(tag);if(text!==undefined)el.textContent=text;if(cls)el.className=cls;return el;};
let resolutions={},latest=null,busy=false,draftTimer,dictation=null,voiceMode=false,voiceQuestion=null,voiceAction=null,cartInProgress=false;
async function call(type,args={}){const result=await chrome.runtime.sendMessage({type,...args});if(!result?.ok)throw new Error(result?.error||'No se pudo completar la consulta.');return result.data;}
function message(id,text){$(id).textContent=text;$(id).hidden=!text;}
function reveal(el){el.scrollIntoView?.({block:'nearest',behavior:window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches?'auto':'smooth'});el.focus?.({preventScroll:true});}
function fail(e){const text=friendlyIssue(e);message('error',text);reveal($('error'));if(voiceMode)speak(text);}
function step(name){for(const id of ['list','review','shop']){if(id===name)$('step-'+id).setAttribute('aria-current','step');else $('step-'+id).removeAttribute('aria-current');}}
function working(value){busy=value;for(const button of document.querySelectorAll('button:not([role=tab])'))button.disabled=value;$('form').setAttribute('aria-busy',String(value));dictation?.setBusy(value);}
function input(){return {text:$('list').value,postcode:$('postcode').value,fulfillment:$('fulfillment').value,maxStores:Number($('maxStores').value),acceptAlternatives:true,resolutions,brandPreference:{mode:$('brandMode').value||'any',name:$('brandName').value}};}
async function saveDraft(){await call('draft',{draft:input()});}
function scheduleSave(){clearTimeout(draftTimer);draftTimer=setTimeout(()=>saveDraft().catch(fail),300);}
function sourceLink(url,store){if(!allowedProductUrl(url,store))return null;const a=node('a','Ver ficha en '+store);a.href=url;a.target='_blank';a.rel='noopener noreferrer';return a;}
function productCard(p,detail=false){
 const card=node('article',undefined,'product'),head=node('div',undefined,'product-heading');head.append(node('strong',p.name),node('span',money(detail?p.totalCents:p.priceCents),'price'));
 card.append(head,node('p',(p.brand&&!normalizeText(p.name).includes(normalizeText(p.brand))?p.brand+' · ':'')+p.store+' · '+(p.channel==='in-store-advertised'?'Precio anunciado en tienda':'Precio online')));
 if(detail)card.append(node('p',p.packs+' envase'+(p.packs===1?'':'s')+' × '+p.packSize+' '+p.unit+' · compras '+Number((p.packs*p.packSize).toFixed(3))+' '+p.unit));
 else if(p.packageQuantity)card.append(node('p',p.packageQuantity+' '+p.packageUnit+' por envase'));
 const rateUnit=p.unit||p.packageUnit,quotedKg=rateUnit==='kg'&&/^(kg|kilo|kilos|kilogramo|kilogramos)$/i.test(p.unitPriceBasis||'kg'),rate=(p.unit||quotedKg)&&Number.isFinite(p.unitPriceCents)?p.unitPriceCents:p.packageQuantity?Math.round(p.priceCents/p.packageQuantity):null;if(Number.isFinite(rate)&&rateUnit)card.append(node('p',money(rate)+' / '+rateUnit+(p.selectionBasis==='unit-price'?' · menor €/kg entre '+p.candidateCount+' opciones válidas de esta tienda':''),'helper'));
 if(p.estimatedPrice)card.append(node('p','Peso variable: el precio final puede variar.','helper'));
 if(p.observedAt)card.append(node('p','Revisado: '+date(p.observedAt)));
 if(p.freshness&&p.freshness!=='fresh')card.append(node('p','Precio antiguo o fuera de vigencia. No se usa en el total.','warning'));
 if(p.conditionalPrice)card.append(node('p','Precio con condiciones. No se usa en el total.','warning'));
 if(p.composition)card.append(node('p','Composición acreditada: '+p.composition.percent+' % de carne de '+p.composition.species,'evidence'));
 if(p.ingredients){const detail=node('details'),summary=node('summary','Ingredientes de la ficha');detail.append(summary,node('p',p.ingredients));card.append(detail);}
 const link=sourceLink(p.productUrl,p.store);if(link)card.append(link);return card;
}
function replaceRequest(lineId,value,{preserveAnswers=false}={}){
 const lines=splitShoppingList($('list').value),index=lines.findIndex((s,i)=>requestKey(s,i)===lineId);
 if(index<0)throw new Error('La lista ha cambiado. Vuelve a revisarla.');
 const replacements=splitShoppingList(value);if(!replacements.length)throw new Error('Escribe el producto corregido.');
 const next={},saved=resolutions[lineId]||{};
 for(const [i,line] of lines.entries()){if(i===index)continue;const answer=resolutions[requestKey(line,i)];if(answer)next[requestKey(line,i>index?i+replacements.length-1:i)]=answer;}
 for(const [offset,line] of replacements.entries()){const answer=preserveAnswers&&replacements.length===1?saved:saved.brandPreference?{brandPreference:saved.brandPreference}:{};if(Object.keys(answer).length)next[requestKey(line,index+offset)]={...answer};}
 lines.splice(index,1,...replacements);$('list').value=lines.join('\n');resolutions=next;
}
async function answer(question,value){
 if(busy)return;message('error','');
 resolutions[question.lineId]={...(resolutions[question.lineId]||{}),[question.field]:value};
 await saveDraft();await compare();
}
function questionCard(q){
 const card=node('div',undefined,'question');card.append(node('p',q.question));
 if(q.options.length){const choices=node('div',undefined,'choices');for(const option of q.options){const b=node('button',option.label,'choice');b.type='button';b.onclick=()=>answer(q,option.value).catch(fail);choices.append(b);}card.append(choices);}
 const form=node('form',undefined,'reply-form'),field=node('input'),label=node('label',q.field==='rewrite'?'Corrige la línea completa':'O escribe tu respuesta','reply-label');
 field.id=q.lineId+'-'+q.field;field.setAttribute('aria-label',label.textContent);field.maxLength=500;field.required=true;
 field.placeholder=q.field==='quantity'?'Por ejemplo, 1 kg':q.field==='cut'?'La quiero picada':q.field==='allowVacuno'?'Sí o no':'Tu respuesta';
 if(q.field==='rewrite')field.value=q.text;
 label.htmlFor=field.id;card.append(label);
 const send=node('button','Aplicar','button button-small');send.type='submit';form.append(field,send);
 form.onsubmit=async e=>{e.preventDefault();if(busy)return;try{
  const reply=normalizeText(field.value);
  if(q.field==='rewrite'){replaceRequest(q.lineId,field.value);await saveDraft();await compare();return;}
  if(q.field==='quantity'){const m=reply.match(/^(\d+(?:[.,]\d+)?)\s*(kg|kilos?|g|gramos?|l|litros?|unidades?|uds?)$/);if(!m)throw new Error('Indica la cantidad y su unidad, por ejemplo: 1 kg.');let quantity=Number(m[1].replace(',','.')),unit=/^g/.test(m[2])?'kg':/^k/.test(m[2])?'kg':/^l/.test(m[2])?'l':'ud';if(/^g/.test(m[2]))quantity/=1000;if(quantity<=0||quantity>1000)throw new Error('Revisa la cantidad.');resolutions[q.lineId]={...(resolutions[q.lineId]||{}),quantity,unit};await saveDraft();await compare();return;}
  const option=q.options.find(o=>typeof o.value==='boolean'?(o.value?/^(si|si tambien vacuno|tambien vacuno|me vale vacuno)$/.test(reply):/^(no|solo ternera)$/.test(reply)):new RegExp('(?:^|[^a-z])'+o.value+'(?:[^a-z]|$)').test(reply));
  if(!option)throw new Error('Elige una de las opciones o corrige el producto en tu lista para añadir más detalles.');
  const extra=typeof option.value==='string'?reply.replace(option.value,'').replace(/\b(la|lo|quiero|me|vale|en|de|carne|por|favor)\b/g,'').trim():'';
  if(extra&&(q.field==='cut'||q.field==='species')){replaceRequest(q.lineId,q.text+' '+field.value,{preserveAnswers:true});await saveDraft();await compare();}
  else await answer(q,option.value);
 }catch(error){fail(error);}};
 const voice=node('button','Responder por voz','text-button');voice.type='button';voice.onclick=()=>startQuestionVoice(q);card.append(form,voice);return card;
}
function renderUnderstood(d){
 $('reviewDetails').hidden=!d.requests.length;$('reviewDetails').open=!!d.clarifications.length;$('reviewCount').textContent=d.requests.length+' producto'+(d.requests.length===1?'':'s');
 $('understood').replaceChildren();
 for(const [i,item] of d.requests.entries()){
  const row=node('article',undefined,'request-row'),top=node('div',undefined,'request-top'),content=node('div');
  top.append(node('span',String(i+1).padStart(2,'0'),'line-number'));content.append(node('strong',item.sourceText,'request-title'));
  const tags=node('div',undefined,'tags');if(item.quantity&&item.unit)tags.append(node('span',item.quantity+' '+item.unit+(item.assumed?' · cantidad orientativa':''),'tag'));
  if(item.constraints.cut)tags.append(node('span',item.constraints.cut,'tag'));
  if(item.constraints.minimumMeatPercent!==null)tags.append(node('span','Mínimo '+item.constraints.minimumMeatPercent+' % de carne','tag'));
  if(item.constraints.species)tags.append(node('span',item.constraints.allowVacuno?'Ternera o vacuno':'Solo '+item.constraints.species,'tag'));
  if(item.status==='needs-clarification')tags.append(node('span','Falta un detalle','tag tag-pending'));
  content.append(tags);top.append(content);row.append(top);
  const chosen=d.rows.find(r=>r.lineId===item.lineId);if(chosen?.selectionBasis==='unit-price'&&chosen.totalCents!==null)row.append(node('p',chosen.store+': '+chosen.name+' · '+money(chosen.unitPriceCents)+'/kg · '+chosen.packs+' envases, '+Number((chosen.packs*chosen.packSize).toFixed(3))+' kg · '+chosen.candidateCount+' opciones válidas revisadas.','helper'));
  const brandLabel=node('label','Marca para este producto','helper'),brandSelect=node('select');brandSelect.setAttribute('aria-label','Marca para '+item.sourceText);
  for(const [value,label] of [['','Preferencia general'],['any','Cualquier marca'],['private','Marca blanca'],['specific','Marca concreta']]){const o=node('option',label);o.value=value;brandSelect.append(o);}
  brandSelect.value=resolutions[item.lineId]?.brandPreference?.mode||'';const brandField=node('input');brandField.placeholder='Nombre de la marca';brandField.maxLength=80;brandField.setAttribute('aria-label','Nombre de marca para '+item.sourceText);brandField.value=resolutions[item.lineId]?.brandPreference?.name||'';brandField.hidden=brandSelect.value!=='specific';
  const applyBrand=node('button','Aplicar marca','text-button');applyBrand.type='button';brandSelect.onchange=()=>{brandField.hidden=brandSelect.value!=='specific';};
  applyBrand.onclick=async()=>{try{if(brandSelect.value==='specific'&&!brandField.value.trim())throw new Error('Escribe la marca que quieres.');resolutions[item.lineId]={...(resolutions[item.lineId]||{})};if(!brandSelect.value)delete resolutions[item.lineId].brandPreference;else resolutions[item.lineId].brandPreference={mode:brandSelect.value,name:brandField.value.trim()};await saveDraft();await compare();}catch(e){fail(e);}};
  const brandDetails=node('details',undefined,'item-options');brandDetails.append(node('summary','Cambiar marca'),brandLabel,brandSelect,brandField,applyBrand);row.append(brandDetails);
  if(item.constraints.brand)tags.append(node('span',item.constraints.brand.mode==='private'?'Marca blanca':item.constraints.brand.mode==='specific'?'Marca: '+item.constraints.brand.name:'Cualquier marca','tag'));
  for(const q of d.clarifications.filter(q=>q.lineId===item.lineId))row.append(questionCard(q));
  const missing=d.pending.find(p=>p.lineId===item.lineId&&p.kind!=='clarification');if(missing)row.append(node('p',missing.reason,'helper'));
  const comparison=d.productComparisons.find(p=>p.item.lineId===item.lineId);if(missing&&comparison?.excluded?.length){const excluded=comparison.excluded[0];row.append(node('p',excluded.store+': '+excluded.reason,'helper'));}
  $('understood').append(row);
 }
}
function lookupText(b){
 const status=b.lookup?.status||'not-queried',cached=b.rows.some(r=>r.totalCents!==null);
 const labels={'not-queried':'Sin consultar esta lista','permission-required':'Falta permitir la consulta',running:'Consultando…',queued:'Consulta pendiente',blocked:'La tienda bloqueó la consulta','location-required':'Hay que preparar la zona en la tienda',failed:'No se pudo completar la consulta','price-unpublished':'Ficha sin precio público verificable','not-supported':'No se localizó una ficha pública',partial:'Consulta parcial',empty:'Sin precios verificados en la consulta',succeeded:'Sin coincidencias en las páginas consultadas'};
 if(b.complete)return 'Cesta completa'+(b.estimatedPrice?' · precio estimado':'')+(status==='not-queried'?' · precios guardados':!['succeeded','partial'].includes(status)?' · '+(labels[status]||'Consulta pendiente'):'');
 return (cached?'Incompleta · subtotal'+(b.estimatedPrice?' estimado':'')+' · ':'')+(labels[status]||'Sin consultar esta lista');
}
function totalLabel(b){return b.totalMinCents==null?null:b.totalMinCents===b.totalMaxCents?money(b.totalMinCents):money(b.totalMinCents)+'–'+money(b.totalMaxCents);}
function deliveryBreakdown(b){
 const box=node('div',undefined,'delivery-breakdown'),q=b.delivery;if(!q)return box;
 const line=(label,value)=>{const p=node('p',undefined,'helper cost-line');p.append(node('span',label+': '),node('span',value));box.append(p);};
 if(b.rows?.some(r=>r.totalCents!==null))line('Productos',money(b.knownSubtotalCents));else box.append(node('p','Productos pendientes de consulta','helper'));
 if(q.mode==='store')box.append(node('p','Sin reparto · compra presencial','helper'));
 else if(q.minCents!==null){
  line('Envío'+(!b.complete?' orientativo':''),(q.minCents===q.maxCents?money(q.minCents):money(q.minCents)+'–'+money(q.maxCents))+(q.extraFeeCents?' + '+money(q.extraFeeCents)+' de bolsas':''));
  if(q.remainingCents>0)box.append(node('p','Pedido mínimo: '+money(q.minimumOrderCents)+' · faltan '+money(q.remainingCents),'helper'));
  if(!b.complete)box.append(node('p','El envío y el total se recalculan al completar la lista.','helper'));
 }else box.append(node('p',q.note,'helper'));
 const details=node('details');details.append(node('summary','Condiciones del envío'));
 details.append(node('p',q.note,'helper'),node('p','Tarifa revisada: '+new Date(q.reviewedAt).toLocaleDateString('es-ES')+'. Cobertura y franja pendientes de confirmar.','helper'));
 for(const url of q.sources||[]){const a=node('a','Ver condiciones en '+b.store);a.href=url;a.target='_blank';a.rel='noopener noreferrer';details.append(a);}
 box.append(details);return box;
}
function renderStoreTable(d){
 if(!d.items.length)return;
 const wrapper=node('details',undefined,'all-stores');wrapper.open=true;wrapper.append(node('summary','Ver precios y opciones de las '+d.baskets.length+' tiendas'));
 const table=node('table',undefined,'store-table'),thead=node('thead'),header=node('tr');header.append(node('th','Supermercado'),node('th','Importe'));thead.append(header);table.append(thead);const tbody=node('tbody');
 for(const b of [...d.baskets].sort((a,b)=>Number(b.complete)-Number(a.complete)||(a.totalMaxCents??Infinity)-(b.totalMaxCents??Infinity)||a.knownSubtotalCents-b.knownSubtotalCents)){
  const tr=node('tr',undefined,b.store===d.winner?.store?'best':''),store=node('td',b.store),cost=node('td',b.rows.some(r=>r.totalCents!==null)?(totalLabel(b)||money(b.knownSubtotalCents))+(b.estimatedPrice?' aprox.':''):'—');store.append(node('small',lookupText(b)));if(b.delivery){if(b.rows.some(r=>r.totalCents!==null)&&(!b.complete||b.totalMinCents===null))cost.append(node('small',b.complete?'Solo productos':'Subtotal'));else if(b.rows.some(r=>r.totalCents!==null))cost.append(node('small',d.fulfillment==='store'?'Solo productos':'Con envío · estimación'));}
  if(b.delivery?.remainingCents>0)cost.append(node('small','Mínimo '+money(b.delivery.minimumOrderCents),'minimum-note'));
  const options=node('details',undefined,'store-details');options.append(node('summary','Ver desglose y opciones'),deliveryBreakdown(b));
  if(b.complete&&!['Lidl','ALDI'].includes(b.store)){const buy=node('button','Preparar cesta en '+b.store,'button button-secondary query-store');buy.type='button';buy.dataset.prepareStore=b.store;buy.onclick=()=>prepareCart(b.store);options.append(buy);}
  if(['Lidl','ALDI'].includes(b.store))store.append(node('small','Alimentación en tienda física; sin cesta online compatible.'));
  if(!['running','queued'].includes(b.lookup?.status)){const retry=node('button',b.lookup?.status==='permission-required'?'Permitir y actualizar precios':'Actualizar precios','text-button query-store');retry.type='button';retry.onclick=()=>searchMissing([b.store]);options.append(retry);}
  if(b.lookup?.errors?.length){const details=node('details',undefined,'lookup-error');details.append(node('summary','Qué ha pasado'),...[...new Set(b.lookup.errors.slice(0,2).map(e=>friendlyIssue(e,b.store)))].map(text=>node('p',text)));options.append(details);}
  store.append(options);tr.append(store,cost);tbody.append(tr);
 }
 table.append(tbody);wrapper.append(table);$('result').append(wrapper);
}
function renderBasket(d){
 let searchCallout=null,splitOption=null;latest=d;step('review');$('listSummary').textContent=d.requests.length+' producto'+(d.requests.length===1?'':'s');$('listEditor').open=false;renderUnderstood(d);$('result').replaceChildren();
 const hasPrices=d.productComparisons.some(p=>p.offers.length),needsSearch=d.coveragePending||!d.comparisonReady||d.pending.some(p=>p.kind==='search'||p.kind==='unverified');
 if(needsSearch&&d.items.length){
  const search=node('div',undefined,'search-callout'),button=node('button','Consultar todos los supermercados','button button-secondary');button.type='button';button.onclick=()=>searchMissing();
  search.append(node('strong','Completa la comparación'),button,node('p','Consultamos las ocho cadenas y te indicamos qué precios hemos podido verificar.'));searchCallout=search;
 }
 if(hasPrices){
  const total=node('div',undefined,'total');total.append(node('small',d.winner?'Menor total de referencia · '+d.winner.store:d.complete&&d.totalMinCents!==null?'Tu compra en '+d.rows[0]?.store:d.complete?'Productos · '+d.rows[0]?.store:'Subtotal disponible · '+d.rows[0]?.store+' · cesta incompleta'),node('strong',(totalLabel(d)||money(d.knownSubtotalCents))+(d.estimatedPrice?' aprox.':'')),node('p',d.complete?(d.fulfillment==='store'?'Compra presencial · solo productos':d.totalMinCents!==null?'Productos y envío estándar · confirma franja y cobertura':'Este importe es solo de productos; no es un total con envío'):'Faltan productos. Este importe no representa toda tu compra.'));
  const breakdown=deliveryBreakdown({...d,store:d.rows[0]?.store}),explanation=breakdown.querySelector('details');if(explanation)explanation.querySelector('summary').textContent='Cómo se ha calculado';total.append(breakdown);if(d.complete&&!d.winner){total.append(node('p','No hay una ganadora clara con estos datos.','helper'));explanation?.append(node('p',d.reason,'helper'));}
  if(d.estimatedPrice)(explanation||total).append(node('p','Incluye productos de peso variable. El importe final puede variar.'));
  if(d.rows.some(r=>r.selectionBasis==='unit-price'))(explanation||total).append(node('p','Carne elegida por el menor €/kg observado en cada tienda. El total incluye los envases necesarios.'));
  const title=total.querySelector('small'),heading=node('div',undefined,'total-heading'),edit=node('button','Editar lista','text-button');edit.type='button';edit.onclick=()=>{$('listEditor').open=true;step('list');reveal($('list'));};title.replaceWith(heading);heading.append(title,edit);
  const primaryStore=d.rows[0]?.store;if(d.complete&&primaryStore&&!['Lidl','ALDI'].includes(primaryStore)){const action=node('button','Preparar cesta en '+primaryStore,'button button-primary');action.dataset.prepareStore=primaryStore;action.onclick=()=>prepareCart(primaryStore);total.append(action);}
  $('result').prepend(total);
  if(d.split?.stores.length>1){const split=node('details',undefined,'split-summary');split.append(node('summary','Repartir entre dos tiendas'),node('strong','En '+d.split.stores.join(' + ')+': '+totalLabel(d.split)+(d.split.estimatedPrice?' aprox.':'')),node('p',d.split.savingsCents>0?'Diferencia observada de '+money(d.split.savingsCents)+' frente a la cesta completa más barata.':'Alternativa repartida entre dos tiendas.'));split.append(node('p',d.fulfillment==='store'?'Solo productos.':'Incluye un envío por tienda. Confirma ambas franjas y coberturas.','helper'));splitOption=split;}
 }else if(!d.clarifications.length)$('result').append(node('p','Todavía no hay precios verificados que cumplan esta lista. Tus productos siguen pendientes.','warning'));
 renderStoreTable(d);if(searchCallout)$('result').append(searchCallout);if(splitOption)$('result').append(splitOption);
 const details=node('details');details.append(node('summary','Ver productos y comprobaciones'));
 for(const comparison of d.productComparisons){
  details.append(node('h3',comparison.item.sourceText));
  for(const offer of comparison.offers)details.append(productCard(offer,true));
  for(const candidate of comparison.unverified){const card=productCard(candidate);card.append(node('p',candidate.reason+' No entra en el total.','warning'));details.append(card);}
  for(const excluded of comparison.excluded||[]){const card=productCard(excluded);card.append(node('p',excluded.reason+' No entra en el total.','warning'));details.append(card);}
  if(!comparison.offers.length&&!comparison.unverified.length)details.append(node('p','Sin una coincidencia verificada para este producto.','helper'));
 }
 if(d.productComparisons.length)$('result').append(details);syncCartActions();
 if(voiceMode){const question=d.clarifications[0];if(question)promptVoice(question.question,question);else{voiceQuestion=null;$('voiceQuestion').hidden=true;speak(d.complete?'La cesta está lista para revisar. Puedes decir preparar cesta en '+d.rows[0].store+'.':'Quedan productos sin precio compatible. Revisa los resultados.');}}
}
function pollProgress(){
 const timer=setInterval(async()=>{try{const p=await call('progress');if(p)message('notice','Consultando tiendas: '+p.done+' de '+p.total+' terminadas.'+(p.active?.length?' Ahora: '+p.active.join(', '):''));}catch{}},1500);
 return ()=>clearInterval(timer);
}
function requirePostcode(){
 if(/^\d{5}$/.test($('postcode').value))return true;
 selectTab('basket');$('listEditor').open=true;document.querySelector('.purchase-settings').open=true;
 message('error','Indica tu código postal para comparar productos y envío.');reveal($('postcode'));return false;
}
async function compare(){
 if(!$('brandMode').value){message('error','Elige si prefieres cualquier marca, marca blanca o una marca concreta.');if(voiceMode)promptVoice('¿Qué marcas prefieres? Puedes responder: cualquier marca, marca blanca o marca seguida de su nombre.',{field:'global-brand'});reveal(document.querySelector('.brand-choice'));return;}
 if($('brandMode').value==='specific'&&!$('brandName').value.trim()){message('error','Escribe el nombre de la marca.');$('brandName').focus();return;}
 if(!requirePostcode())return;
 if(busy||dictation?.isActive())return;working(true);message('error','');message('notice','Revisando la lista y los supermercados permitidos…');const stop=pollProgress();
 try{const d=await call('compare',input());await saveDraft();renderBasket(d);reveal(d.clarifications.length?$('reviewDetails'):$('result'));message('notice',d.searchInfo?'Consulta terminada en '+d.searchInfo.stores.length+' tiendas. Revisa el estado de cada supermercado.':'Lista revisada. Puedes consultar más tiendas desde el resultado.');}
 catch(e){fail(e);}finally{stop();working(false);}
}
async function searchMissing(stores=RETAILERS.map(r=>r.name)){
 if(busy||dictation?.isActive())return;message('error','');let stop=()=>{};
 try{
  const configs=RETAILERS.filter(r=>stores.includes(r.name)),origins=configs.flatMap(r=>r.origins.map(o=>o+'/*'));
  if(!await chrome.permissions.request({origins}))throw new Error('No has permitido consultar esas tiendas. Puedes seguir usando los precios guardados.');
  working(true);stop=pollProgress();message('notice','Consultando las tiendas seleccionadas. Se mantienen todos tus requisitos.');
  const result=await call('search',{...input(),stores});renderBasket(result.comparison);reveal(result.comparison.clarifications.length?$('reviewDetails'):$('result'));
  message('notice','Consulta terminada: '+result.runs.filter(r=>r.status!=='permission-required').length+' tiendas consultadas y '+result.observationCount+' fichas revisadas. El estado de cada tienda aparece en la tabla.');
 }catch(e){fail(e);}finally{stop();working(false);}
}


async function loadCatalog(){const d=await call('catalog',{query:$('query').value});$('catalogCount').textContent=d.count+' productos guardados · '+d.stores.filter(s=>s.products>0).length+' cadenas';$('products').replaceChildren(...d.products.map(p=>productCard(p)));if(!d.products.length){const empty=node('div',undefined,'empty-state');empty.append(node('strong','No encontramos ese producto'),node('p','Prueba otra palabra o búscalo desde tu lista para consultar las tiendas.'));$('products').append(empty);}}
async function updateStore(store){
 if(busy||!requirePostcode())return;message('error','');
 try{const configs=store==='all'?RETAILERS:RETAILERS.filter(r=>r.name===store),origins=configs.flatMap(r=>r.origins.map(o=>o+'/*'));if(!await chrome.permissions.request({origins}))throw new Error('No has permitido el acceso a esas tiendas.');
  working(true);message('notice','Consultando '+(store==='all'?'los supermercados':store)+'. Las pestañas temporales se cerrarán al terminar.');
  const d=await call('refresh',{store,postcode:$('postcode').value});await loadStatus();const pending=d.runs.filter(r=>r.status!=='succeeded').length;message('notice',d.run.observationCount+' precios revisados en '+d.runs.length+' tiendas.'+(pending?' '+pending+' necesitan revisión. Consulta el estado de cada tienda.':''));
 }catch(e){fail(e);}finally{working(false);}
}
async function loadStatus(){
 const d=await call('status');$('automatic').checked=d.automatic;$('status').textContent=d.count+' productos guardados · '+d.stores.filter(s=>s.products>0).length+' tiendas con datos';$('sourcesList').replaceChildren();
 for(const s of d.stores){const card=node('article',undefined,'sourcecard'),head=node('div',undefined,'source-heading'),name=node('strong',s.store),dot=node('span',undefined,'source-dot'+(s.products?' has-data':''));dot.setAttribute('aria-hidden','true');name.prepend(dot);head.append(name,node('span',s.products+' productos','count'));
  card.append(head,node('p',s.lastRun?'Última consulta: '+date(s.lastRun.finishedAt):'Sin precios validados todavía.'));
  if(s.lastRun)card.append(node('p',s.status==='succeeded'?'Consulta completada · '+(s.lastRun.pages?.length||0)+((s.lastRun.pages?.length||0)===1?' página revisada':' páginas revisadas'):s.lastRun.errors?.length?friendlyIssue(s.lastRun.errors[0],s.store):'Consulta sin precios nuevos verificados.','helper'));
  const actions=node('div',undefined,'store-actions'),button=node('button','Actualizar','button button-small');button.onclick=()=>updateStore(s.store);actions.append(button);
  if(s.mode==='browser'){const open=node('button','Elegir zona en la tienda','text-button');open.onclick=()=>chrome.tabs.create({url:RETAILERS.find(r=>r.name===s.store).pages[0],active:true});actions.append(open);}card.append(actions);
  if(['failed','partial'].includes(s.status))card.append(node('p','La última consulta quedó incompleta. Revisa los detalles al actualizar.','helper'));
  $('sourcesList').append(card);
 }
}
function selectTab(id){if(id!=='basket')dictation?.stop();for(const button of document.querySelectorAll('[data-tab]')){const active=button.dataset.tab===id;button.setAttribute('aria-selected',String(active));button.tabIndex=active?0:-1;$(button.dataset.tab).hidden=!active;}message('error','');if(id==='catalog')loadCatalog().catch(fail);if(id==='sources')loadStatus().catch(fail);$(id).scrollIntoView?.({block:'start',behavior:'auto'});}
for(const [index,button] of [...document.querySelectorAll('[data-tab]')].entries()){
 button.onclick=()=>selectTab(button.dataset.tab);
 button.onkeydown=e=>{const buttons=[...document.querySelectorAll('[data-tab]')],keys={ArrowRight:(index+1)%3,ArrowLeft:(index+2)%3,Home:0,End:2};if(e.key in keys){e.preventDefault();const target=buttons[keys[e.key]];selectTab(target.dataset.tab);target.focus();}};
}
document.querySelector('.brand').onclick=e=>{e.preventDefault();selectTab('basket');};
$('example').onclick=()=>{$('list').value='1 kg de ternera picada, mínimo 97 % de carne\n6 litros de leche entera\n12 huevos M';resolutions={};$('list').dispatchEvent(new Event('input'));$('list').focus();};
$('list').oninput=()=>{const keys=new Set(splitShoppingList($('list').value).map(requestKey));resolutions=Object.fromEntries(Object.entries(resolutions).filter(([key])=>keys.has(key)));latest=null;clearVoiceQuestion();message('error','');step('list');$('reviewDetails').hidden=true;$('understood').replaceChildren();$('result').replaceChildren(node('p','Lista modificada. Pulsa «Revisar y comparar» para actualizar el resultado.','helper'));scheduleSave();};
$('postcode').oninput=()=>{optionsSummary();scheduleSave();};$('fulfillment').onchange=()=>{optionsSummary();scheduleSave();if(latest)compare().catch(fail);};$('maxStores').onchange=()=>{optionsSummary();scheduleSave();};
document.querySelector('.brand').onclick=e=>{e.preventDefault();selectTab('basket');$('listEditor').open=true;reveal($('list'));};
$('listEditor').ontoggle=()=>{if($('listEditor').open&&document.activeElement===$('listEditor').querySelector('summary'))$('list').focus();};
$('form').onsubmit=e=>{e.preventDefault();compare();};
let queryTimer;$('query').oninput=()=>{clearTimeout(queryTimer);queryTimer=setTimeout(()=>loadCatalog().catch(fail),200);};
$('refresh').onclick=()=>updateStore('all');
$('automatic').onchange=async()=>{try{await call('automatic',{enabled:$('automatic').checked});message('notice',$('automatic').checked?'Actualización en lote cada 15 minutos con Chrome abierto.':'Actualización automática desactivada.');}catch(e){$('automatic').checked=false;fail(e);}};
async function initialize(){const [draft,status]=await Promise.all([call('draft'),call('status')]);if(draft){$('fulfillment').value=draft.fulfillment==='store'?'store':'delivery';$('list').value=draft.text;resolutions=draft.resolutions||{};$('postcode').value=draft.postcode||status.postcode;$('maxStores').value=draft.maxStores===1?'1':'2';$('brandMode').value=draft.brandPreference?.mode||'';$('brandName').value=draft.brandPreference?.name||'';}else $('postcode').value=status.postcode;showBrandName();optionsSummary();await loadStatus();refreshCart().catch(()=>{});if(new URL(location.href).searchParams.get('voice')==='1'){history.replaceState(null,'',location.pathname);voiceMode=true;dictation.start?.();}}
dictation=setupDictation({environment:window,button:$('dictate'),status:$('voiceStatus'),textarea:$('list'),onChange:()=>$('list').dispatchEvent(new Event('input')),onState:active=>{if(active)$('listEditor').open=true;$('compare').disabled=active||busy;document.querySelector('.voice-box').classList.toggle('listening',active);},onTranscript:handleVoice,onSessionEnd:({error})=>{const action=voiceAction;voiceAction=null;if(action&&!error)Promise.resolve().then(action).catch(fail);},beforeStart:async()=>{
 voiceMode=true;window.speechSynthesis?.cancel();
 let permission;try{permission=await navigator.permissions.query({name:'microphone'});}catch{}
 if(permission?.state==='granted')return true;
 await saveDraft();await chrome.tabs.create({url:chrome.runtime.getURL('microphone.html'),active:true});
 message('voiceStatus','Permite el micrófono en la pestaña abierta. Tu lista continuará allí.');return false;
}});
function showBrandName(){const specific=$('brandMode').value==='specific';$('brandName').hidden=!specific;$('brandNameLabel').hidden=!specific;$('brandName').required=specific;for(const b of document.querySelectorAll('[data-brand]'))b.setAttribute('aria-pressed',String(b.dataset.brand===$('brandMode').value));}
function brandChanged(){showBrandName();clearVoiceQuestion();message('error','');$('reviewDetails').hidden=true;$('understood').replaceChildren();$('result').replaceChildren(node('p','Preferencia de marca modificada. Pulsa «Revisar y comparar».','helper'));scheduleSave();}
$('brandMode').onchange=brandChanged;$('brandName').oninput=brandChanged;
for(const b of document.querySelectorAll('[data-brand]'))b.onclick=()=>{$('brandMode').value=b.dataset.brand;brandChanged();if(b.dataset.brand==='specific')$('brandName').focus();};
let cartTimer;
function optionsSummary(){$('optionsSummary').textContent=($('postcode').value||'Indica tu código postal')+' · '+($('maxStores').value==='1'?'Una tienda':'Hasta 2 tiendas')+' · '+($('fulfillment').value==='delivery'?'Con envío':'Presencial');}
function speak(text){if(!voiceMode||!$('readQuestions').checked||!window.speechSynthesis||!window.SpeechSynthesisUtterance)return;window.speechSynthesis.cancel();const utterance=new window.SpeechSynthesisUtterance(text);utterance.lang='es-ES';window.speechSynthesis.speak(utterance);}
function promptVoice(text,question){$('listEditor').open=true;voiceQuestion=question;$('voiceQuestionText').textContent=text;$('voiceQuestion').hidden=false;message('voiceStatus',text);reveal($('voiceReply'));speak(text);}
function clearVoiceQuestion(){voiceQuestion=null;$('voiceQuestion').hidden=true;}
function queueVoice(action){if(voiceAction)return;voiceAction=action;dictation.stop('',{discardPending:true});}
function startQuestionVoice(question){if(busy)return;if(!dictation.start){fail(new Error('El reconocimiento de voz no está disponible. Puedes responder con los botones.'));return;}voiceQuestion=question;voiceMode=true;window.speechSynthesis?.cancel();dictation.start();}
$('voiceReply').onclick=()=>startQuestionVoice(voiceQuestion);
function handleVoice(text){
 const intent=parseVoiceIntent(text);
 if(intent.type==='stop'){voiceAction=null;dictation.stop('',{discardPending:true});return true;}
 if(intent.type==='compare'){voiceQuestion=null;queueVoice(compare);return true;}
 if(intent.type==='undo'){const lines=splitShoppingList($('list').value);lines.pop();$('list').value=lines.join('\n');$('list').dispatchEvent(new Event('input'));message('voiceStatus','Último producto retirado. Puedes seguir dictando.');return true;}
 if(intent.type==='brand'){
  const wasQuestion=voiceQuestion?.field==='global-brand';$('brandMode').value=intent.value.mode;$('brandName').value=intent.value.name||'';brandChanged();message('error','');voiceQuestion=null;$('voiceQuestion').hidden=true;
  if(wasQuestion)queueVoice(compare);else message('voiceStatus','Preferencia de marca guardada. Puedes seguir dictando o decir «comparar».');return true;
 }
 if(intent.type==='store'){voiceQuestion=null;queueVoice(()=>prepareCart(intent.value,{fromVoice:true}));return true;}
 if(voiceQuestion){
  const q=voiceQuestion;
  if(q.field==='global-brand'){message('voiceStatus','Di «cualquier marca», «marca blanca» o «marca Pascual», por ejemplo.');return true;}
  queueVoice(()=>{
   const field=$(q.lineId+'-'+q.field);if(!field)throw new Error('La pregunta ha cambiado. Revisa la lista.');
   const numbers={un:'1',uno:'1',una:'1',dos:'2',tres:'3',cuatro:'4',cinco:'5',seis:'6',siete:'7',ocho:'8',nueve:'9',diez:'10',once:'11',doce:'12',medio:'0.5'};
   field.value=q.field==='quantity'?normalizeText(text).replace(/[.!?]+$/,'').replace(/\b(un|uno|una|dos|tres|cuatro|cinco|seis|siete|ocho|nueve|diez|once|doce|medio)\b/g,w=>numbers[w]):text.replace(/[.!?]+$/,'');
   field.closest('form').dispatchEvent(new Event('submit',{bubbles:true,cancelable:true}));
  });return true;
 }
 return false;
}
function syncCartActions(){for(const button of document.querySelectorAll('[data-prepare-store]'))button.hidden=cartInProgress;}
function renderCart(job){
 cartInProgress=!!job&&['running','paused','ready'].includes(job.status);syncCartActions();
 const area=$('cartProgress');area.hidden=!job;if(!job)return;step('shop');area.dataset.state=job.status;const done=(job.rows||[]).filter(r=>r.status==='done').length,head=node('div',undefined,'cart-heading');head.append(node('strong',job.status==='complete'?'Cesta preparada en '+job.store:'Tu cesta en '+job.store),node('span',job.status==='paused'?(job.pauseCode==='session'?'Esperando tu acceso':job.pauseCode==='intervention'?'Esperando el aviso de la tienda':'Necesita tu atención'):job.status==='complete'?'Preparada':job.status==='cancelled'?'Detenida':'En curso','cart-status'));area.replaceChildren(head,node('p',job.status==='paused'&&!['session','intervention'].includes(job.pauseCode)?friendlyIssue(job.message,job.store):job.message,'cart-message'));
 if(job.status==='running'){const progress=node('progress');progress.max=job.rows?.length||1;progress.value=done;progress.setAttribute('aria-label','Productos preparados');area.append(progress);}
 area.append(node('p',done+' de '+(job.rows?.length||0)+' productos preparados','helper'));
 if(job.status==='complete'&&Number.isInteger(job.verifiedSubtotalCents)){
  area.append(node('strong','Productos de tu lista: '+money(job.verifiedSubtotalCents)));
  if(Number.isInteger(job.quotedSubtotalCents)&&job.verifiedSubtotalCents!==job.quotedSubtotalCents)area.append(node('p','El precio actual de las fichas ha cambiado respecto a la comparación. Revisa las promociones y el total del carrito.','helper'));
 }
 const actions=node('div',undefined,'cart-actions'),open=node('button','Abrir '+job.store,'button button-primary');open.onclick=async()=>{try{renderCart(await call('cart-open'));}catch(e){fail(e);}};actions.append(open);
 if(job.status==='paused'||job.status==='ready'){const resume=node('button','Ya está, continuar','button button-secondary');resume.onclick=async()=>{try{renderCart(await call('cart-resume'));watchCart();}catch(e){fail(e);}};actions.append(resume);}area.append(actions);
 const detail=node('details');detail.append(node('summary','Ver productos'));for(const row of job.rows||[])detail.append(node('p',(row.status==='done'?'✓ ':row.status==='unavailable'?'Agotado: ':'Pendiente: ')+row.name+' · '+row.cartUnits+' unidades'+(Number.isInteger(row.initialCount)?' · había '+row.initialCount:'')+(Number.isInteger(row.finalCount)?' · ahora '+row.finalCount:'')));area.append(detail);
 if(!['complete','cancelled'].includes(job.status)){const cancel=node('button','Detener preparación','text-button cart-cancel');cancel.onclick=async()=>{try{renderCart(await call('cart-cancel'));clearInterval(cartTimer);}catch(e){fail(e);}};area.append(cancel);}
 if(job.status==='complete'){const again=node('button','Volver a comprobar cantidades','text-button');again.onclick=()=>prepareCart(job.store,{newPurchase:true});area.append(again);}
}
async function refreshCart(){const job=await call('cart-status');renderCart(job);if(job?.status==='running'||job?.status==='paused'&&['session','intervention'].includes(job.pauseCode))watchCart();else clearInterval(cartTimer);}
function watchCart(){clearInterval(cartTimer);cartTimer=setInterval(()=>refreshCart().catch(fail),1500);}
async function prepareCart(store,{fromVoice=false,newPurchase=false}={}){
 if(busy)return;const request={...input(),store,newPurchase},area=$('cartProgress');working(true);message('error','');area.hidden=false;area.dataset.state='running';area.replaceChildren(node('strong','Abriendo '+store+'…'),node('p','Preparando los productos de tu lista.'));reveal(area);
 try{const config=RETAILERS.find(r=>r.name===store);if(!config)throw new Error('Tienda no disponible.');const origins=config.origins.map(o=>o+'/*'),permitted=await chrome.permissions.contains?.({origins});
 if(!permitted&&fromVoice){area.replaceChildren(node('strong','Permite el acceso a '+store),node('p','Chrome necesita un clic para conceder este permiso la primera vez.'));const grant=node('button','Permitir y preparar cesta','button button-primary');grant.onclick=()=>prepareCart(store);area.append(grant);speak('Pulsa permitir y preparar cesta para autorizar esta tienda.');return;}
 if(!permitted&&!await chrome.permissions.request({origins}))throw new Error('Permite el acceso a la tienda para preparar la cesta.');
 const job=await call('cart-start',request);renderCart(job);watchCart();reveal(area);
 }catch(e){area.dataset.state='paused';area.replaceChildren(node('strong','No se ha podido preparar la cesta'),node('p',friendlyIssue(e,store)));const retry=node('button','Volver a intentarlo','button button-secondary');retry.onclick=()=>prepareCart(store,{newPurchase});area.append(retry);
  if(/nueva comparación elige otros productos/.test(e.message)){const stop=node('button','Detener preparación anterior','text-button');stop.onclick=async()=>{try{renderCart(await call('cart-cancel'));message('notice','Preparación detenida. Lo ya añadido permanece en la tienda: revísalo antes de preparar la nueva selección.');}catch(error){fail(error);}};area.append(stop);}
  fail(e);}finally{working(false);}
}
window.addEventListener('pagehide',()=>{clearInterval(cartTimer);window.speechSynthesis?.cancel();});
$('readUsage').onclick=async()=>{
 const button=$('readUsage'),area=$('resourceStats');button.disabled=true;
 try{const d=await call('resource-usage'),bytes=n=>n==null?'No disponible':(n/1048576).toLocaleString('es-ES',{maximumFractionDigits:2})+' MiB';
  area.replaceChildren(node('p','Almacenamiento local: '+bytes(d.storageBytes)),node('p','Peticiones HTTP: '+d.httpRequests+' · respuestas con fallo o errores de red: '+d.httpFailures),node('p','Texto recibido por el recolector: '+bytes(d.decodedBytes)),node('p','Páginas de consulta abiertas: '+d.browserPages+' · máximo simultáneo registrado: '+d.peakBrowserPages));
  for(const q of d.recent||[])area.append(node('p',({compare:'Comparación',search:'Búsqueda',refresh:'Actualización',automatic:'Actualización automática'})[q.operation]+': '+(q.durationMs/1000).toLocaleString('es-ES',{maximumFractionDigits:1})+' s · '+(q.ok?'finalizada':'interrumpida'),'helper'));
  area.append(node('p','No incluye imágenes, vídeos, scripts ni otras descargas de las pestañas. Estas cifras no representan el tráfico total. CPU y RAM: abre el administrador de tareas de Chrome con Mayús + Esc y revisa Cesta Clara junto con las pestañas de consulta.','helper'));
 }catch(e){area.replaceChildren(node('p',friendlyIssue(e)));}finally{button.disabled=false;}
};
$('diagnostic').onclick=async()=>{try{const data=await call('diagnostics'),url=URL.createObjectURL(new Blob([JSON.stringify(data,null,2)],{type:'application/json'})),link=node('a');link.href=url;link.download='cesta-clara-diagnostico.json';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);message('notice','Diagnóstico guardado. No incluye tu lista, cuentas ni direcciones.');}catch(e){fail(e);}};
$('clearData').onclick=()=>{$('clearDataConfirm').hidden=false;$('confirmClearData').focus();};
$('cancelClearData').onclick=()=>{$('clearDataConfirm').hidden=true;$('clearData').focus();};
$('confirmClearData').onclick=async()=>{
 clearTimeout(draftTimer);clearTimeout(queryTimer);clearInterval(cartTimer);voiceAction=null;dictation?.stop('',{discardPending:true});window.speechSynthesis?.cancel();working(true);
 try{await call('clear-data',{confirmed:true});message('notice','Datos locales borrados. Abre Cesta Clara de nuevo desde su icono.');}
 catch(e){working(false);fail(e);refreshCart().catch(()=>{});}
};
initialize().catch(fail);
