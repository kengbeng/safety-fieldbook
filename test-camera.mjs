import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
const code=await fs.readFile(new URL('./camera.js',import.meta.url),'utf8');
const {createCameraDialog}=await import('data:text/javascript;base64,'+Buffer.from(code).toString('base64'));
class Element {constructor(){this.events={};this.parentElement={};this.hidden=false;}addEventListener(n,f){this.events[n]=f;}showModal(){this.open=true;}close(){this.open=false;this.events.close?.();}replaceChildren(...x){this.options=x;}}
function fixture(media){
 const nodes=Object.fromEntries(['dialog','video','status','capture','retry','select','cancel','fallback'].map(k=>[k,new Element()]));
 nodes.video.play=async()=>{};nodes.video.readyState=2;nodes.video.videoWidth=1920;nodes.video.videoHeight=1080;
 const documentEvents={},windowEvents={};globalThis.document={hidden:false,addEventListener:(n,f)=>documentEvents[n]=f,createElement:()=>({getContext:()=>({drawImage(){}}),toBlob:fn=>fn(new Blob(['photo'],{type:'image/jpeg'}))})};globalThis.window={addEventListener:(n,f)=>windowEvents[n]=f};globalThis.Option=class{constructor(label,value){this.label=label;this.value=value;}};
 const saved=[],fallback=[];const controller=createCameraDialog({...nodes,media,onPhoto:async(...v)=>saved.push(v),onFallback:t=>fallback.push(t)});
 return {...nodes,controller,saved,fallbackResults:fallback,documentEvents,windowEvents};
}
const tick=()=>new Promise(r=>setImmediate(r));
function fakeStream(){const track={stopped:false,stop(){this.stopped=true;},addEventListener(){},getSettings:()=>({deviceId:'rear'})};return {track,getTracks:()=>[track],getVideoTracks:()=>[track]};}
let s=fakeStream();let f=fixture({getUserMedia:async constraints=>{assert.equal(constraints.audio,false);return s;},enumerateDevices:async()=>[{kind:'videoinput',label:'Rear',deviceId:'rear'},{kind:'videoinput',label:'Front',deviceId:'front'}]});
f.controller.open({inspectionId:'i',findingId:'f'});await tick();assert.equal(f.capture.disabled,false);await f.capture.onclick();assert.equal(f.saved.length,1);assert.equal(f.saved[0][0].type,'image/jpeg');assert.equal(f.saved[0][1].findingId,'f');assert.equal(s.track.stopped,true);assert.equal(f.dialog.open,false);
// A late permission response after cancellation must never leave the camera running.
let resolve;s=fakeStream();f=fixture({getUserMedia:()=>new Promise(r=>resolve=r)});f.controller.open({inspectionId:'i'});f.cancel.onclick();resolve(s);await tick();assert.equal(s.track.stopped,true);assert.equal(f.saved.length,0);
f=fixture({getUserMedia:async()=>{throw Object.assign(new Error(),{name:'NotAllowedError'});}});f.controller.open({inspectionId:'i'});await tick();assert.match(f.status.textContent,/permission was not granted/);assert.equal(f.capture.disabled,true);f.fallback.onclick();assert.equal(f.fallbackResults.length,1);
s=fakeStream();f=fixture({getUserMedia:async()=>s,enumerateDevices:async()=>[]});f.controller.open({inspectionId:'i'});await tick();document.hidden=true;f.documentEvents.visibilitychange();assert.equal(s.track.stopped,true);assert.equal(f.capture.disabled,true);assert.equal(f.retry.hidden,false);
console.log('PASS: camera JPEG capture and target, denied permission fallback, late stream cleanup after cancel, background stop.');

