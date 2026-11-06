export function issueCode(value){
 const text=String(value?.message??value??'');
 if(/No tab with id|Invalid tab ID|tab.*closed/i.test(text))return 'tab-closed';
 if(/403|429|forbidden|access denied|captcha|bloque[oó]|detuvo la consulta/i.test(text))return 'blocked';
 if(/robots\.txt|ruta.*excluida|recogida.*excluida/i.test(text))return 'excluded';
 if(/permission|Cannot access|Missing host|permite|permitido|permis/i.test(text))return 'permission';
 if(/404|410/i.test(text))return 'not-found';
 if(/zona|inicia.*sesi[oó]n|login/i.test(text))return 'location';
 if(/fetch|network|timeout|timed out|conexi[oó]n|HTTP 5\d\d/i.test(text))return 'network';
 return 'check-needed';
}
export function friendlyIssue(value,store='La tienda'){
 const text=String(value?.message??value??'').replace(/\s+/g,' ').trim(),code=issueCode(text);
 if(text.length<240&&!/[<>]/.test(text)&&/^(?:No has permitido|Elige tu zona)\b/.test(text))return text;
 const messages={
  'tab-closed':'La pestaña de la tienda se cerró. Pulsa Continuar para reabrirla.',
  blocked:store+' no ha permitido la consulta automática. Puedes reintentarlo más tarde.',
  excluded:'Esta página no permite la recogida automática de precios.',
  permission:'Permite el acceso a la tienda para continuar.',
  'not-found':'La ficha ya no está disponible. Actualiza los precios para buscar otra.',
  location:'Abre la tienda, revisa la zona o la sesión y vuelve a intentarlo.',
  network:'No se ha podido conectar con '+store+'. Vuelve a intentarlo.'
 };
 if(messages[code])return messages[code];
 if(text.length<=240&&!/[<>]|https?:\/\/|Error:|\bat \w+\s*\(/i.test(text))return text||'No se ha podido completar la consulta.';
 return 'No se ha podido completar la consulta. Puedes reintentarlo; el diagnóstico guarda el estado de las tiendas.';
}
