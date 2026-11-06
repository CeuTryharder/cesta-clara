export async function requestMicrophone(mediaDevices){
 if(!mediaDevices?.getUserMedia)throw new Error('Este navegador no ofrece acceso al micrófono.');
 const stream=await mediaDevices.getUserMedia({audio:true,video:false});
 for(const track of stream.getTracks())track.stop();
 return true;
}
if(typeof document!=='undefined'){
 const button=document.getElementById('enable'),status=document.getElementById('status');
 button.onclick=async()=>{button.disabled=true;try{await requestMicrophone(navigator.mediaDevices);status.textContent='Micrófono permitido. Abriendo tu lista para dictar…';location.replace(chrome.runtime.getURL('panel.html')+'?voice=1');}catch(e){status.textContent=e.name==='NotAllowedError'?'Chrome o Windows bloquea el micrófono. Abre los ajustes y permite el acceso para Cesta Clara. Si tu organización lo administra, puede requerir cambiar esa política.':'No se ha podido acceder al micrófono: '+e.message;}finally{button.disabled=false;}};
 document.getElementById('settings').onclick=()=>chrome.tabs.create({url:'chrome://settings/content/microphone',active:true});
}
