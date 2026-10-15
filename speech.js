import {SPEECH_CACHE,speechPrepared} from './speech-cache.js';
export class LocalTranscriber {
  constructor(){this.worker=null;this.pending=new Map();this.nextId=0;this.generation=0;}
  static supported(){return typeof Worker!=='undefined'&&typeof WebAssembly!=='undefined'&&!!globalThis.caches&&(!!globalThis.AudioContext||!!globalThis.webkitAudioContext);}
  prepared(){return speechPrepared();}
  request(type,details={},onProgress=()=>{}){
    if(!this.worker){
      this.worker=new Worker(new URL('./speech-worker.js',import.meta.url),{type:'module'});
      this.worker.onmessage=({data})=>{
        const job=this.pending.get(data.id);if(!job)return;
        if(data.type==='progress')job.onProgress(data.message);
        else{this.pending.delete(data.id);data.type==='error'?job.reject(new Error(data.message)):job.resolve(data.result);}
      };
      this.worker.onerror=()=>this.cancel(new Error('The local speech engine stopped. Try again, or use a shorter recording.'));
    }
    const id=++this.nextId;
    return new Promise((resolve,reject)=>{this.pending.set(id,{resolve,reject,onProgress});this.worker.postMessage({id,type,...details},details.samples?[details.samples.buffer]:[]);});
  }
  async prepare(onProgress){if(!LocalTranscriber.supported())throw new Error('On-device transcription is not supported here. Audio recording and manual text remain available.');return this.request('prepare',{},onProgress);}
  async transcribe(blob,onProgress){
    const generation=this.generation;
    onProgress?.('Decoding audio on this device…');
    const Context=globalThis.AudioContext||globalThis.webkitAudioContext,context=new Context();let decoded;
    try{decoded=await context.decodeAudioData(await blob.arrayBuffer());}finally{await context.close();}
    if(generation!==this.generation)throw new Error('Transcription cancelled.');
    if(decoded.duration>300)throw new Error('Transcribe recordings of up to five minutes. Split longer audio into shorter notes.');
    const offline=new OfflineAudioContext(1,Math.max(1,Math.ceil(decoded.duration*16000)),16000),source=offline.createBufferSource();source.buffer=decoded;source.connect(offline.destination);source.start();
    const samples=(await offline.startRendering()).getChannelData(0).slice();
    if(generation!==this.generation)throw new Error('Transcription cancelled.');
    let power=0;for(let i=0;i<samples.length;i++)power+=samples[i]*samples[i];
    if(!samples.length||Math.sqrt(power/samples.length)<.0005)return '';
    return this.request('transcribe',{samples},onProgress);
  }
  cancel(error=new Error('Local transcription cancelled.')){this.generation++;this.worker?.terminate();this.worker=null;for(const job of this.pending.values())job.reject(error);this.pending.clear();}
  async remove(){this.cancel();await caches.delete(SPEECH_CACHE);}
}
