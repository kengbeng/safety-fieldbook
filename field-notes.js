import {renderPhoto} from './export.js';
import {bytesBlob,decodePhoto} from './photo-data.js';
export function fieldNotesFilename(draft) {
  return `${String(draft.date || 'undated')}_${String(draft.title || 'inspection').replace(/[^\p{L}\p{N}_-]+/gu,'-').slice(0,70)}_field-notes.pdf`;
}
// Fit a photo row into remaining space without distortion or tiny images.
export function photoRowLayout(images,available,width=1080){
  const gap=24,cell=(width-gap*(images.length-1))/images.length;
  const desired=Math.min(500,Math.max(...images.map(i=>cell*i.height/i.width)));
  const minimum=Math.min(210,desired*.6);
  if(available-48<minimum)return null;
  const height=Math.min(desired,available-48);
  return {height,items:images.map(i=>{const scale=Math.min(cell/i.width,height/i.height);return {width:i.width*scale,height:i.height*scale};}),cell,gap};
}
// Device Unicode fonts preserve multilingual observations; pages are embedded separately.
export async function makeFieldNotes(draft,{photos=true,annotations=true,onProgress=()=>{},exportedAt=new Date()}={}) {
  if(!globalThis.jspdf?.jsPDF)throw new Error('PDF tools are unavailable. Open the app online once, then try again.');
  const pdf=new globalThis.jspdf.jsPDF({unit:'pt',format:'a4',compress:true});
  const W=1240,H=Math.round(W*pdf.internal.pageSize.getHeight()/pdf.internal.pageSize.getWidth()),left=80,right=W-left,bottom=H-88;
  const canvas=document.createElement('canvas');canvas.width=W;canvas.height=H;
  const ctx=canvas.getContext('2d');let y=0,page=0,activeFinding='';
  function findingBand(label){ctx.fillStyle='#eaf1f8';ctx.fillRect(left,y-29,right-left,45);ctx.fillStyle='#003d7c';ctx.font='bold 25px Arial';ctx.fillText(label,left+12,y+1);y+=42;}
  function start(){ctx.fillStyle='#fff';ctx.fillRect(0,0,W,H);ctx.fillStyle='#ef7c00';ctx.fillRect(left,42,right-left,4);ctx.font='21px Arial';ctx.fillStyle='#003d7c';ctx.fillText('Safety Fieldbook | Field notes',left,79);y=123;if(page&&activeFinding)findingBand(`${activeFinding} - continued`);}
  function flush(){ctx.fillStyle='#64748b';ctx.font='17px Arial';ctx.fillText(`Exported ${exportedAt.toLocaleDateString()}`,left,H-42);ctx.textAlign='right';ctx.fillText(String(++page),right,H-42);ctx.textAlign='left';if(page>1)pdf.addPage();pdf.addImage(canvas.toDataURL('image/jpeg',.94),'JPEG',0,0,pdf.internal.pageSize.getWidth(),pdf.internal.pageSize.getHeight());}
  function next(){flush();start();}
  function space(height){if(y+height>bottom)next();}
  function text(value,{size=25,color='#25384a',bold=false}={}){
    const font=`${bold?'bold ':''}${size}px Arial`;ctx.font=font;
    const draw=line=>{space(size*1.4);ctx.font=font;ctx.fillStyle=color;ctx.fillText(line,left,y);y+=size*1.35;};
    for(const paragraph of String(value??'').split(/\r?\n/)){let line='';for(const word of paragraph.match(/\s+|\S+/gu)||['']){ctx.font=font;if(ctx.measureText(line+word).width<=right-left){line+=word;continue;}if(line){draw(line);line='';}if(ctx.measureText(word).width<=right-left){line=word;continue;}for(const char of word){if(ctx.measureText(line+char).width>right-left){draw(line);line='';}line+=char;}}draw(line);}y+=8;
  }
  start();text(draft.title||'Untitled inspection',{size:34,bold:true,color:'#003d7c'});text([draft.date,draft.inspector].filter(Boolean).join(' | '),{size:23,color:'#64748b'});
  const warnings=[];let done=0;const total=draft.findings.reduce((n,f)=>n+(photos?f.photos.length:0),0);
  for(const [index,f] of draft.findings.entries()){
    activeFinding='';space(150);activeFinding=`Finding ${String(index+1).padStart(2,'0')}`;y+=24;findingBand(activeFinding);
    const location=[f.building,f.floor?'Floor '+f.floor:'',f.room?'Room '+f.room:''].filter(Boolean).join(' / ');
    if(location)text(location,{size:22,color:'#64748b'});
    text(f.description||'Description not entered.');
    for(const note of f.voiceNotes||[]){if(note.transcript?.trim()){text(note.title||'Voice note',{size:22,bold:true});text(note.transcript,{size:23});}}
    if(photos)for(let offset=0;offset<f.photos.length;offset+=2){
      const row=[];
      try{
        for(let n=offset;n<Math.min(offset+2,f.photos.length);n++){
          onProgress(++done,total);const p=f.photos[n];
          try{const rendered=await renderPhoto({...p,blob:bytesBlob(p),annotations:annotations?(p.annotations||[]):[]},{type:'image/jpeg',maxEdge:1800,quality:.88});const image=await decodePhoto(rendered.blob);row.push({image,number:n+1,width:image.width,height:image.height});}
          catch{const warning=`Finding ${index+1}, photo ${n+1}: photo unavailable.`;warnings.push(warning);text(warning,{size:22,color:'#9b3300'});}
        }
        if(row.length){let layout=photoRowLayout(row,bottom-y,right-left);if(!layout){next();layout=photoRowLayout(row,bottom-y,right-left);}const top=y;row.forEach((p,i)=>{const box=layout.items[i],x=left+i*(layout.cell+layout.gap);ctx.font='20px Arial';ctx.fillStyle='#003d7c';ctx.fillText(`${activeFinding} | Photo ${String(p.number).padStart(2,'0')}`,x,top+20);ctx.drawImage(p.image.source||p.image,x,top+34,box.width,box.height);});y+=layout.height+48;}
      }finally{row.forEach(p=>p.image.close());}
      await new Promise(resolve=>setTimeout(resolve,0));
    }
  }
  if(!draft.findings.length)text('No findings recorded.');flush();pdf.setProperties({title:`${draft.title} - Field notes`,subject:'On-site observations',creator:'Safety Fieldbook'});
  canvas.width=canvas.height=1;return {blob:pdf.output('blob'),warnings,pages:page};
}
