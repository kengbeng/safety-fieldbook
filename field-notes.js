import {renderPhoto} from './export.js';
import {bytesBlob} from './photo-data.js';

export function fieldNotesFilename(draft) {
  return `${String(draft.date || 'undated')}_${String(draft.title || 'inspection').replace(/[^\p{L}\p{N}_-]+/gu,'-').slice(0,70)}_field-notes.pdf`;
}

// Canvas text uses the device's Unicode fonts, keeping multilingual observations readable.
// Pages are embedded individually to bound memory use on mobile devices.
export async function makeFieldNotes(draft,{photos=true,annotations=true,paper='a4',onProgress=()=>{},exportedAt=new Date()}={}) {
  if(!globalThis.jspdf?.jsPDF)throw new Error('PDF tools are unavailable. Open the app online once, then try again.');
  const pdf=new globalThis.jspdf.jsPDF({unit:'pt',format:paper,compress:true});
  const W=1240,H=Math.round(W*pdf.internal.pageSize.getHeight()/pdf.internal.pageSize.getWidth()),left=90,right=W-left,bottom=H-110;
  const canvas=document.createElement('canvas');canvas.width=W;canvas.height=H;
  const ctx=canvas.getContext('2d');let y=0,page=0;
  function start(){ctx.fillStyle='#fff';ctx.fillRect(0,0,W,H);ctx.fillStyle='#ef7c00';ctx.fillRect(left,55,right-left,5);ctx.font='24px Arial';ctx.fillStyle='#003d7c';ctx.fillText('Safety Fieldbook | Field notes',left,94);y=145;}
  function flush(){ctx.fillStyle='#64748b';ctx.font='18px Arial';ctx.fillText(`Exported ${exportedAt.toLocaleString()} | Safety Fieldbook v1.3.0`,left,H-56);ctx.textAlign='right';ctx.fillText(String(++page),right,H-56);ctx.textAlign='left';if(page>1)pdf.addPage();pdf.addImage(canvas.toDataURL('image/jpeg',.94),'JPEG',0,0,pdf.internal.pageSize.getWidth(),pdf.internal.pageSize.getHeight());}
  function space(height){if(y+height>bottom){flush();start();}}
  function text(value,{size=25,color='#25384a',bold=false}={}){ctx.font=`${bold?'bold ':''}${size}px Arial`;ctx.fillStyle=color;
    const draw=line=>{space(size*1.5);ctx.font=`${bold?'bold ':''}${size}px Arial`;ctx.fillStyle=color;ctx.fillText(line,left,y);y+=size*1.45;};
    for(const paragraph of String(value??'').split('\n')){let line='';const words=paragraph.match(/\s+|\S+/gu)||[''];for(const word of words){if(ctx.measureText(line+word).width<=right-left){line+=word;continue;}if(line){draw(line);line='';}if(ctx.measureText(word).width<=right-left){line=word;continue;}for(const char of word){if(ctx.measureText(line+char).width>right-left){draw(line);line='';}line+=char;}}draw(line);}y+=10;}
  start();text('Field notes - raw observations',{size:36,bold:true,color:'#003d7c'});text(draft.title||'Untitled inspection',{size:30});text(`Inspection date: ${draft.date||'Not specified'}\nInspector: ${draft.inspector||'Not specified'}`,{size:23});
  text('Contains observations recorded during the inspection. Findings have not been independently verified.',{size:21,color:'#64748b'});
  text('Photos are '+(photos?(annotations?'included with saved annotations.':'included without annotations.'):'omitted.')+' Audio recordings are not embedded; saved transcript text is included.',{size:21,color:'#64748b'});
  const warnings=[];let done=0;const total=draft.findings.reduce((n,f)=>n+(photos?f.photos.length:0),0);
  for(const [index,f] of draft.findings.entries()){
    space(160);y+=20;text(`Finding ${String(index+1).padStart(2,'0')}`,{size:30,bold:true,color:'#003d7c'});
    text('Location: '+([f.building,f.floor?'Floor '+f.floor:'',f.room?'Room '+f.room:''].filter(Boolean).join(' / ')||'Not specified'),{size:23});
    text(f.description||'Description not entered.');
    for(const note of f.voiceNotes||[]){text(`Voice note: ${note.title||'Audio note'}`,{size:23,bold:true});text(note.transcript||'No transcript entered. Audio is available in the ZIP export.',{size:23});}
    if(!f.photos.length)text('No photos attached.',{size:22,color:'#64748b'});
    if(photos)for(const [photoIndex,p] of f.photos.entries()){
      onProgress(++done,total);let image;
      try{const rendered=await renderPhoto({...p,blob:bytesBlob(p),annotations:annotations?(p.annotations||[]):[]},{type:'image/jpeg',maxEdge:1800,quality:.88});image=await createImageBitmap(rendered.blob);const scale=Math.min((right-left)/image.width,650/image.height),w=image.width*scale,h=image.height*scale;space(h+65);ctx.drawImage(image,left,y,w,h);y+=h+32;text(`Photo ${index+1}.${photoIndex+1}${annotations?' | Saved annotations included':''}`,{size:20,color:'#64748b'});}
      catch{const warning=`Finding ${index+1}, photo ${photoIndex+1}: photo unavailable.`;warnings.push(warning);text(warning,{size:23,color:'#9b3300'});}
      finally{image?.close();}
      await new Promise(resolve=>setTimeout(resolve,0));
    }
  }
  if(!draft.findings.length)text('No findings recorded.');flush();pdf.setProperties({title:`${draft.title} - Field notes`,subject:'Raw on-site observations',creator:'Safety Fieldbook v1.3.0'});
  canvas.width=canvas.height=1;return {blob:pdf.output('blob'),warnings,pages:page};
}
