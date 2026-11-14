import {Transfer,config} from './transfer.mjs';
// Vendored QR libraries are loaded only when this dialog is opened.
const script=path=>new Promise((resolve,reject)=>{const s=document.createElement('script');s.src=new URL(path,import.meta.url);s.onload=resolve;s.onerror=()=>reject(Error('QR support could not load. Use ZIP export/import.'));document.head.append(s);});
let qrReady,scanReady;
export async function openTransfer({role,prepare,importFile}){
 const d=document.createElement('dialog');d.className='device-transfer';d.setAttribute('aria-label',role==='sender'?'Send to Report Studio':'Receive from Safety Fieldbook');
 d.innerHTML=`<h2>${role==='sender'?'Send to Report Studio':'Receive from Safety Fieldbook'}</h2><p>Keep both apps open. Your original inspection stays on the phone.</p><p data-status role="status" aria-live="polite">Starting…</p><div data-qr></div><video playsinline muted hidden aria-label="Scan Report Studio QR"></video><p data-code hidden></p><button type="button" data-verify hidden>The codes match</button><p data-file></p><button type="button" data-action hidden>${role==='sender'?'Send Compact ZIP':'Accept and import ZIP'}</button><progress hidden max="1" value="0" aria-label="ZIP transfer progress"></progress><details data-manual hidden><summary>Pair without camera</summary><label>Pairing code<textarea rows="3" autocomplete="off" spellcheck="false"></textarea></label><button type="button" data-pair>Pair</button></details><p>ZIP export and import remain available if the connection fails.</p><button type="button" data-close>Close</button>`;
 document.body.append(d);d.showModal();const $=s=>d.querySelector(s),status=s=>$('[data-status]').textContent=s;let t,stream,stopped=false,tick;
 const stopCamera=()=>{clearTimeout(tick);stream?.getTracks().forEach(t=>t.stop());$('video').hidden=true;};
 const close=()=>{stopped=true;stopCamera();t?.close();d.close();d.remove();};$('[data-close]').onclick=close;d.addEventListener('cancel',e=>{e.preventDefault();close();});
 const fatal=e=>{stopCamera();status(e.message+' You can close this window and try again.');$('[data-action]').hidden=$('[data-verify]').hidden=true;};
 try{
 const c=await config();if(stopped)return;
 t=new Transfer(c,{status,verify:code=>{stopCamera();$('[data-qr]').replaceChildren();$('[data-manual]').hidden=true;$('[data-code]').hidden=false;$('[data-code]').textContent='Verification code: '+code;$('[data-verify]').hidden=false;},progress:(n,total)=>{const p=$('progress');p.hidden=false;p.max=total;p.value=n;},incoming:m=>{$('[data-file]').textContent=m.name+' · '+(m.size/1024/1024).toFixed(2)+' MB. Import into the current report? Existing duplicate and version rules apply.';$('[data-action]').hidden=false;},importFile,complete:()=>{$('[data-action]').hidden=$('[data-verify]').hidden=true;},error:fatal});
 $('[data-verify]').onclick=()=>{try{t.confirm();$('[data-verify]').hidden=true;}catch(e){t.fail(e);}};
 if(role==='receiver'){
 const text=await t.receive();if(stopped){t.close();return;}
 await(qrReady??=script('./transfer-vendor/qrcode.js'));if(stopped)return;const qr=globalThis.qrcode(0,'M');qr.addData(text);qr.make();$('[data-qr]').innerHTML=qr.createSvgTag({cellSize:4,margin:4,scalable:true});const svg=$('[data-qr] svg');svg.setAttribute('role','img');svg.setAttribute('aria-label','One-time Report Studio pairing QR code');
 const expiry=document.createElement('p');expiry.textContent='On the phone, open an inspection → Export → Send to Report Studio. QR expires in five minutes.';$('[data-qr]').append(expiry);
 const details=document.createElement('details'),summary=document.createElement('summary'),code=document.createElement('textarea');summary.textContent='Copy pairing code instead';code.value=text;code.readOnly=true;code.setAttribute('aria-label','One-time pairing code');details.append(summary,code);$('[data-qr]').append(details);status('Ready to pair. Scan this QR with Safety Fieldbook.');
 $('[data-action]').onclick=()=>{try{t.accept();$('[data-action]').hidden=true;}catch(e){t.fail(e);}};
 }else{
 let paired=false;const pair=async text=>{if(paired||stopped)return;paired=true;stopCamera();$('[data-pair]').disabled=true;try{await t.send(text);}catch(e){t.fail(e);}};
 $('[data-manual]').hidden=false;$('[data-pair]').onclick=()=>pair($('textarea').value.trim());
 t.onready=()=>{$('[data-action]').hidden=false;};
 $('[data-action]').onclick=async()=>{$('[data-action]').hidden=true;try{status('Preparing existing Compact ZIP…');const{blob,name}=await prepare(status);if(!stopped)await t.offer(blob,name);}catch(e){t.fail(e);}};
 status('Scan the QR displayed in Report Studio.');
 try{await(scanReady??=script('./transfer-vendor/jsQR.js'));if(stopped)return;stream=await navigator.mediaDevices.getUserMedia({audio:false,video:{facingMode:{ideal:'environment'},width:{ideal:960}}});if(stopped||paired){stopCamera();return;}const video=$('video');video.hidden=false;video.srcObject=stream;await video.play();const canvas=document.createElement('canvas'),ctx=canvas.getContext('2d',{willReadFrequently:true});const scan=()=>{if(stopped||paired)return;try{if(video.readyState>=2){canvas.width=video.videoWidth;canvas.height=video.videoHeight;ctx.drawImage(video,0,0);const pixels=ctx.getImageData(0,0,canvas.width,canvas.height),result=globalThis.jsQR(pixels.data,pixels.width,pixels.height,{inversionAttempts:'dontInvert'});if(result){pair(result.data);return;}}tick=setTimeout(scan,200);}catch(e){stopCamera();status('Camera scanning failed. Paste the pairing code below.');}};scan();}catch(e){if(!stopped&&!paired)status('Camera unavailable or permission denied. Allow camera access, or paste the pairing code below.');}
 }
 }catch(e){t?.close();fatal(e);}
}
