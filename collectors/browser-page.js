// Runs only on allowlisted public product/category pages. No account or cart fields.
export function readRetailPage(store){
 const text=e=>e?.textContent?.replace(/\s+/g,' ').trim()||'',cents=s=>{const m=s.match(/(\d+(?:[.,]\d{2}))\s*€/);return m?Math.round(Number(m[1].replace(',','.'))*100):null;},rows=[];
 const ingredients=root=>{
  if(!root)return null;const explicit=root.querySelector('.feature-text-ingredients .text,[data-test="ingredients"],.product-ingredients,.ingredients');
  if(explicit)return text(explicit).slice(0,5000);
  for(const h of root.querySelectorAll('h2,h3,h4,dt,summary,strong'))if(/^Ingredientes\s*:?\s*$/i.test(text(h))){const next=h.nextElementSibling;if(next&&!/nutricional/i.test(text(next)))return text(next).slice(0,5000);}
  return null;
 };
 if(store==='Mercadona'){
  const h=[...document.querySelectorAll('h1.private-product-detail__description')].at(-1)||document.querySelector('h1'),area=h?.parentElement,detail=h?.closest('.private-product-detail'),label=detail?.querySelector('[aria-label*="Ingredientes:"]')?.getAttribute('aria-label')||'',composition=label.match(/Ingredientes:\s*([\s\S]*?)(?:\.\s*Al[eé]rgenos:|\.\s*Instrucciones|$)/i)?.[1]||null;
  const price=text(area?.querySelector('.product-price__unit-price')),format=[...(area?.querySelectorAll('.product-format span[aria-hidden="true"]')||[])].map(text).join(' ').split('|')[0];
  if(h&&cents(price))rows.push({id:location.pathname.match(/\/product\/(\d+)/)?.[1],name:text(h),brand:/Hacendado/.test(text(h))?'Hacendado':'',priceCents:cents(price),quantityText:format,ingredients:composition,productUrl:location.href,availability:/agotado|no disponible/i.test(text(detail?.querySelector('.product-detail__availability')))?'unavailable':'unknown',conditionalPrice:false});
 }else if(store==='Carrefour'){
  const h=document.querySelector('h1.product-header__name');
  if(h){
   const price=text(document.querySelector('.buybox__price')),packText=text(document.querySelector('.buybox__price-per-unit'));let ld;
   for(const script of document.querySelectorAll('script[type="application/ld+json"]')){try{const v=JSON.parse(script.textContent);if(v['@type']==='Product'&&v.name===text(h))ld=v;}catch{}}
   if(cents(price)){const offer=Array.isArray(ld?.offers)?ld.offers[0]:ld?.offers,pack=packText.match(/(\d+[,.]\d{2})\s*€\s*\/\s*(\d+)\s*uds?/i),minimum=pack?Number(pack[2]):1;
    if(offer?.price!==undefined&&Math.round(Number(offer.price)*100)!==cents(price))return {rows:[],reason:'El precio visible y el estructurado no coinciden.'};
    const area=document.querySelector('.buybox')||h.parentElement;rows.push({id:ld?.sku||location.pathname.match(/\/R-([^/]+)/)?.[1],name:text(h),brand:ld?.brand?.name,ean:ld?.gtin13,priceCents:cents(price),quantityText:text(h).replace(/\.$/,''),minimumPurchaseUnits:minimum,ingredients:ingredients(document.querySelector('.product-info')||document.querySelector('main')),productUrl:location.href,availability:/agotado|no disponible/i.test(text(area))?'unavailable':'unknown',conditionalPrice:/3x2|2ª|cup[oó]n/i.test(text(area))});
   }
  }else for(const card of document.querySelectorAll('.product-card__parent')){
   const link=card.querySelector('.product-card__title-link'),price=text(card.querySelector('.product-card__price'));if(!link||!cents(price))continue;
   rows.push({id:link.href.match(/\/R-([^/]+)/)?.[1],name:text(link),priceCents:cents(price),quantityText:text(link),productUrl:link.href,conditionalPrice:/3x2|2ª|cup[oó]n/i.test(text(card.querySelector('.product-card__badges'))),availability:/agotado|no disponible/i.test(text(card))?'unavailable':'unknown'});
   if(rows.length>=60)break;
  }
 }else if(store==='Alcampo'){
  for(const body of document.querySelectorAll('[data-test="fop-body"]')){
   const link=body.querySelector('a[href*="/products/"]'),price=text(body.querySelector('[data-test="fop-price"]')),size=body.querySelector('[data-test="fop-size"]'),quantityText=text(size?.firstElementChild),name=text(body.querySelector('[data-test="fop-title"]'));
   if(!link||!name||!cents(price))continue;
   rows.push({id:link.href.split('/').at(-1),name,brand:name.split(' ')[0],priceCents:cents(price),quantityText,productUrl:link.href,estimatedPrice:/aprox|peso variable/i.test(text(body)),availability:/agotado|sin alternativas/i.test(text(body)+' '+[...body.querySelectorAll('button')].map(b=>b.getAttribute('aria-label')||'').join(' '))?'unavailable':'unknown',conditionalPrice:/club|3x2|2ª|segunda|cup[oó]n/i.test(text(body.querySelector('.promotion-container')))});
   if(rows.length>=60)break;
  }
 }else if(store==='Consum'){
  const h=document.querySelector('h1'),root=h?.closest('cmp-product-info');
  if(h&&root){
   const price=text(root.querySelector('.product-info-price__price')),name=text(h);
   if(cents(price))rows.push({id:location.pathname.match(/\/es\/p\/[^/]+\/(\d+)/)?.[1],name,brand:text(root.querySelector('.brand-link')),priceCents:cents(price),quantityText:name,productUrl:location.href,ingredients:ingredients(document.querySelector('.product-detail')),estimatedPrice:/aprox|al peso/i.test(name),conditionalPrice:/2ª|3x2|cup[oó]n/i.test(text(root.querySelector('[class*="promotion"]'))),availability:/agotado|no disponible/i.test(text(root.querySelector('[class*="availability"]')))?'unavailable':'unknown'});
  }
 }
 if(!rows.length)for(const script of document.querySelectorAll('script[type="application/ld+json"]')){try{const ld=JSON.parse(script.textContent);if(ld['@type']!=='Product')continue;const offer=Array.isArray(ld.offers)?ld.offers[0]:ld.offers;if(!offer||!Number.isFinite(Number(offer.price)))continue;rows.push({id:ld.sku||ld.productID,name:ld.name,brand:ld.brand?.name||ld.brand,priceCents:Math.round(Number(offer.price)*100),quantityText:ld.name,productUrl:location.href,ean:ld.gtin13,ingredients:ld.ingredients,conditionalPrice:true});}catch{}}
 const sourcePostcode=store==='Carrefour'?(document.body?.textContent?.match(/Env[ií]o a domicilio\s*(\d{5})/)?.[1]||null):store==='Alcampo'?([...document.querySelectorAll('button')].map(text).find(t=>/^\d{5}$/.test(t))||null):null;
 const categories=[...document.querySelectorAll('a[href]')].flatMap(a=>{try{const u=new URL(a.href);if(u.origin!==location.origin||u.search)return [];const valid=store==='Carrefour'?/^\/supermercado\/.+\/c$/.test(u.pathname):store==='Alcampo'?u.pathname.startsWith('/categories/'):false;return valid&&text(a)?[{name:text(a),url:u.href}]:[];}catch{return [];}});
 return {categories,rows:rows.map(r=>({...r,sourcePostcode})),reason:rows.length?null:'Sin ficha legible todavía. La tienda puede estar cargando o pedir elegir zona.',sourceUrl:location.href};
}
