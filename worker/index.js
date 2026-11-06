import { STORES } from '../engine.js';
import {compareObserved,observedList} from '../observed.js';
import {handleMcp} from '../mcp/server.js';
import {sourceStatus} from '../collectors/registry.js';
function json(data,status=200){return Response.json(data,{status,headers:{'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});}
export default {async fetch(request){
 const url=new URL(request.url),path=url.pathname;
 if(path==='/mcp'){
  if(request.method!=='POST')return new Response(null,{status:405,headers:{Allow:'POST'}});
  if(!request.headers.get('Content-Type')?.includes('application/json'))return json({error:'Content-Type debe ser application/json.'},415);
  if(Number(request.headers.get('Content-Length'))>20000)return json({error:'Petición excesiva.'},413);
  let message;try{const body=await request.text();if(body.length>20000)return json({error:'Petición excesiva.'},413);message=JSON.parse(body);}catch{return json({jsonrpc:'2.0',id:null,error:{code:-32700,message:'JSON no válido.'}},400);}
  const result=await handleMcp(message,{snapshot:async()=>SNAPSHOT});return result?json(result):new Response(null,{status:202});
 }
 if(path==='/api/health'&&request.method==='GET')return json({status:'ok',mode:'observed',connectedSources:sourceStatus(SNAPSHOT).filter(r=>r.products>0).length,scheduledCollectors:0,realProductCount:SNAPSHOT.observations.length,locationVerified:false,lastRun:SNAPSHOT.lastRun});
 if(path==='/api/observations'&&request.method==='GET')return json(observedList(SNAPSHOT,{category:url.searchParams.get('category')||'',query:(url.searchParams.get('q')||'').slice(0,150)}));
 if(path==='/api/collectors'&&request.method==='GET')return json({requestedPostcode:SNAPSHOT.requestedPostcode,locationVerified:false,collectors:sourceStatus(SNAPSHOT)});
 if(path==='/api/catalog'&&request.method==='GET')return json(observedList(SNAPSHOT));
 if(path==='/api/compare'){
  if(request.method!=='POST')return json({error:'Usa POST.'},405);
  if(Number(request.headers.get('Content-Length'))>12000)return json({error:'Petición demasiado grande.'},413);
  try{const raw=await request.text();if(raw.length>12000)return json({error:'Petición demasiado grande.'},413);const input=JSON.parse(raw);if(!input||typeof input!=='object'||Array.isArray(input))throw new Error('Formato JSON inválido.');if(input.mode&&input.mode!=='observed')throw new Error('Solo se admiten datos recogidos por scraping.');return json(compareObserved(input,SNAPSHOT));}catch(e){return json({error:e instanceof SyntaxError?'Formato JSON inválido.':e.message},400);}
 }
 if(path.startsWith('/api/'))return json({error:'Ruta no encontrada.'},404);
 if(path!=='/'||!['GET','HEAD'].includes(request.method))return new Response('No encontrado',{status:404});
 return new Response(request.method==='HEAD'?null:PAGE,{headers:{'Content-Type':'text/html; charset=utf-8','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer','Content-Security-Policy':"default-src 'self'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; connect-src 'self'; img-src 'self' data:; frame-ancestors 'none'"}});
}};
