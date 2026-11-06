// Camera streams stay local and are stopped on close, backgrounding or navigation.
export function createCameraDialog({dialog, video, status, capture, retry, select, cancel, fallback, onPhoto, onFallback, media=navigator.mediaDevices}) {
 let stream=null, generation=0, target=null, busy=false;
 const stopTracks=s=>s?.getTracks().forEach(t=>t.stop());
 function stop(){generation++;stopTracks(stream);stream=null;video.srcObject=null;capture.disabled=true;}
 function close(){stop();target=null;if(dialog.open)dialog.close();}
 function message(error){return error?.name==='NotAllowedError'?'Camera permission was not granted. Allow camera access in your browser and Windows settings, then try again, or add existing images.':error?.name==='NotFoundError'?'No camera was found. Connect a camera or add existing images.':'The camera could not start. It may be in use by another app. Try again or add existing images.';}
 async function start(deviceId){
  stop();const request=generation;retry.hidden=true;select.disabled=true;status.textContent='Allow camera access when your browser asks…';
  if(!media?.getUserMedia){status.textContent='Camera access is unavailable in this browser. Open the HTTPS app in Edge or Chrome, or add existing images.';return;}
  try{
   const next=await media.getUserMedia({audio:false,video:deviceId?{deviceId:{exact:deviceId},width:{ideal:1920},height:{ideal:1080}}:{facingMode:{ideal:'environment'},width:{ideal:1920},height:{ideal:1080}}});
   if(request!==generation||!dialog.open){stopTracks(next);return;}
   stream=next;video.srcObject=next;await video.play();
   if(request!==generation)return;
   status.textContent='Position the camera, then capture a photo. The photo is saved only on this device.';
   capture.disabled=video.readyState<2;
   next.getVideoTracks()[0]?.addEventListener('ended',()=>{if(stream===next){stop();status.textContent='The camera stopped. Try again or add existing images.';retry.hidden=false;}});
   try{
    const devices=(await media.enumerateDevices()).filter(d=>d.kind==='videoinput');
    if(request!==generation)return;
    select.replaceChildren(...devices.map((d,i)=>new Option(d.label||`Camera ${i+1}`,d.deviceId)));
    select.value=next.getVideoTracks()[0]?.getSettings().deviceId||'';
    select.parentElement.hidden=devices.length<2;select.disabled=false;
   }catch{select.parentElement.hidden=true;}
  }catch(e){if(request!==generation)return;stop();status.textContent=message(e);retry.hidden=false;}
 }
 video.addEventListener('loadeddata',()=>{if(stream&&!busy&&dialog.open)capture.disabled=false;});
 capture.onclick=async()=>{
  if(busy||!stream||!video.videoWidth||!video.videoHeight)return;
  const request=generation, destination=target;busy=true;capture.disabled=true;select.disabled=true;status.textContent='Preparing photo…';
  try{
   const canvas=document.createElement('canvas');canvas.width=video.videoWidth;canvas.height=video.videoHeight;
   canvas.getContext('2d').drawImage(video,0,0);
   const blob=await new Promise((resolve,reject)=>canvas.toBlob(b=>b?resolve(b):reject(new Error('Photo encoding failed')),'image/jpeg',.95));
   if(request!==generation||!dialog.open)return;
   const file=new File([blob],`Camera-${new Date().toISOString().replace(/[:.]/g,'-')}.jpg`,{type:'image/jpeg'});
   close();await onPhoto(file,destination);
  }catch{if(request===generation){status.textContent='The photo could not be captured. Try again or add existing images.';capture.disabled=false;select.disabled=false;}}
  finally{busy=false;}
 };
 retry.onclick=()=>start();select.onchange=()=>start(select.value);cancel.onclick=close;
 fallback.onclick=()=>{const destination=target;close();onFallback(destination);};
 dialog.addEventListener('cancel',close);dialog.addEventListener('close',stop);
 document.addEventListener('visibilitychange',()=>{if(document.hidden&&dialog.open){stop();status.textContent='Camera paused while the app was in the background. Select Try again to restart.';retry.hidden=false;}});
 window.addEventListener('pagehide',close);
 return {open(destination){target=destination;select.parentElement.hidden=true;dialog.showModal();start();},close};
}
