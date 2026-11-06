import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const seed=JSON.parse(await readFile(new URL('../data/dia-latest.json',import.meta.url)));
async function fixture(){
 let listener,reloads=0,fetches=0,blockGet=null,release;
 const saved={snapshot:structuredClone(seed),seedVersion:'0.9.1'},alarms=new Map();
 const event=()=>({addListener:()=>{}});
 const api={sidePanel:{setPanelBehavior:async()=>{}},storage:{local:{setAccessLevel:async()=>{},get:async keys=>{if(blockGet){const waiting=blockGet;blockGet=null;await waiting;}return Object.fromEntries((Array.isArray(keys)?keys:[keys]).map(k=>[k,structuredClone(saved[k])]));},set:async values=>Object.assign(saved,structuredClone(values)),clear:async()=>{for(const key of Object.keys(saved))delete saved[key];},getBytesInUse:async()=>120}},runtime:{id:'test',getURL:p=>'chrome-extension://test/'+p,getManifest:()=>({version:'0.9.1'}),onMessage:{addListener:fn=>listener=fn},onInstalled:event(),onStartup:event(),reload:()=>{reloads++;}},permissions:{contains:async()=>false,onRemoved:event()},alarms:{create:async(name,value)=>alarms.set(name,value),clear:async name=>alarms.delete(name),get:async name=>alarms.get(name),onAlarm:event()}};
 const originalChrome=globalThis.chrome,originalFetch=globalThis.fetch;globalThis.chrome=api;globalThis.fetch=async()=>{fetches++;return Response.json(seed);};
 await import(new URL('../dist/extension/background.js?privacy='+Math.random(),import.meta.url));
 const message=(value,sender={id:'test',url:'chrome-extension://test/panel.html'})=>new Promise(resolve=>{const accepted=listener(value,sender,resolve);if(!accepted)resolve(null);});
 return {saved,alarms,message,reloads:()=>reloads,fetches:()=>fetches,block(){blockGet=new Promise(r=>release=r);},unblock(){release();},close(){globalThis.chrome=originalChrome;globalThis.fetch=originalFetch;}};
}

test('El borrado exige confirmación y origen de extensión; un diagnóstico no reanuda cestas',async()=>{
 const f=await fixture();try{
  f.saved.draft={text:'PRIVATE_SENTINEL',postcode:'28001'};
  f.saved.cartJob={status:'paused',pauseCode:'session',store:'DIA',index:0,rows:[{name:'PRIVATE_SENTINEL',cartUnits:2,status:'pending'}],diagnostics:[{event:'PRIVATE_SENTINEL'}]};
  assert.equal(await f.message({type:'clear-data',confirmed:true},{id:'test',url:'https://www.dia.es/'}),null);
  assert.equal((await f.message({type:'clear-data'})).ok,false);assert.ok(f.saved.draft);
  const d=await f.message({type:'diagnostics'});assert.equal(d.ok,true);assert.doesNotMatch(JSON.stringify(d.data),/PRIVATE_SENTINEL|28001/);assert.equal(f.saved.cartJob.status,'paused');assert.equal(f.fetches(),0);
 }finally{f.close();}
});

test('El borrado espera las consultas activas; luego elimina datos y alarmas e impide escrituras tardías',async()=>{
 const f=await fixture();try{
  f.saved.draft={text:'PRIVATE_SENTINEL'};f.saved.postcode='28001';f.saved.history={private:true};f.saved.resourceUsage={httpRequests:9};f.saved.automatic=true;
  f.saved.cartJob={id:'test-job',status:'paused',pauseCode:'session',store:'DIA',index:0,rows:[{name:'PRIVATE_SENTINEL',cartUnits:2,status:'pending'}]};f.alarms.set('refresh-stores',{});
  f.block();const pending=f.message({type:'draft'});
  assert.equal((await f.message({type:'clear-data',confirmed:true})).ok,false);assert.ok(f.saved.draft);f.unblock();await pending;
  const result=await f.message({type:'clear-data',confirmed:true});assert.equal(result.ok,true);assert.deepEqual(f.saved,{});assert.equal(f.alarms.size,0);
  assert.equal((await f.message({type:'draft',draft:{text:'PRIVATE_SENTINEL'}})).ok,false);assert.deepEqual(f.saved,{});
  await new Promise(r=>setTimeout(r,250));assert.equal(f.reloads(),1);assert.equal(f.fetches(),0);
 }finally{f.close();}
});

test('Una instalación nueva no preselecciona la zona de otra persona',async()=>{const f=await fixture();try{const r=await f.message({type:'status'});assert.equal(r.ok,true);assert.equal(r.data.postcode,'');}finally{f.close();}});
