import {normalizeText,PRIVATE_BRANDS} from './engine.js';
import {canonicalType} from './collectors/normalize.js';
const word=(s,w)=>new RegExp('(?:^|[^a-z])'+w+'(?:[^a-z]|$)').test(s);
const meatWords=['ternera','vacuno','cerdo','pollo','pavo','cordero'];
// This input must come from the ingredients section, never the nutrition table.
export function meatComposition(ingredients){
 const text=normalizeText(ingredients||''),values=[];
 const patterns=[/carne(?:s)?(?: fresca)?(?: de)?\s+(ternera|vacuno|cerdo|pollo|pavo)\s*\(?\s*(\d+(?:[.,]\d+)?)\s*%/g,/carne\s*\(\s*(\d+(?:[.,]\d+)?)\s*%\s*\)\s*(?:de\s+)?(ternera|vacuno|cerdo|pollo|pavo)/g];
 for(const [i,pattern] of patterns.entries())for(const match of text.matchAll(pattern)){const percent=Number(match[i===0?2:1].replace(',','.')),species=match[i===0?1:2];if(percent>=0&&percent<=100)values.push({species,percent,quote:match[0]});}
 return values.length===1?values[0]:null;
}
const basicWords={leche:['leche','entera','uht'],huevos:['huevo','huevos','m','medianos','mediano','suelo'],arroz:['arroz','redondo'],aceite:['aceite','oliva','virgen','extra'],pasta:['pasta','macarron','macarrones']};
const singular=w=>({filetes:'filete',huevos:'huevo',macarrones:'macarron',medianos:'mediano',escalopes:'escalope',escalopines:'escalopin',bistecs:'bistec'}[w]|| (w.endsWith('s')?w.slice(0,-1):w));
export const CUT_PATTERNS={picada:/picad|molid/,filetes:/filet|bistec|escalop/,guisar:/guisar|guiso|tacos|estofad|trocead/};
export const BOVINE_WORDS=['vacuno','ternera','anojo','novillo','vaca','buey'];
export function sameCut(item,name){return item.id!=='carne'||CUT_PATTERNS[item.constraints.cut]?.test(normalizeText(name))===true;}
function includesTerm(name,term){return word(name,term)||name.split(/[^a-z]+/).some(w=>singular(w)===singular(term));}
export function matchRequest(item,observation){
 const name=normalizeText(observation.name+' '+(observation.brand||'')),speciesName=name+(observation.speciesEvidence&&observation.declaredSpecies?' '+observation.declaredSpecies:''),ingredients=normalizeText(observation.ingredients||''),c=item.constraints;
 if(c.brand?.mode==='specific'&&!name.includes(normalizeText(c.brand.name)))return {status:'different',reason:'La marca solicitada no coincide.'};
 if(c.brand?.mode==='private'&&!(PRIVATE_BRANDS[observation.store]||[]).some(b=>word(name,normalizeText(b))))return {status:'unverified',reason:'No se acredita que sea marca blanca de esta tienda.'};
 if(item.id==='carne'){
  if(/higado|rinon|lengua|casqueria/.test(name)&&!/higado|rinon|lengua|casqueria/.test(normalizeText(item.sourceText)))return {status:'different',reason:'Es casquería; no es el filete solicitado.'};
  if(/hamburgues|burger|albondig|bolonesa|lasana|empanad|cocinad|vegana|vegetal/.test(name))return {status:'different',reason:'Es otro preparado, no el corte solicitado.'};
  if(!sameCut(item,name))return {status:'different',reason:'El corte no coincide.'};
  if(/adobad|marinad|cocinad|brasead|congelad/.test(name)&&!/adobad|marinad|cocinad|brasead|congelad/.test(normalizeText(item.sourceText)))return {status:'different',reason:'La preparación o conservación no coincide.'};
  const allowed=c.species==='vacuno'||c.species==='ternera'&&c.allowVacuno?BOVINE_WORDS:[c.species];
  if(!allowed.some(s=>word(speciesName,s)))return {status:'different',reason:c.species==='ternera'&&word(name,'vacuno')?'El etiquetado indica vacuno; falta aceptar esa alternativa.':'La especie no coincide.'};
  if(meatWords.some(s=>!allowed.includes(s)&&(word(name,s)||word(ingredients,s))))return {status:'different',reason:'Contiene otra especie de carne.'};
  const extras=item.terms.filter(w=>!['ternera','vacuno','cerdo','pollo','pavo','picada','molida','filete','filetes','bistec','bistecs','escalope','escalopes','escalopin','escalopines','guisar','guiso','tacos'].includes(w));
  if(extras.some(w=>!includesTerm(name,w)))return {status:'different',reason:'No acredita todos los requisitos del producto.'};
  if(c.minimumMeatPercent!==null){
   const composition=meatComposition(observation.ingredients);
   if(!composition||!allowed.includes(composition.species))return {status:'unverified',reason:'La ficha no acredita el porcentaje de carne.',requiredPercent:c.minimumMeatPercent};
   if(composition.percent<c.minimumMeatPercent)return {status:'different',reason:'Acredita '+composition.percent+' % de carne; se exige al menos '+c.minimumMeatPercent+' %.',composition};
   return {status:'match',composition};
  }return {status:'match'};
 }
 const basic=basicWords[item.id],extra=basic?item.terms.filter(w=>!basic.includes(w)):item.terms;
 if(basic&&extra.length===0&&canonicalType(observation.name)!==item.id)return {status:'different',reason:'Es otra variedad del producto.'};
 const required=basic&&extra.length?item.terms.filter(w=>!({leche:['leche'],huevos:['huevo','huevos'],arroz:['arroz'],aceite:['aceite'],pasta:['pasta']}[item.id]||[]).includes(w)):extra;
 if(required.some(w=>!includesTerm(name,w)))return {status:'different',reason:'La variedad o la marca no coincide.'};
 if(basic&&!basic.some(w=>word(name,w)))return {status:'different',reason:'Es otro producto.'};
 if(/\bsin\b/.test(normalizeText(item.sourceText))){const restriction=normalizeText(item.sourceText).match(/\bsin\s+([a-z]+(?:\s+anadidos)?)/)?.[0];if(restriction&&!name.includes(restriction))return {status:'unverified',reason:'No se acredita «'+restriction+'».'};}
 return {status:'match'};
}
