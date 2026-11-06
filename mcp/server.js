import {observedList,compareObserved} from '../observed.js';
import {sourceStatus} from '../collectors/registry.js';
const schema=(properties={},required=[])=>({type:'object',properties,required,additionalProperties:false});
const readAnnotations={readOnlyHint:true,destructiveHint:false,idempotentHint:true,openWorldHint:false};
const definitions=[
 {name:'buscar_productos',description:'Busca precios recogidos por scraping. Devuelve procedencia, antigüedad, promociones y zona sin confirmar. No implica stock local.',inputSchema:schema({consulta:{type:'string',maxLength:150},categoria:{type:'string',maxLength:80},limite:{type:'integer',minimum:1,maximum:50}}),annotations:readAnnotations},
 {name:'calcular_cesta',description:'Interpreta la lista, conserva composición y cantidades y devuelve clarifications si faltan detalles. Pregunta al usuario y vuelve a llamar con sus respuestas; nunca ignores una línea. Calcula con precios recientes que cumplen los requisitos. Incluye envío estándar por defecto, fuentes de las tarifas, fecha de revisión, intervalos por franja y pedido mínimo; no asumas cobertura ni promociones. Compara cestas completas de la muestra, identifica las incompletas y ofrece reparto entre dos tiendas. No confirma un precio local. No reformules marcas ni restricciones sin permiso del usuario.',inputSchema:schema({lista:{type:'string',minLength:1,maxLength:5000},codigo_postal:{type:'string',pattern:'^[0-9]{5}$'},respuestas:{type:'object',maxProperties:100,description:'Respuestas por lineId a las clarificaciones: cut, species, allowVacuno, quantity y unit. Conserva las restricciones originales.',additionalProperties:{type:'object',additionalProperties:false,properties:{cut:{type:'string',enum:['picada','filetes','guisar']},species:{type:'string',enum:['ternera','vacuno','cerdo','pollo','pavo']},allowVacuno:{type:'boolean'},quantity:{type:'number',minimum:0.001,maximum:1000},unit:{type:'string',enum:['kg','l','ud']}}}},preferencia_marca:{type:'string',enum:['cualquiera','blanca','concreta']},marca:{type:'string',maxLength:80},modalidad:{type:'string',enum:['domicilio','presencial'],description:'Domicilio incluye envío estándar, intervalos y mínimos. Presencial compara solo productos; no es recogida de pedidos online.'},maximo_supermercados:{type:'integer',minimum:1,maximum:2},aceptar_alternativas:{type:'boolean',description:'Solo true si el usuario admite alternativas genéricas.'}},['lista','codigo_postal','aceptar_alternativas']),annotations:readAnnotations},
 {name:'estado_fuentes',description:'Consulta cadenas conectadas, última recogida, antigüedad y límites reales del servicio.',inputSchema:schema(),annotations:readAnnotations}
];
const refreshTool={name:'actualizar_precios',description:'Lanza scraping HTTP en DIA, Eroski, ALDI y Lidl. Las fuentes que requieren navegador se indican como browser-required; no se actualizan sus fechas. Escribe el histórico y la instantánea locales. No confirma precios para el código postal. Solo se ofrece en MCP local.',inputSchema:schema({codigo_postal:{type:'string',pattern:'^[0-9]{5}$'}}),annotations:{readOnlyHint:false,destructiveHint:false,idempotentHint:false,openWorldHint:true}};
const historyTool={name:'historial_producto',description:'Lee el histórico local de un SKU de la cadena indicada; mantiene las fechas reales de cada consulta.',inputSchema:schema({supermercado:{type:'string',maxLength:30},sku:{type:'string',pattern:'^[A-Za-z0-9]{1,30}$'},limite:{type:'integer',minimum:1,maximum:100}},['sku']),annotations:readAnnotations};
export function mcpTools(context){return [...definitions,...(context.refresh?[refreshTool]:[]),...(context.history?[historyTool]:[])];}
function validateArgs(tool,args){
 if(!args||typeof args!=='object'||Array.isArray(args))throw new Error('Los argumentos deben ser un objeto.');
 const s=tool.inputSchema;for(const k of s.required)if(!(k in args))throw new Error('Falta el argumento '+k+'.');
 for(const [k,v]of Object.entries(args)){
  const p=s.properties[k];if(!p)throw new Error('Argumento no permitido: '+k);
  if(p.type==='string'&&(typeof v!=='string'||(p.minLength&&v.length<p.minLength)||(p.maxLength&&v.length>p.maxLength)||(p.pattern&&!new RegExp(p.pattern).test(v))))throw new Error('Valor no válido: '+k);
  if(p.enum&&!p.enum.includes(v))throw new Error('Valor no válido: '+k);
  if(p.type==='object'){
   if(!v||typeof v!=='object'||Array.isArray(v)||Object.keys(v).length>(p.maxProperties||100))throw new Error('Valor no válido: '+k);
   for(const [id,reply] of Object.entries(v)){
    if(!/^line-\d+-[a-z0-9]+$/.test(id)||!reply||typeof reply!=='object'||Array.isArray(reply))throw new Error('Respuesta no válida.');
    for(const [field,value] of Object.entries(reply)){const rule=p.additionalProperties.properties[field];if(!rule||typeof value!==rule.type||rule.enum&&!rule.enum.includes(value)||rule.type==='number'&&(!Number.isFinite(value)||value<rule.minimum||value>rule.maximum))throw new Error('Respuesta no válida: '+field);}
   }
  }
  if(p.type==='boolean'&&typeof v!=='boolean')throw new Error('Valor no válido: '+k);
  if(p.type==='integer'&&(!Number.isInteger(v)||v<p.minimum||v>p.maximum))throw new Error('Valor no válido: '+k);
 }
}
export async function callMcpTool(name,args,context){
 const tool=mcpTools(context).find(t=>t.name===name);if(!tool)throw new Error('Herramienta no disponible.');validateArgs(tool,args);
 if(name==='actualizar_precios')return context.refresh(args.codigo_postal??null);
 if(name==='historial_producto')return context.history(args.sku,args.limite||30,args.supermercado||'DIA');
 const snapshot=await context.snapshot();
 if(name==='calcular_cesta')return compareObserved({text:args.lista,postcode:args.codigo_postal,acceptAlternatives:args.aceptar_alternativas,fulfillment:args.modalidad==='presencial'?'store':'delivery',maxStores:args.maximo_supermercados??2,resolutions:args.respuestas,brandPreference:{mode:({blanca:'private',concreta:'specific'})[args.preferencia_marca]||'any',name:args.marca}},snapshot,context.now?context.now():Date.now());
 if(name==='buscar_productos'){const result=observedList(snapshot,{query:args.consulta||'',category:args.categoria||''});return {...result,products:result.products.slice(0,args.limite||20),totalMatches:result.count};}
 const stores=sourceStatus(snapshot);return {source:'scraping',connectedStores:stores.filter(r=>r.products>0).map(r=>r.store),pendingStores:stores.filter(r=>!r.products).map(r=>r.store),stores,products:snapshot.observations.length,lastRun:snapshot.lastRun,locationVerified:false,requestedPostcode:snapshot.requestedPostcode,automaticMonitoring:false,canRefreshHere:Boolean(context.refresh),limitations:['Comparación limitada a la muestra recogida; zonas y canales de las fuentes pueden diferir.','Las fuentes browser se actualizan en Chrome; el recolector local HTTP solo actualiza las fuentes accesibles sin navegador.','Solo se usan en la cesta precios de menos de 24 horas, vigentes y sin promociones condicionadas.']};
}
export async function handleMcp(message,context){
 const error=(code,text,id=message?.id??null)=>({jsonrpc:'2.0',id,error:{code,message:text}});
 if(!message||Array.isArray(message)||message.jsonrpc!=='2.0'||typeof message.method!=='string'||('id'in message&&typeof message.id!=='string'&&typeof message.id!=='number'&&message.id!==null))return error(-32600,'Petición JSON-RPC no válida.');
 if(!('id'in message))return null;
 let result;
 switch(message.method){
  case 'server/discover':result={supportedVersions:['2026-07-28'],capabilities:{tools:{}},serverInfo:{name:'cesta-clara',version:'0.9.3'},instructions:'Datos de scraping. Respeta fecha, cobertura, zona y restricciones; nunca inventes precios ni presentes una cesta incompleta como ganadora.'};break;
  case 'initialize':{const requested=message.params?.protocolVersion;result={protocolVersion:['2026-07-28','2025-11-25','2025-06-18'].includes(requested)?requested:'2025-11-25',capabilities:{tools:{}},serverInfo:{name:'cesta-clara',version:'0.9.3'},instructions:'Consulta estado_fuentes antes de recomendar. No sustituyas restricciones del usuario ni afirmes precios locales sin confirmar la zona.'};break;}
  case 'ping':result={};break;
  case 'tools/list':result={tools:mcpTools(context)};break;
  case 'tools/call':{
   if(typeof message.params?.name!=='string')return error(-32602,'Falta el nombre de la herramienta.');
   try{const data=await callMcpTool(message.params.name,message.params.arguments??{},context);result={content:[{type:'text',text:JSON.stringify(data)}],structuredContent:data,isError:data.run?.status==='failed'};}
   catch(e){result={content:[{type:'text',text:e.message}],isError:true};}break;
  }
  default:return error(-32601,'Método no disponible.');
 }
 return {jsonrpc:'2.0',id:message.id,result};
}
