import assert from 'node:assert/strict';
import {VoiceRecorder,audioExtension} from './voice.js';
import {collectExportFiles} from './export.js';
let stops=0,clock=1000;
const stream=()=>({getTracks:()=>[{stop:()=>stops++}]});
class FakeRecorder {
 static isTypeSupported(type){return type==='audio/webm;codecs=opus';}
 constructor(stream,options){this.mimeType=options.mimeType;this.state='inactive';FakeRecorder.latest=this;}
 start(){this.state='recording';}
 stop(){this.state='inactive';this.ondataavailable({data:new Blob(['voice'],{type:this.mimeType})});queueMicrotask(()=>this.onstop());}
}
const audio=[],states=[],errors=[];
const recorder=new VoiceRecorder({onAudio:x=>audio.push(x),onState:s=>states.push(s),onError:e=>errors.push(e),mediaDevices:{getUserMedia:async()=>stream()},Recorder:FakeRecorder,now:()=>clock});
await recorder.start();clock=3500;recorder.stop();await Promise.resolve();
assert.equal(audio.length,1);assert.equal(audio[0].durationSeconds,2.5);assert.equal(await audio[0].blob.text(),'voice');assert.equal(stops,1);
assert.ok(states.includes('recording'));assert.equal(states.at(-1),'stopped');
await recorder.start();recorder.dispose();await Promise.resolve();assert.equal(audio.length,1);assert.equal(stops,2);
let permissionResolve;
const pending=new VoiceRecorder({onAudio:()=>assert.fail('Canceled recording delivered audio'),mediaDevices:{getUserMedia:()=>new Promise(resolve=>permissionResolve=resolve)},Recorder:FakeRecorder});
const start=pending.start();pending.dispose();permissionResolve(stream());await start;assert.equal(stops,3);
const denied=[];await new VoiceRecorder({onError:e=>denied.push(e),mediaDevices:{getUserMedia:async()=>{throw new Error('permission denied');}},Recorder:FakeRecorder}).start();assert.match(denied[0].message,/permission denied/);
for(const [type,extension] of [['audio/webm;codecs=opus','webm'],['audio/mp4','m4a'],['audio/wav','wav']])assert.equal(audioExtension(type),extension);
const draft={id:'inspection1',title:'Audio test',date:'2026-10-15',inspector:'QA',findings:[{id:'finding1',building:'E3',floor:'2',room:'001',category:'General',priority:'Medium',reviewed:false,description:'Audio finding',photos:[],voiceNotes:[{id:'note1',title:'Access <script>',transcript:'Keep access clear.\nRoom 001.',blob:audio[0].blob,durationSeconds:2.5}]}]};
for(const mode of ['share','archive','full']){
 const {files,folder,metadata}=await collectExportFiles(draft,{mode});const note=metadata.findings[0].voiceNotes[0];
 assert.equal(await files.find(f=>f.name===folder+'/'+note.audio).blob.text(),'voice');assert.equal(note.durationSeconds,2.5);
 assert.equal(await files.find(f=>f.name===folder+'/'+note.transcriptPath).blob.text(),'Keep access clear.\nRoom 001.');
 assert.ok(files.find(f=>f.name===folder+'/audio.csv'));assert.equal(note.blob,undefined);
 const report=await files.find(f=>f.name===folder+'/START-HERE.html').blob.text();assert.ok(report.includes('<audio controls'));assert.ok(report.includes('Keep access clear.'));assert.ok(!report.includes('<script>'));
}
console.log('PASS: recording, duration, track cleanup, cancellation, denied permission, MIME extensions and exact audio/transcript export in all profiles.');
