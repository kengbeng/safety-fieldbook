export const SPEECH_MODEL = 'Xenova/whisper-tiny.en';
export const SPEECH_REVISION = '79fb389fc764e7c395bd330e9531d9d32ada7049';
export const SPEECH_CACHE = `fieldbook-local-asr:${new URL('./',import.meta.url).pathname}:v1`;
export const READY_URL = new URL('./__local-asr-ready.json',import.meta.url).href;
export const RUNTIME_FILES = ['transformers.min.js','ort-wasm-simd-threaded.jsep.mjs','ort-wasm-simd-threaded.jsep.wasm'];
export async function speechPrepared(){
  const cache=await caches.open(SPEECH_CACHE),marker=await cache.match(READY_URL);
  if(!marker)return false;
  try{const data=await marker.json();if(data.model!==SPEECH_MODEL||data.revision!==SPEECH_REVISION)return false;
    for(const url of data.assets)if(!(await cache.match(url)))return false;
    return data.assets.length>=RUNTIME_FILES.length+3;
  }catch{return false;}
}
export function shouldApplyTranscript(baseline,current){return baseline===current;}
