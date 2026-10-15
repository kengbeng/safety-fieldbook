import {SPEECH_MODEL,SPEECH_REVISION,SPEECH_CACHE,READY_URL,RUNTIME_FILES} from './speech-cache.js';
let engine,loading;
const progress=(id,message)=>self.postMessage({id,type:'progress',message});
async function load(id){
  if(engine)return engine;
  if(loading)return loading;
  loading=(async()=>{
    const cache=await caches.open(SPEECH_CACHE);
    for(const file of RUNTIME_FILES){
      const url=new URL(file,import.meta.url).href;
      if(!(await cache.match(url))){progress(id,`Downloading speech runtime: ${file.endsWith('.wasm')?'inference engine (about 22 MB)':file}`);
        const response=await fetch(url,{cache:'no-cache'});if(!response.ok)throw new Error(`Speech runtime download failed (${response.status}).`);await cache.put(url,response);}
    }
    const {pipeline,env}=await import('./transformers.min.js');
    env.allowLocalModels=false;env.useBrowserCache=false;env.useFSCache=false;env.useCustomCache=true;
    env.customCache={match:key=>cache.match(key),put:(key,response)=>cache.put(key,response)};
    env.backends.onnx.wasm.numThreads=1;env.backends.onnx.wasm.proxy=false;
    env.backends.onnx.wasm.wasmPaths=new URL('./',import.meta.url).href;
    progress(id,'Loading English speech model on this device…');
    engine=await pipeline('automatic-speech-recognition',SPEECH_MODEL,{revision:SPEECH_REVISION,dtype:'q8',device:'wasm',
      progress_callback:event=>{
        if(event.status==='progress')progress(id,`Downloading ${event.file}: ${Math.round(event.progress||0)}%`);
        else if(event.status==='initiate')progress(id,`Preparing ${event.file}…`);
      }});
    const assets=(await cache.keys()).map(r=>r.url).filter(url=>url!==READY_URL);
    await cache.put(READY_URL,new Response(JSON.stringify({model:SPEECH_MODEL,revision:SPEECH_REVISION,assets}),{headers:{'Content-Type':'application/json'}}));
    return engine;
  })().catch(error=>{loading=null;engine=null;throw error;});
  return loading;
}
self.onmessage=async({data})=>{
  const {id,type}=data;
  try{
    const transcribe=await load(id);
    if(type==='prepare'){self.postMessage({id,type:'result',result:true});return;}
    progress(id,'Transcribing locally… Keep this page open.');
    const result=await transcribe(data.samples,{chunk_length_s:20,stride_length_s:3,return_timestamps:false,max_new_tokens:128,do_sample:false});
    self.postMessage({id,type:'result',result:String(result.text||'').trim()});
  }catch(error){self.postMessage({id,type:'error',message:error.message||String(error)});}
};
