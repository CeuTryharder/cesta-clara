import {test} from 'node:test';
import assert from 'node:assert/strict';
import {JSDOM} from 'jsdom';
import {setupDictation,formatDictation} from '../extension/voice.js';
function fixture(supported=true,startImmediate=true,{endImmediate=true,onTranscript=()=>false,onSessionEnd=()=>{}}={}){
 const dom=new JSDOM('<button id="voice"></button><textarea id="text"></textarea><p id="status"></p>'),w=dom.window,created=[],changes=[];
 class Recognition{constructor(){created.push(this);}start(){this.started=true;if(startImmediate)this.onstart?.();}stop(){this.stopped=true;this.stopCalls=(this.stopCalls||0)+1;if(endImmediate)this.onend?.();}abort(){this.aborted=true;}}
 if(supported)w.webkitSpeechRecognition=Recognition;
 const button=w.document.getElementById('voice'),status=w.document.getElementById('status'),textarea=w.document.getElementById('text');
 const controller=setupDictation({environment:w,button,status,textarea,onChange:()=>changes.push(textarea.value),onTranscript,onSessionEnd});
 const emit=(recognition,text,index=0,final=true)=>{const result=Object.assign([{transcript:text}],{isFinal:final}),results=[];results[index]=result;recognition.onresult({resultIndex:index,results});};
 return {dom,w,created,button,status,textarea,changes,controller,emit};
}
test('El micrófono nunca se inicia al cargar el panel',()=>{const f=fixture();assert.equal(f.created.length,0);assert.equal(f.button.getAttribute('aria-pressed'),'false');f.dom.window.close();});
test('Dicta en español, añade texto sin borrar la lista y no compara automáticamente',()=>{const f=fixture();f.textarea.value='4 l de leche';f.button.click();assert.equal(f.created[0].lang,'es-ES');f.emit(f.created[0],'un kilo de filetes de vacuno');assert.equal(f.textarea.value,'4 l de leche\nun kilo de filetes de vacuno');assert.equal(f.changes.length,1);assert.equal(f.controller.isActive(),true);f.dom.window.close();});
test('Los resultados provisionales no se insertan y los definitivos no se duplican',()=>{const f=fixture();f.button.click();f.emit(f.created[0],'un kilo',0,false);assert.equal(f.textarea.value,'');f.emit(f.created[0],'un kilo de ternera',0,true);f.emit(f.created[0],'un kilo de ternera',0,true);assert.equal(f.changes.length,1);assert.equal(f.textarea.value,'un kilo de ternera');f.dom.window.close();});
test('Detener termina la escucha y deja el texto editable',()=>{const f=fixture();f.button.click();assert.equal(f.textarea.readOnly,true);f.button.click();assert.equal(f.created[0].stopped,true);assert.equal(f.textarea.readOnly,false);assert.match(f.status.textContent,/Revisa el texto/);f.dom.window.close();});
test('Rechazar el permiso del micrófono muestra un mensaje y conserva el borrador',()=>{const f=fixture();f.textarea.value='12 huevos';f.button.click();f.created[0].onerror({error:'not-allowed'});assert.match(f.status.textContent,/permiso|permitido/);assert.equal(f.textarea.value,'12 huevos');assert.equal(f.controller.isActive(),false);f.dom.window.close();});
test('La falta de API de voz deja disponible la entrada escrita',()=>{const f=fixture(false);assert.equal(f.button.disabled,true);assert.match(f.status.textContent,/no está disponible/);assert.equal(f.textarea.readOnly,false);f.dom.window.close();});
test('Al cerrar el panel se aborta el reconocimiento y se ignoran mensajes posteriores',()=>{const f=fixture();f.button.click();f.w.dispatchEvent(new f.w.Event('pagehide'));assert.equal(f.created[0].aborted,true);f.emit(f.created[0],'otra compra');assert.equal(f.textarea.value,'');f.dom.window.close();});
test('El dictado conserva porcentajes, separa productos y normaliza controles hablados',()=>{assert.equal(formatDictation('un kilo de ternera picada coma mínimo noventa y siete por ciento de carne nueva línea cuatro litros de leche'),'un kilo de ternera picada , mínimo 97 % de carne\ncuatro litros de leche');});
test('El límite de longitud detiene la captura sin truncar una condición del producto',()=>{const f=fixture();f.textarea.value='a'.repeat(4990);f.button.click();f.emit(f.created[0],'ternera 97 por ciento');assert.equal(f.textarea.value.length,4990);assert.equal(f.created[0].stopped,true);f.dom.window.close();});
test('Salir mientras espera el permiso aborta el inicio e ignora una activación tardía',()=>{const f=fixture(true,false);f.button.click();assert.equal(f.controller.isActive(),true);f.controller.stop();assert.equal(f.created[0].aborted,true);assert.equal(f.controller.isActive(),false);f.created[0].onstart();f.emit(f.created[0],'un kilo de carne');assert.equal(f.textarea.value,'');assert.equal(f.textarea.readOnly,false);f.dom.window.close();});
test('Detener con el botón conserva el último resultado pendiente hasta que termina la sesión',async()=>{
 const ended=[],f=fixture(true,true,{endImmediate:false,onSessionEnd:result=>ended.push(result)});
 f.button.click();f.emit(f.created[0],'un kilo de ternera',0,false);f.button.click();
 assert.equal(f.controller.isActive(),true);assert.equal(f.button.disabled,true);assert.equal(ended.length,0);
 f.emit(f.created[0],'un kilo de ternera picada 97 por ciento',0,true);
 assert.equal(f.textarea.value,'un kilo de ternera picada 97 %');
 assert.match(f.status.textContent,/Terminando/);
 await Promise.resolve();f.created[0].onend();
 assert.deepEqual(ended,[{error:false}]);assert.equal(f.controller.isActive(),false);assert.equal(f.textarea.readOnly,false);assert.equal(f.button.disabled,false);
 f.dom.window.close();
});
test('Un comando descarta otros resultados del mismo evento y los tardíos antes de onend',async()=>{
 const heard=[],ended=[];let f;
 f=fixture(true,true,{endImmediate:false,onTranscript:text=>{
  heard.push(text);if(text!=='comparar')return false;
  f.controller.stop('',{discardPending:true});return true;
 },onSessionEnd:result=>ended.push(result)});
 f.button.click();const recognition=f.created[0];
 recognition.onresult({resultIndex:0,results:['4 l leche','comparar','marca blanca','12 huevos'].map(transcript=>Object.assign([{transcript}],{isFinal:true}))});
 f.emit(recognition,'preparar cesta en DIA',4);
 assert.deepEqual(heard,['4 l leche','comparar']);assert.equal(f.textarea.value,'4 l leche');assert.equal(ended.length,0);assert.equal(recognition.stopCalls,1);
 await Promise.resolve();recognition.onend();assert.deepEqual(ended,[{error:false}]);
 f.button.click();f.emit(f.created[1],'12 huevos');assert.equal(f.textarea.value,'4 l leche\n12 huevos');
 f.emit(recognition,'1 kg arroz',5);assert.equal(f.textarea.value,'4 l leche\n12 huevos');
 f.dom.window.close();
});
test('Una orden final pendiente puede descartar lo restante sin detener dos veces el reconocimiento',async()=>{
 const heard=[];let f;f=fixture(true,true,{endImmediate:false,onTranscript:text=>{
  heard.push(text);if(text!=='parar')return false;
  f.controller.stop('',{discardPending:true});return true;
 }});
 f.button.click();f.button.click();
 f.created[0].onresult({resultIndex:0,results:['parar','marca blanca'].map(transcript=>Object.assign([{transcript}],{isFinal:true}))});
 assert.deepEqual(heard,['parar']);assert.equal(f.created[0].stopCalls,1);assert.equal(f.textarea.value,'');
 await Promise.resolve();f.created[0].onend();assert.equal(f.controller.isActive(),false);f.dom.window.close();
});
