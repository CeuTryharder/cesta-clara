export function formatDictation(text){
 const tens={treinta:30,cuarenta:40,cincuenta:50,sesenta:60,setenta:70,ochenta:80,noventa:90},ones={uno:1,dos:2,tres:3,cuatro:4,cinco:5,seis:6,siete:7,ocho:8,nueve:9};
 return String(text).replace(/\b(treinta|cuarenta|cincuenta|sesenta|setenta|ochenta|noventa)\s+y\s+(uno|dos|tres|cuatro|cinco|seis|siete|ocho|nueve)\s+por\s+ciento\b/gi,(_,t,o)=>(tens[t.toLowerCase()]+ones[o.toLowerCase()])+' %').replace(/\bcien\s+por\s+ciento\b/gi,'100 %').replace(/\bpor\s+ciento\b/gi,'%').replace(/\b(?:nueva l[ií]nea|siguiente producto|punto y aparte)\b/gi,'\n').replace(/\bcoma\b/gi,',').replace(/[ \t]+/g,' ').replace(/\s*\n\s*/g,'\n').trim();
}
export function setupDictation({environment=globalThis,button,status,textarea,onChange,onState=()=>{},beforeStart=null,onTranscript=()=>false,onSessionEnd=()=>{}}){
 const Recognition=environment.SpeechRecognition||environment.webkitSpeechRecognition;
 let recognition=null,active=false,starting=false,stopping=false,discardPending=false,busy=false,generation=0,endingMessage='',sessionError=false;
 const label=()=>{button.textContent=stopping?'Terminando dictado…':active?'Detener dictado':starting?'Esperando micrófono…':'Dictar lista';button.setAttribute('aria-pressed',String(active));button.disabled=!Recognition||starting||stopping||busy&&!active;};
 const notify=text=>{status.hidden=!text;status.textContent=text;};
 const setActive=value=>{starting=false;active=value;textarea.readOnly=value;label();onState(value);};
 if(!Recognition){notify('El dictado no está disponible en este navegador. Puedes escribir tu lista.');label();return {setBusy:value=>{busy=value;label();},stop:()=>{},isActive:()=>false};}
 const stop=(notice='',options={})=>{
  if(recognition&&starting){generation++;recognition.abort();setActive(false);notify(notice||'Dictado cancelado.');}
  else if(recognition&&active){
   discardPending=discardPending||options.discardPending===true;
   if(notice)endingMessage=notice;
   if(stopping)return;
   stopping=true;label();notify(notice||'Terminando el dictado…');recognition.stop();
  }
 };
 button.onclick=async()=>{
  if(active){stop();return;}if(busy||starting)return;
  endingMessage='';sessionError=false;stopping=false;discardPending=false;const session=++generation,committed=new Set();recognition=new Recognition();recognition.lang='es-ES';recognition.continuous=true;recognition.interimResults=true;recognition.maxAlternatives=1;
  recognition.onstart=()=>{if(session!==generation)return;setActive(true);notify('Escuchando. Di cada producto con su cantidad. Pulsa «Detener dictado» al terminar.');};
  recognition.onresult=event=>{
   if(session!==generation||!active||discardPending)return;const interim=[];
   for(let i=event.resultIndex;i<event.results.length;i++){
    if(session!==generation||!active||discardPending)break;
    const result=event.results[i],transcript=result[0]?.transcript||'';
    if(!result.isFinal){interim.push(transcript);continue;}if(committed.has(i))continue;committed.add(i);
    const chunk=formatDictation(transcript);if(!chunk)continue;
    const consumed=onTranscript(chunk);
    if(session!==generation||!active||discardPending)break;
    if(consumed)continue;
    const next=textarea.value.trimEnd()+(textarea.value.trim()?'\n':'')+chunk;
    if(next.length>5000){stop('La lista alcanza el límite de 5.000 caracteres. Revisa el texto antes de seguir.',{discardPending:true});break;}
    textarea.value=next;onChange();
   }
   if(interim.length&&!stopping&&active)notify('Escuchando: '+interim.join(' '));
  };
  recognition.onerror=event=>{
   if(session!==generation)return;
   const messages={'not-allowed':'Chrome no ha permitido el micrófono. Revisa el permiso de Cesta Clara y vuelve a intentarlo.','service-not-allowed':'El servicio de voz no está permitido en este navegador.','audio-capture':'No se encuentra un micrófono disponible.','no-speech':'No se ha detectado voz. Puedes volver a dictar.','network':'El servicio de voz no responde. Comprueba la conexión o escribe la lista.','aborted':'Dictado detenido.'};
   sessionError=true;notify(messages[event.error]||'No se pudo completar el dictado. El texto recogido se conserva.');setActive(false);
  };
  recognition.onend=()=>{if(session!==generation)return;const hadError=!active;stopping=false;setActive(false);if(!hadError)notify(endingMessage||'Dictado terminado. Revisa el texto y pulsa «Revisar y comparar».');onSessionEnd({error:sessionError});};
  try{starting=true;label();onState(true);notify('Esperando el permiso del micrófono…');if(beforeStart&&!await beforeStart()){if(session===generation)setActive(false);return;}if(session!==generation)return;recognition.start();}catch{notify('No se pudo iniciar el dictado. Comprueba el micrófono y vuelve a intentarlo.');setActive(false);}
 };
 environment.addEventListener?.('pagehide',()=>{generation++;recognition?.abort();active=false;textarea.readOnly=false;});
 label();return {start:()=>button.onclick(),setBusy:value=>{busy=value;label();},stop,isActive:()=>active||starting};
}
