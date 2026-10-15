// Local-only recording. This module never sends audio to a transcription service.
export class VoiceRecorder {
  constructor({onAudio, onState = () => {}, onError = () => {}, mediaDevices = globalThis.navigator?.mediaDevices,
    Recorder = globalThis.MediaRecorder, now = () => Date.now()} = {}) {
    Object.assign(this, {onAudio,onState,onError,mediaDevices,Recorder,now});
    this.generation = 0; this.stream = null; this.recorder = null; this.timer = null;
  }
  static supported() { return !!globalThis.navigator?.mediaDevices?.getUserMedia && !!globalThis.MediaRecorder; }
  async start() {
    if(this.recorder?.state === 'recording') return;
    const generation = ++this.generation;
    this.onState('starting');
    try {
      if(!this.mediaDevices?.getUserMedia || !this.Recorder) throw new Error('Recording is unavailable in this browser. Attach an audio file instead.');
      const stream = await this.mediaDevices.getUserMedia({audio:true});
      if(generation !== this.generation) { stream.getTracks().forEach(track=>track.stop()); return; }
      this.stream = stream;
      const type = ['audio/webm;codecs=opus','audio/mp4','audio/webm','audio/ogg;codecs=opus'].find(t=>this.Recorder.isTypeSupported?.(t));
      const recorder = new this.Recorder(stream, {...(type?{mimeType:type}:{}),audioBitsPerSecond:64000});
      this.recorder = recorder;
      const chunks = []; let failed = false;
      recorder.ondataavailable = event => { if(event.data.size) chunks.push(event.data); };
      recorder.onerror = event => { failed=true;this.onError(event.error || new Error('Recording failed. Try attaching an audio file.'));this.stop(); };
      recorder.onstop = () => {
        const durationSeconds = Math.max(0,(this.now()-this.startedAt)/1000);
        if(generation !== this.generation) return;
        this.release();
        if(!failed) {
          const blob = new Blob(chunks, {type:recorder.mimeType || chunks[0]?.type || 'application/octet-stream'});
          if(blob.size) this.onAudio({blob,durationSeconds});
          else this.onError(new Error('No audio was captured. Try again.'));
        }
        this.onState('stopped');
      };
      this.startedAt = this.now(); recorder.start(1000);
      this.timer = setInterval(()=>{
        if(generation !== this.generation) return;
        const seconds=(this.now()-this.startedAt)/1000;
        this.onState('recording',seconds);
        if(seconds>=300) this.stop();
      },1000);
      this.onState('recording',0);
    } catch(error) {
      if(generation===this.generation) { this.release();this.onState('stopped');this.onError(error); }
    }
  }
  stop() {
    if(this.recorder?.state === 'recording' || this.recorder?.state === 'paused') {
      this.onState('stopping'); this.recorder.stop();
    }
  }
  release() {
    clearInterval(this.timer);this.timer=null;
    this.stream?.getTracks().forEach(track=>track.stop());this.stream=null;this.recorder=null;
  }
  dispose() {
    ++this.generation;
    try { if(this.recorder && this.recorder.state!=='inactive') this.recorder.stop(); }
    finally { this.release(); }
  }
}
export function audioExtension(type) {
  return ({'audio/mp4':'m4a','audio/webm':'webm','audio/ogg':'ogg','audio/mpeg':'mp3','audio/wav':'wav','audio/x-wav':'wav','audio/aac':'aac'})[String(type||'').split(';')[0]] || 'audio';
}
