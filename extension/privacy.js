// A diagnostic is a small, explicit schema, never a dump of local storage.
const stores=['DIA','Mercadona','Carrefour','Alcampo','Lidl','ALDI','Eroski','Consum'];
const states=['not-run','running','ready','paused','complete','cancelled','pending','done','unavailable','succeeded','failed','partial','empty','permission-required','browser-required','not-supported'];
const issues=['tab-closed','blocked','excluded','permission','not-found','location','network','check-needed'];
const events=['tab-opened','tab-disappeared','quantity-policy-upgraded','login-count-reconciled','out-of-stock','tab-missing','waiting-for-login','paused'];
const choice=(value,allowed,fallback=null)=>allowed.includes(value)?value:fallback;
const count=value=>Number.isSafeInteger(value)&&value>=0?value:null;
const timestamp=value=>typeof value==='string'&&/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d{3})?Z$/.test(value)&&Number.isFinite(Date.parse(value))?value:null;
const list=value=>Array.isArray(value)?value:[];
export function privateDiagnostic(input={}){
 const u=input.resourceUsage||{},cart=input.cart;
 return {
  version:typeof input.version==='string'&&/^\d+\.\d+\.\d+$/.test(input.version)?input.version:null,
  at:timestamp(input.at),
  resourceUsage:{since:timestamp(u.since),...Object.fromEntries(['httpRequests','httpFailures','decodedBytes','browserPages','peakBrowserPages','activeBrowserPages','storageBytes'].map(k=>[k,count(u[k])])),cpuPercent:null,memoryBytes:null,totalNetworkBytes:null,recent:list(u.recent).slice(0,10).map(r=>({operation:choice(r.operation,['compare','search','refresh','automatic']),durationMs:count(r.durationMs),ok:r.ok===true,at:timestamp(r.at)}))},
  stores:list(input.stores).filter(r=>stores.includes(r.store)).slice(0,8).map(r=>({store:r.store,permission:typeof r.permission==='boolean'?r.permission:null,status:choice(r.status,states,'not-run'),checkedAt:timestamp(r.checkedAt),pages:count(r.pages),prices:count(r.prices),issues:list(r.issues).slice(0,20).map(i=>choice(i,issues,'check-needed'))})),
  cart:cart?{store:choice(cart.store,stores),status:choice(cart.status,states),index:count(cart.index),rows:list(cart.rows).slice(0,100).map(r=>({status:choice(r.status,states),units:count(r.units),target:count(r.target),pending:r.pending===true})),events:list(cart.events).slice(-30).map(e=>({at:timestamp(e.at),event:choice(e.event,events,'paused'),index:count(e.index)}))}:null
 };
}
