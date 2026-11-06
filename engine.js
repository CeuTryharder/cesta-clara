export const STORES=['Mercadona','Carrefour','DIA','Alcampo','Lidl'];
export const CATALOG=[
 ['leche','Leche entera',1,'l',['leche']],['huevos','Huevos M',12,'ud',['huevos','huevo']],
 ['arroz','Arroz redondo',1,'kg',['arroz']],['aceite','Aceite de oliva virgen extra',1,'l',['aceite']],
 ['pasta','Macarrones',0.5,'kg',['pasta','macarrones']],['yogur','Yogur natural',4,'ud',['yogur','yogures']],
 ['pan','Pan de molde',0.5,'kg',['pan']],['tomate','Tomate triturado',0.4,'kg',['tomate triturado']],
 ['cafe','Café molido',0.25,'kg',['cafe']],['azucar','Azúcar blanco',1,'kg',['azucar']],
 ['sal','Sal fina',1,'kg',['sal']],['avena','Copos de avena',0.5,'kg',['avena']]
].map(([id,name,size,unit,aliases])=>({id,name,size,unit,aliases}));
export const normalizeText=s=>String(s).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim();
const NUMBER_WORDS={un:1,una:1,uno:1,dos:2,tres:3,cuatro:4,cinco:5,seis:6,siete:7,ocho:8,nueve:9,diez:10,doce:12,trece:13,catorce:14,quince:15,dieciseis:16,diecisiete:17,dieciocho:18,diecinueve:19,veinte:20,veinticuatro:24,medio:0.5,media:0.5};
const STOP_WORDS=new Set('necesito quiero comprar comprame anade dame busca buscame por favor que sea sean tenga tengan contenga contengan contenido con de del la el los las para al a y o mas minimo minima menos como sin exactamente igual superior porcentaje carne litro litros l ml mililitro mililitros kilo kilos kilogramo kilogramos kg gramo gramos g ud uds unidad unidades docena docenas pack packs paquete paquetes bote botes botella botellas bandeja bandejas'.split(' '));
const hasWord=(s,w)=>new RegExp('(?:^|[^a-z])'+w+'(?:[^a-z]|$)').test(s);
const packs=(q,s)=>Math.ceil((q-1e-9)/s);
export function requestKey(text,index){let hash=2166136261;for(const c of text)hash=Math.imul(hash^c.charCodeAt(0),16777619);return 'line-'+index+'-'+(hash>>>0).toString(36);}
// Keep decimal commas, requirement clauses and "vacuno y cerdo" attached to their item.
export function splitShoppingList(text){
 const lines=String(text).replace(/(\d),(\d)/g,'$1.$2').replace(/\b(kilos?|kilogramos?|kg|litros?|l|docenas?)\s+y\s+medi[oa]\b/gi,m=>m.replace(/\s+y\s+/,' __half__ ')).split(/\n|;/).flatMap(line=>line.split(/,|\s+y\s+(?=(?:\d|un[ao]?\b|dos\b|tres\b|cuatro\b|cinco\b|seis\b|siete\b|ocho\b|nueve\b|diez\b|doce\b|medio\b|media\b))/i)),result=[];
 for(const part of lines){const value=part.replace(/ __half__ /g,' y ').trim();if(!value)continue;
  if(result.length&&/^(?:(?:que\s+)?(?:sea|tenga|con|sin|al menos|minimo|como minimo)\b|\d+(?:\.\d+)?\s*%)/i.test(normalizeText(value)))result[result.length-1]+=', '+value;
  else result.push(value);
 }return result;
}
function amountOf(line,product){
 let s=line.replace(/\b(?:un kilo|un kilogramo|un litro) y medio\b/g,m=>m.includes('litro')?'1.5 litros':'1.5 kg').replace(/\b(?:un|una|uno|dos|tres|cuatro|cinco|seis|siete|ocho|nueve|diez|doce|trece|catorce|quince|dieciseis|diecisiete|dieciocho|diecinueve|veinte|veinticuatro|medio|media)\b/g,w=>NUMBER_WORDS[w]);
 s=s.replace(/(\d+(?:\.\d+)?)\s*(kilos?|kilogramos?|kg|litros?|l|docenas?)\s+y\s+(?:medi[oa]|0\.5)\b/g,(_,n,u)=>(Number(n)+0.5)+' '+u);
 const physical=s.match(/(\d+(?:\.\d+)?)\s*(mililitros?|ml\b|kilogramos?|kilos?|kg\b|gramos?|g\b|litros?|l\b)/),count=s.replace(/\d+(?:\.\d+)?\s*%/g,'').match(/(?:^|\s)(\d+(?:\.\d+)?)(?:\s|$)/);
 let quantity,unit,assumed=false;
 if(physical){quantity=Number(physical[1]);const u=physical[2];unit=/^(ml|mililitro|l\b|litro)/.test(u)?'l':'kg';if(/^(ml|mililitro|g\b|gramo)/.test(u))quantity/=1000;}
 else if(/docena/.test(s)){quantity=(count?Number(count[1]):1)*12;unit='ud';}
 else if(product&&/\b(packs?|paquetes?|botes?|botellas?)\b/.test(s)){quantity=(count?Number(count[1]):1)*product.size;unit=product.unit;assumed=true;}
 else if(count){quantity=Number(count[1]);unit=product?.unit||null;}
 else{quantity=product?.size??null;unit=product?.unit??null;assumed=true;}
 return {quantity,unit,assumed};
}
function meatQuestion(item){
 if(!item.constraints.species)return {field:'species',question:'¿De qué animal quieres la carne picada?',options:[{label:'Ternera',value:'ternera'},{label:'Vacuno',value:'vacuno'},{label:'Cerdo',value:'cerdo'},{label:'Pollo',value:'pollo'}]};
 if(!item.constraints.cut)return {field:'cut',question:'¿Cómo quieres la '+item.constraints.species+'?',options:[{label:'Picada',value:'picada'},{label:'En filetes',value:'filetes'},{label:'Para guisar',value:'guisar'}]};
 return null;
}
export const PRIVATE_BRANDS={DIA:['dia','seleccion de dia','dia lactea','el cencerro','bonté','delicious'],Mercadona:['hacendado','deliplus','bosque verde'],Carrefour:['carrefour','simpl'],Alcampo:['alcampo','auchan','pulgar'],Lidl:['milbona','lidl','chef select','combino','belfina','oli sone'],ALDI:['milsani','aldi','el mercado','gutbio','la tabla'],Eroski:['eroski','belle'],Consum:['consum']};
const KNOWN_BRANDS=[...new Set(Object.values(PRIVATE_BRANDS).flat()),'pascual','asturiana','central lechera asturiana','danone','gallo','gullon','kaiku','puleva','lauki','president','nestle','alpro','carbonell','luengo','gvtarra','bomilk'];
export function brandPolicy(value){
 if(!value)return {mode:'any'};
 if(!['any','private','specific'].includes(value.mode))throw new Error('Elige cualquier marca, marca blanca o una marca concreta.');
 const name=String(value.name||'').trim();if(value.mode==='specific'&&(!name||name.length>80))throw new Error('Escribe una marca de hasta 80 caracteres.');
 return value.mode==='specific'?{mode:'specific',name}:{mode:value.mode};
}
export function parseList(text,{resolutions={},brandPreference}={}){
 if(!resolutions||typeof resolutions!=='object'||Array.isArray(resolutions)||Object.keys(resolutions).length>100)throw new Error('Las respuestas no tienen un formato válido.');
 const items=[],requests=[],pending=[],clarifications=[];
 for(const [index,original] of splitShoppingList(text).entries()){
  const lineId=requestKey(original,index),resolution=resolutions[lineId]||{},line=normalizeText(original),meatMatch=line.match(/\b(ternera|vacuno|cerdo|pollo|pavo|carne|picada|molida)\b/);
  const detected=CATALOG.filter(p=>p.aliases.some(a=>hasWord(line,a))).map(p=>({...p,position:Math.min(...p.aliases.map(a=>line.search(new RegExp('\\b'+a+'\\b'))).filter(n=>n>=0))})).sort((a,b)=>a.position-b.position);
  const meat=Boolean(meatMatch&&(!detected.length||meatMatch.index<detected[0].position));
  const products=meat?[]:detected.filter((p,i)=>i===0||!/(?:sin|con|de)\s+$/.test(line.slice(0,p.position))),p=products.length===1?products[0]:null;
  const amount=amountOf(line,meat?{size:1,unit:'kg'}:p),percentages=[...line.matchAll(/(\d+(?:\.\d+)?)\s*%/g)];
  if(meat&&amount.assumed)amount.quantity=null;
  const species=line.match(/\b(ternera|vacuno|cerdo|pollo|pavo)\b/)?.[1]||null,cut=/picad|molid/.test(line)?'picada':/filetes?|bistec|escalop/.test(line)?'filetes':/guisar|guiso|tacos|estofad|trocead/.test(line)?'guisar':null;
  const constraints={species,cut,minimumMeatPercent:meat&&percentages.length===1?Number(percentages[0][1]):null,allowVacuno:false,vacunoAnswered:Object.hasOwn(resolution,'allowVacuno')};
  if(meat&&resolution.species&&constraints.species&&resolution.species!==constraints.species)throw new Error('La respuesta no puede cambiar la especie solicitada. Edita la línea si quieres otro producto.');
  if(meat&&resolution.cut&&constraints.cut&&resolution.cut!==constraints.cut)throw new Error('La respuesta no puede cambiar el corte solicitado.');
  if(meat){if(['picada','filetes','guisar'].includes(resolution.cut))constraints.cut=resolution.cut;if(['ternera','vacuno','cerdo','pollo','pavo'].includes(resolution.species))constraints.species=resolution.species;if(resolution.allowVacuno===true)constraints.allowVacuno=true;}
  const explicitPrivate=/\bmarca (?:blanca|propia|del supermercado)\b/.test(line),brandClause=line.match(/\bmarca\s+(?!blanca\b|propia\b|del supermercado\b)([a-z ]+)$/),known=KNOWN_BRANDS.slice().sort((a,b)=>b.length-a.length).find(b=>hasWord(line,normalizeText(b)));
  const explicitBrand=explicitPrivate?{mode:'private'}:brandClause?{mode:'specific',name:brandClause[1].trim()}:known?{mode:'specific',name:known}:null;
  const selected=brandPolicy(resolution.brandPreference||brandPreference);constraints.brand=explicitBrand||selected;
  let productLine=line.replace(/\bmarca (?:blanca|propia|del supermercado)\b/g,' ').replace(/\bmarca\s+[a-z ]+$/,' ');
  if(explicitBrand?.mode==='specific')productLine=productLine.replace(normalizeText(explicitBrand.name),' ');
  const terms=productLine.replace(/\d+(?:\.\d+)?\s*%/g,' ').replace(/\d+(?:\.\d+)?/g,' ').split(/[^a-z]+/).filter(w=>w&&!STOP_WORDS.has(w)&&!(w in NUMBER_WORDS));
  const name=meat?['Carne',constraints.species&&'de '+constraints.species,constraints.cut==='picada'?'picada':constraints.cut==='filetes'?'en filetes':constraints.cut==='guisar'?'para guisar':null].filter(Boolean).join(' '):p?.name||terms.join(' ');
  const item={id:meat?'carne':p?.id||'producto',lineId,sourceText:original,name,query:meat?[constraints.species,constraints.cut==='picada'?'picada':constraints.cut].filter(Boolean).join(' ')||'carne':terms.join(' '),...amount,packSize:p?.size||1,packs:amount.quantity?packs(amount.quantity,p?.size||1):null,constraints,terms,status:'ready'};
  if(Number.isFinite(resolution.quantity)&&resolution.quantity>0&&resolution.quantity<=1000&&['kg','l','ud'].includes(resolution.unit)){item.quantity=resolution.quantity;item.unit=resolution.unit;item.assumed=false;}
  let issue=null;
  if(products.length>1)issue={field:'rewrite',question:'Hay varios productos en esta línea. Escríbelos en líneas separadas.',options:[]};
  else if(/-\s*\d/.test(line)||item.quantity!==null&&(!Number.isFinite(item.quantity)||item.quantity<=0||item.quantity>1000)||p&&item.unit!==p.unit||meat&&item.unit!=='kg')issue={field:'rewrite',question:'Revisa la cantidad y la unidad de esta línea.',options:[]};
  else if(percentages.length&&(!meat||percentages.length!==1||constraints.minimumMeatPercent>100||constraints.minimumMeatPercent<0||/grasa|protein|exact|menos|maxim/.test(line.replace(/al menos|no menos de|no menos del/g,''))))issue={field:'rewrite',question:'Aclara este porcentaje. Puedo comprobar un porcentaje mínimo de carne; no asumiré que es grasa o proteína.',options:[]};
  else if(meat&&/\b(ternera|vacuno|cerdo|pollo|pavo)\s+y\s+(ternera|vacuno|cerdo|pollo|pavo)\b/.test(line))issue={field:'rewrite',question:'Indica la mezcla y sus proporciones. No la sustituiré por carne de una sola especie.',options:[]};
  else if(!item.quantity||!item.unit)issue={field:'quantity',question:'¿Qué cantidad de «'+original+'» necesitas? Escribe, por ejemplo, 1 kg o 6 unidades.',options:[]};
  else if(meat)issue=meatQuestion(item);
  if(!item.name||!item.query)issue={field:'rewrite',question:'Escribe el nombre del producto y la cantidad que necesitas.',options:[]};
  if(issue){item.status='needs-clarification';const q={...issue,lineId,text:original};clarifications.push(q);pending.push({text:original,lineId,reason:issue.question,kind:'clarification'});}
  else{const duplicate=items.find(x=>x.id===item.id&&x.query===item.query&&JSON.stringify(x.constraints)===JSON.stringify(item.constraints));if(duplicate){duplicate.quantity+=item.quantity;duplicate.packs=packs(duplicate.quantity,duplicate.packSize);duplicate.lineIds=[...(duplicate.lineIds||[duplicate.lineId]),lineId];}else items.push(item);}
  requests.push(item);
 }return {items,requests,pending,clarifications};
}

export function queryFingerprint(input){const parsed=parseList(input.text,{resolutions:input.resolutions,brandPreference:input.brandPreference});return JSON.stringify(['meat-unit-price-v1',input.postcode,parsed.requests.map(r=>[r.id,r.query,r.quantity,r.unit,r.constraints])]);}
