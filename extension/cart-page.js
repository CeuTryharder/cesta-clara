// This function is serialized by Chrome and runs without module bindings in the merchant page.
export function cartPageStep(item,action='read'){
 const norm=s=>String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/\s+/g,' ').trim();
 const visible=element=>{
  if(!element||element.hidden||element.closest('[hidden]')||!element.getClientRects().length)return false;
  for(let node=element;node;node=node.parentElement){const style=node.ownerDocument.defaultView?.getComputedStyle(node);if(style?.display==='none'||style?.visibility==='hidden'||style?.visibility==='collapse'||style?.opacity==='0')return false;}
  return true;
 };
 const expected=new URL(item.productUrl),current=new URL(location.href);
 if(expected.origin!==current.origin||expected.pathname.replace(/\/$/,'')!==current.pathname.replace(/\/$/,''))return {state:'loading',reason:'La ficha está cambiando. Si la tienda pide acceso o zona, complétalos y pulsa Continuar.'};
 const label=element=>norm(element.getAttribute('aria-label')||element.textContent);
 const wanted=norm(item.name),words=wanted.split(/[^a-z0-9]+/).filter(word=>word.length>2);
 const score=heading=>words.length?words.filter(word=>norm(heading.textContent).includes(word)).length/words.length:0;
 const headings=[...document.querySelectorAll('h1')].filter(visible).sort((a,b)=>score(b)-score(a));
 const heading=headings.find(h=>score(h)>=.7);
 const modal=[...document.querySelectorAll('[role="dialog"],[aria-modal="true"],#modal,#onetrust-banner-sdk')].find(element=>visible(element)&&!element.contains(heading));
 const postal=[...document.querySelectorAll('[data-test-id="postal-code-modal-input"]')].find(visible);
 if(postal)return {state:'paused',code:'intervention',reason:'Elige tu código postal en DIA. Cuando cierres el aviso, comprobaré la cantidad y continuaré con los demás productos.'};
 if(modal){const session=/inicia(?:r)? sesion|identificate|accede a tu cuenta/.test(norm(modal.textContent));return {state:'paused',code:session?'session':'intervention',reason:session?'Termina de iniciar sesión en la tienda. Comprobaré el primer producto y continuaré con los pendientes.':'Resuelve el aviso o las cookies en la tienda. Continuaré automáticamente cuando vuelvan a estar disponibles los controles.'};}
 if(!heading)return {state:'loading',reason:headings.length?'La ficha no coincide todavía con el producto previsto. Revisa la selección en la tienda.':'Esperando el título del producto.'};
 if(action==='open-cart'){
  const cartButtons=[...document.querySelectorAll('button')].filter(e=>visible(e)&&!e.disabled&&/^(mostrar carro|ver carrito|ver cesta|mi carrito)$/.test(label(e)));
  if(cartButtons.length===1){cartButtons[0].click();return {state:'opened'};}
  return {state:'paused',reason:'Abre el carrito desde la cabecera de la tienda.'};
 }
 // Alcampo requires an account even when its public product page shows Añadir.
 // Pause before issuing a write, instead of waiting for a rejected add forever.
 if(expected.hostname==='www.compraonline.alcampo.es'&&[...document.querySelectorAll('button')].some(e=>visible(e)&&label(e)==='iniciar sesion'))return {state:'paused',code:'session',reason:'Inicia sesión en Alcampo y elige tu zona de entrega. Continuaré al volver a la ficha o al carrito.'};
 const isAdd=element=>/^(anadir|agregar|add to (?:cart|basket))(?:\b|$)/.test(label(element))&&!/lista|favorit/.test(label(element));
 const isMinus=element=>/quitar|reducir|disminuir|restar|remove|decrease|minus/.test(label(element))||label(element)==='-'||label(element)==='−';
 const isPlus=element=>/aumentar|incrementar|mas unidades|increase|plus|anadir (?:un[ao]?|\d+) unidades?|add (?:one|\d+) units? (?:to )?(?:cart|basket)/.test(label(element))||label(element)==='+';
 let root=heading.closest('.primary-information,cmp-product-info,.private-product-detail__right');
 if(!root){
  root=heading.parentElement;
  for(let n=0;n<5&&root.parentElement&&![...root.querySelectorAll('button')].some(e=>visible(e)&&(isAdd(e)||isMinus(e)||isPlus(e)));n++)root=root.parentElement;
 }
 if(!root||root===document.body||root.querySelectorAll('h1').length>1)return {state:'loading',reason:'Esperando los controles del producto.'};
 let controls=[...root.querySelectorAll('button')].filter(visible);
 if(controls.some(e=>/^(agotado|sin stock|no disponible)$/.test(norm(e.textContent))))return {state:'paused',code:'out-of-stock',reason:'La tienda indica que '+item.name+' está agotado.'};
 const title=norm(heading.textContent);
 const enabled=e=>e&&!e.disabled&&e.getAttribute('aria-disabled')!=='true'&&!e.closest('[aria-busy="true"]');
 // The same product may expose a page control and a responsive sticky copy.
 // Keep the complete product boundary, including its quantity counter.
 const copies=list=>{const named=list.filter(e=>label(e).includes(title)),candidates=named.length?named:list;
  if(candidates.length>1&&!named.length&&candidates.some(e=>isAdd(e)&&!isPlus(e)))return candidates;
  if(new Set(candidates.map(label)).size>1)return candidates;
  const onscreen=e=>{const r=e.getBoundingClientRect(),v=e.ownerDocument.defaultView;return r.top>=0&&r.bottom<=(v?.innerHeight||0);};
  return candidates.sort((a,b)=>Number(enabled(b))-Number(enabled(a))||Number(onscreen(b))-Number(onscreen(a))).slice(0,1);
 };
 const minus=copies(controls.filter(isMinus)),plus=copies(controls.filter(isPlus)),initial=copies(controls.filter(e=>isAdd(e)&&!isPlus(e)));
 const inputs=[...root.querySelectorAll('input')].filter(e=>visible(e)&&(e.type==='number'||e.getAttribute('data-test-id')==='add2cart-mix-button-input'||/quantity|cantidad|unidades|^add to cart input$/.test(norm(e.getAttribute('aria-label')||e.name)))),input=inputs[0];
 const numeric=value=>/^\d+(?:\s*(?:ud\.?|uds\.?|unidades?))?$/.test(String(value||'').trim())?parseInt(value,10):null;
 let count=null;
 if(minus.length===1){
  if(new Set(inputs.map(e=>e.value)).size>1)return {state:'loading',reason:'Esperando a que se sincronicen los contadores del producto.'};
  count=numeric(input?.value);
  if(count===null){
   const quantityNodes=[...root.querySelectorAll('[data-testid="product-feedback__quantity"],[data-test-id*="quantity"],[data-test*="quantity"],output,[aria-live],span')].filter(visible);
   const values=[...new Set(quantityNodes.map(e=>numeric(e.textContent)).filter(value=>value!==null))];
   if(values.length===1)count=values[0];
  }
 }
 // A disabled minus is still evidence of an existing cart line. Never reinterpret
 // a temporarily disabled control as an empty cart while the request is pending.
 if(count===null&&!minus.length&&!plus.length&&initial.length===1)count=0;
 const add=count===0&&!minus.length&&initial.length===1?initial[0]:plus.length===1?plus[0]:minus.length===1&&initial.length===1?initial[0]:null;
 if(count===null)return {state:'loading',reason:'No se puede comprobar aún la cantidad de este producto en la cesta. Revisa el contador en la tienda.'};
 const cartLink=[...document.querySelectorAll('a[href]')].map(a=>{try{return new URL(a.href);}catch{return null;}}).find(u=>u?.origin===expected.origin&&/^\/(?:cart|basket|carrito|cesta|MiCarrito)\/?$/i.test(u.pathname));
 const priceNodes=[...root.querySelectorAll('[data-test-id="buy-box-active-price"],[data-test="product-price"]')].filter(visible);
 const prices=[...new Set(priceNodes.map(e=>{const match=e.textContent.match(/(\d+(?:[.,]\d{3})*[,.]\d{2})\s*€/);return match?Math.round(Number(match[1].replace(/\.(?=\d{3})/g,'').replace(',','.'))*100):null;}).filter(v=>v>0))];
 const result={state:'ready',count,cartUrl:cartLink?.href||null,...(prices.length===1?{priceCents:prices[0]}:{})};
 const change=count>item.target&&Number.isInteger(item.target)?minus[0]:add;
 if(action==='read'&&!enabled(change)&&count!==item.target)return {...result,state:'loading',reason:'Esperando a que la tienda habilite el control de este producto.'};
 if(action==='add'||action==='remove'){
  const button=action==='remove'&&minus.length===1?minus[0]:action==='add'?add:null;
  if(count!==item.expectedCount)return {...result,state:'paused',reason:'La cantidad cambió mientras se preparaba la cesta. Revísala para evitar duplicados.'};
  if(!enabled(button))return {...result,state:'loading',reason:'Esperando a que la tienda habilite el control de cantidad.'};
  button.scrollIntoView?.({block:'center',inline:'nearest',behavior:'instant'});
  const rect=button.getBoundingClientRect(),hit=document.elementFromPoint?.(rect.x+rect.width/2,rect.y+rect.height/2);
  if(hit&&!button.contains(hit))return {...result,state:'paused',code:'intervention',reason:'Hay un aviso delante del botón. Resuélvelo en la tienda; comprobaré de nuevo el producto antes de continuar.'};
  button.click();return {...result,state:'clicked'};
 }
 return result;
}
