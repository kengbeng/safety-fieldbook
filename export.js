import {audioExtension} from './voice.js';
export function drawAnnotation(ctx,a,w,h){const x=a.x*w,y=a.y*h,dx=a.dx*w,dy=a.dy*h;ctx.strokeStyle=a.color;ctx.fillStyle=a.color;ctx.lineWidth=Math.max(3,w/280);ctx.lineCap='round';ctx.lineJoin='round';ctx.beginPath();if(a.type==='rectangle')ctx.rect(x,y,dx,dy);if(a.type==='circle')ctx.ellipse(x+dx/2,y+dy/2,Math.max(1,Math.abs(dx/2)),Math.max(1,Math.abs(dy/2)),0,0,Math.PI*2);if(a.type==='arrow'){ctx.moveTo(x,y);ctx.lineTo(x+dx,y+dy);const angle=Math.atan2(dy,dx),l=Math.max(15,w/40);ctx.moveTo(x+dx-l*Math.cos(angle-.5),y+dy-l*Math.sin(angle-.5));ctx.lineTo(x+dx,y+dy);ctx.lineTo(x+dx-l*Math.cos(angle+.5),y+dy-l*Math.sin(angle+.5));}ctx.stroke();if(a.type==='text'){ctx.font=`bold ${Math.max(18,w/35)}px sans-serif`;ctx.strokeStyle='#ffffff';ctx.lineWidth=Math.max(3,w/250);ctx.strokeText(a.text||'Note',x,y);ctx.fillText(a.text||'Note',x,y);}}
export async function renderPhoto(photo, options = {}) {
  const {maxEdge = Infinity, type = 'image/png', quality = .82} = options;
  const image = await createImageBitmap(photo.blob);
  const canvas = document.createElement('canvas');
  const scale = Math.min(1, maxEdge / Math.max(image.width, image.height));
  canvas.width = Math.max(1, Math.round(image.width * scale));
  canvas.height = Math.max(1, Math.round(image.height * scale));
  const ctx = canvas.getContext('2d');
  try {
    if (type === 'image/jpeg') { ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, canvas.width, canvas.height); }
    ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
    photo.annotations.forEach(a => drawAnnotation(ctx, a, canvas.width, canvas.height));
  } finally { image.close(); }
  const blob = await new Promise((resolve, reject) => canvas.toBlob(
    b => b ? resolve(b) : reject(new Error('Unable to render photo')), type, quality));
  if (blob.type !== type) throw new Error('This browser cannot encode the selected image format. Try full quality.');
  return {blob, width: canvas.width, height: canvas.height};
}
export async function annotatedBlob(photo, options) { return (await renderPhoto(photo, options)).blob; }
export function csvCell(v){let s=String(v??'');if(/^[\s]*[=+@\-\t\r]/.test(s))s="'"+s;return '"'+s.replaceAll('"','""')+'"';}
const enc=new TextEncoder();
export function crc32(data){let crc=0xffffffff;for(const b of data){crc^=b;for(let j=0;j<8;j++)crc=(crc>>>1)^((crc&1)?0xedb88320:0);}return (crc^0xffffffff)>>>0;}
export async function zipFiles(files){const now=new Date(),year=Math.max(1980,Math.min(2107,now.getFullYear())),dosTime=(now.getHours()<<11)|(now.getMinutes()<<5)|Math.floor(now.getSeconds()/2),dosDate=((year-1980)<<9)|((now.getMonth()+1)<<5)|now.getDate();const parts=[],central=[];let offset=0;for(const f of files){const name=enc.encode(f.name),data=new Uint8Array(await f.blob.arrayBuffer());if(data.length>0xffffffff)throw new Error('Photo too large for ZIP');const crc=crc32(data),header=new Uint8Array(30+name.length),v=new DataView(header.buffer);v.setUint32(0,0x04034b50,true);v.setUint16(4,20,true);v.setUint16(6,0x800,true);v.setUint16(10,dosTime,true);v.setUint16(12,dosDate,true);v.setUint32(14,crc,true);v.setUint32(18,data.length,true);v.setUint32(22,data.length,true);v.setUint16(26,name.length,true);header.set(name,30);parts.push(header,data);const c=new Uint8Array(46+name.length),cv=new DataView(c.buffer);cv.setUint32(0,0x02014b50,true);cv.setUint16(4,20,true);cv.setUint16(6,20,true);cv.setUint16(8,0x800,true);cv.setUint16(12,dosTime,true);cv.setUint16(14,dosDate,true);cv.setUint32(16,crc,true);cv.setUint32(20,data.length,true);cv.setUint32(24,data.length,true);cv.setUint16(28,name.length,true);cv.setUint32(42,offset,true);c.set(name,46);central.push(c);offset+=header.length+data.length;if(offset>0xffffffff)throw new Error('Export exceeds 4 GB ZIP limit. Split into smaller inspections.');}if(files.length>65535)throw new Error('Too many photos');const size=central.reduce((s,c)=>s+c.length,0),end=new Uint8Array(22),ev=new DataView(end.buffer);ev.setUint32(0,0x06054b50,true);ev.setUint16(8,files.length,true);ev.setUint16(10,files.length,true);ev.setUint32(12,size,true);ev.setUint32(16,offset,true);return new Blob([...parts,...central,end],{type:'application/zip'});}

export const EXPORT_PROFILES = Object.freeze({
  archive: {label: 'Smaller archive', originals: true, maxEdge: 1600, type: 'image/jpeg', quality: .82},
  share: {label: 'Compact sharing', originals: false, maxEdge: 1600, type: 'image/jpeg', quality: .82},
  full: {label: 'Full quality', originals: true, maxEdge: Infinity, type: 'image/png'}
});
const html = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const slug = (value, fallback = 'unspecified', length = 48) => String(value ?? '').normalize('NFKD')
  .replace(/\p{M}/gu, '').replace(/[^\p{L}\p{N}_-]+/gu, '-').replace(/^-+|-+$/g, '').slice(0, length).replace(/-+$/g, '') || fallback;
const shortId = id => slug(id, 'record', 8);
export function exportFolder(draft) {
  return `${slug(draft.date, 'undated', 10)}_${slug(draft.title, 'inspection')}_${shortId(draft.id)}`;
}
export function exportFilename(draft, mode, exportedAt) {
  return `${exportFolder(draft)}_${mode}_${exportedAt.replace(/[^0-9TZ]/g, '')}.zip`;
}
const textFile = (name, text, type = 'text/plain') => ({name, blob: new Blob([text], {type})});
const csvFile = (name, rows) => textFile(name, '\ufeff' + rows.map(row => row.map(csvCell).join(',')).join('\r\n'), 'text/csv');
const link = path => html(encodeURI(path));

export function inspectionReport(metadata) {
  const count = metadata.findings.length;
  const photos = metadata.findings.reduce((n, f) => n + f.photos.length, 0);
  const audioCount=metadata.findings.reduce((n,f)=>n+(f.voiceNotes||[]).length,0);
  const counts = ['High','Medium','Low'].map(p => `${metadata.findings.filter(f => f.priority === p).length} ${p.toLowerCase()}`).join(' · ');
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${html(metadata.title)} · Inspection report</title><style>
  *{box-sizing:border-box}body{font:16px/1.6 system-ui,sans-serif;color:#23303d;background:#f3f5f7;margin:0}main{max-width:1000px;margin:auto;padding:30px 20px}h1{line-height:1.2;overflow-wrap:anywhere}a{color:#17385b}header,article{background:white;border:1px solid #d7dce2;border-radius:10px;padding:24px;margin-bottom:20px}p{white-space:pre-wrap;overflow-wrap:anywhere}.meta{color:#4c5865}.badge{display:inline-block;padding:3px 10px;background:#e5ebf2;border-radius:5px}nav a{margin-right:14px}.photos{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,260px),1fr));gap:18px}figure{margin:0}figure img{width:100%;max-height:420px;object-fit:contain;background:#eceff3;border-radius:6px}figcaption{font-size:14px}dt{font-weight:600}dd{margin:0 0 10px}table{border-collapse:collapse;width:100%;font-size:14px}td,th{text-align:left;vertical-align:top;padding:10px;border-bottom:1px solid #d7dce2}.table-wrap{overflow:auto}.notice{padding:12px;background:#fbf0dc;border-radius:6px}@media print{body{background:white}header,article{break-inside:avoid}nav{display:none}main{padding:0}}
  </style></head><body><main><header><div class="meta">SAFETY FIELDBOOK · EXPORTED INSPECTION</div><h1>${html(metadata.title)}</h1><p class="badge">${metadata.findings.some(f=>!f.reviewed||!f.photos.length) ? 'DRAFT · Review or photos incomplete' : 'All findings marked reviewed'}</p><p>${html(metadata.date)} · Inspector: ${html(metadata.inspector)}</p><p>${count} finding${count===1?'':'s'} · ${photos} photo${photos===1?'':'s'} · ${audioCount} audio notes · ${counts}</p><p><b>${html(metadata.exportProfile.label)}</b> · Exported ${html(metadata.exportedAt)}</p><p class="notice">${metadata.exportProfile.originalsIncluded ? 'Original photos included and unmodified.' : 'COMPACT SHARING COPY: original photos are NOT included. This is not a full archive.'} ${metadata.exportProfile.annotatedFormat === 'image/jpeg' ? 'Annotated images are resized JPEGs (maximum 1600 px on the longest edge, no upscaling). Check small labels and fine detail in the originals.' : 'Annotated images are full-resolution PNGs.'} No cloud upload is confirmed.</p><nav><a href="findings.csv">Findings spreadsheet (CSV)</a><a href="photos.csv">Photo register (CSV)</a><a href="audio.csv">Audio register (CSV)</a><a href="inspection.json">Structured data (JSON)</a><a href="README.txt">Export notes</a></nav><div class="table-wrap"><table><thead><tr><th>Finding</th><th>Location</th><th>Priority</th><th>Review</th></tr></thead><tbody>${metadata.findings.map(f => `<tr><td><a href="#${f.reference}">${f.reference}</a></td><td>${html([f.building,f.floor,f.room].filter(Boolean).join(' / ') || 'Not specified')}</td><td>${html(f.priority)}</td><td>${f.reviewed ? 'Reviewed' : 'Needs review'}${f.photos.length ? '' : ' · No photos'}</td></tr>`).join('')}</tbody></table></div></header>${metadata.findings.map(f => `<article id="${f.reference}"><h2>${f.reference} <span class="badge">${html(f.priority)}</span></h2><p>${html(f.description)}</p><dl><dt>Location</dt><dd>${html([f.building,f.floor,f.room].filter(Boolean).join(' / ') || 'Not specified')}</dd><dt>Hazard category</dt><dd>${html(f.category)}</dd><dt>Review</dt><dd>${f.reviewed ? 'Reviewed' : 'Needs review'}</dd></dl><p><a href="${link(f.folder + '/finding.txt')}">Finding text record</a></p><div class="photos">${f.photos.map(p => `<figure><a href="${link(p.annotated)}"><img loading="lazy" src="${link(p.annotated)}" alt="${f.reference} ${p.reference}: annotated inspection photo"></a><figcaption><b>${f.reference} / ${p.reference}</b> · ${p.annotations.length} annotation${p.annotations.length===1?'':'s'}<br><a href="${link(p.annotated)}">Annotated image</a>${p.original ? ` · <a href="${link(p.original)}">Original photo</a>` : ' · Original omitted'}<br>Source: ${html(p.originalName)}</figcaption></figure>`).join('') || '<p>No photos recorded for this finding.</p>'}</div>${(f.voiceNotes||[]).length?`<section><h3>Voice notes</h3>${f.voiceNotes.map(v=>`<div><h4>${v.reference} · ${html(v.title||'Audio note')}</h4><audio controls preload="none" src="${link(v.audio)}">Audio playback is not supported in this browser.</audio><p><a href="${link(v.audio)}">Open saved audio</a> · <a href="${link(v.transcriptPath)}">Transcript text file</a></p><p>${html(v.transcript||'No transcript entered.')}</p><p class="meta">Transcript source: ${html(v.transcriptSource||'manual')}. Check against the saved audio. Audio format: ${html(v.mimeType)}. Playback support varies by browser.</p></div>`).join('')}</section>`:''}<p class="meta">Record ID: ${html(f.id)} · ${f.reference} is its display order in this export; use the record ID to match future exports.</p></article>`).join('')}<p class="meta">Extract the whole ZIP before opening this report. Keep the folder contents together so photo links work. The JSON preserves editable annotation objects; this app version does not import exported records.</p></main></body></html>`;
}

export async function collectExportFiles(draft, options = {}, renderer = renderPhoto) {
  const mode = options.mode || 'archive';
  const profile = EXPORT_PROFILES[mode];
  if (!profile) throw new Error('Unknown export profile');
  const files = [], folder = exportFolder(draft);
  const metadata = {schemaVersion: 2, annotationCoordinates: 'Normalized to original image dimensions; x/y anchor, dx/dy extent',
    id: draft.id, title: draft.title, date: draft.date, inspector: draft.inspector, updatedAt: draft.updatedAt,
    exportedAt: options.exportedAt || new Date().toISOString(), storage: 'local; no cloud upload',
    exportProfile: {mode, label: profile.label, originalsIncluded: profile.originals, annotatedFormat: profile.type,
      maxAnnotatedEdge: Number.isFinite(profile.maxEdge) ? profile.maxEdge : null, jpegQuality: profile.quality ?? null}, findings: []};
  const rows = [['inspection_id','inspection_title','date','inspector','finding_ref','finding_id','building','floor','room','description','hazard_category','priority','reviewed','photo_count','finding_folder','original_photos','annotated_photos','audio_count','audio_files','transcript_files']];
  const photoRows = [['inspection_id','finding_ref','finding_id','photo_ref','photo_id','source_filename','source_mime_type','source_bytes','original_included','original_path','annotated_path','annotated_width','annotated_height','annotated_bytes','annotation_count']];
  const audioRows=[['inspection_id','finding_ref','finding_id','audio_ref','audio_id','title','mime_type','bytes','duration_seconds','audio_path','transcript_path','transcript','transcript_source','transcription_model']];
  const total = draft.findings.reduce((n, f) => n + f.photos.length, 0); let completed = 0;
  for (let fi = 0; fi < draft.findings.length; fi++) {
    const f = draft.findings[fi], reference = `F${String(fi+1).padStart(3,'0')}`;
    const location = [f.building,f.floor,f.room].filter(Boolean).join('-');
    const findingFolder = `findings/${reference}_${slug(location,'location-unspecified',56)}_${shortId(f.id)}`;
    const photos = [];
    for (let n = 0; n < f.photos.length; n++) {
      const p = f.photos[n], photoRef = `P${String(n+1).padStart(2,'0')}`;
      const extension = ({'image/jpeg':'jpg','image/png':'png','image/webp':'webp','image/gif':'gif','image/avif':'avif','image/heic':'heic','image/heif':'heif'})[p.blob.type] || 'img';
      const original = profile.originals ? `${findingFolder}/${photoRef}_original.${extension}` : null;
      const annotated = `${findingFolder}/${photoRef}_annotated.${profile.type === 'image/png' ? 'png' : 'jpg'}`;
      if (original) files.push({name: original, blob: p.blob});
      options.onProgress?.(completed + 1,total);
      const rendered = await renderer(p, profile);
      files.push({name: annotated, blob: rendered.blob});
      photos.push({id:p.id, reference:photoRef, originalName:p.name, mimeType:p.blob.type, sourceBytes:p.blob.size,
        originalIncluded:profile.originals, original, annotated, annotatedWidth:rendered.width, annotatedHeight:rendered.height,
        annotatedBytes:rendered.blob.size, annotations:structuredClone(p.annotations)});
      photoRows.push([draft.id,reference,f.id,photoRef,p.id,p.name,p.blob.type,p.blob.size,profile.originals,original || '',annotated,rendered.width,rendered.height,rendered.blob.size,p.annotations.length]);
      completed++;
    }
    const voiceNotes=[];
    for(let vi=0;vi<(f.voiceNotes||[]).length;vi++){
      const v=f.voiceNotes[vi],audioRef=`A${String(vi+1).padStart(2,'0')}`,base=`${findingFolder}/${audioRef}_${slug(v.title,'audio-note',32)}`;
      const audio=`${base}.${audioExtension(v.blob.type)}`,transcriptPath=`${base}_transcript.txt`;
      files.push({name:audio,blob:v.blob},textFile(transcriptPath,v.transcript||'No transcript entered.'));
      voiceNotes.push({id:v.id,reference:audioRef,title:v.title,transcript:v.transcript||'',transcriptSource:v.transcriptSource||'manual',transcriptionModel:v.transcriptionModel||null,durationSeconds:v.durationSeconds??null,updatedAt:v.updatedAt,mimeType:v.blob.type,bytes:v.blob.size,audio,transcriptPath});
      audioRows.push([draft.id,reference,f.id,audioRef,v.id,v.title,v.blob.type,v.blob.size,v.durationSeconds??'',audio,transcriptPath,v.transcript||'',v.transcriptSource||'manual',v.transcriptionModel||'']);
    }
    const record = {...f, reference, folder:findingFolder, photos,voiceNotes};
    metadata.findings.push(record);
    rows.push([draft.id,draft.title,draft.date,draft.inspector,reference,f.id,f.building,f.floor,f.room,f.description,f.category,f.priority,!!f.reviewed,photos.length,findingFolder,photos.map(p=>p.original).filter(Boolean).join('; '),photos.map(p=>p.annotated).join('; '),voiceNotes.length,voiceNotes.map(v=>v.audio).join('; '),voiceNotes.map(v=>v.transcriptPath).join('; ')]);
    files.push(textFile(`${findingFolder}/finding.txt`, `${reference} — ${draft.title}\nInspection: ${draft.date}\nInspector: ${draft.inspector}\nLocation: ${[f.building,f.floor,f.room].filter(Boolean).join(' / ') || 'Not specified'}\nHazard category: ${f.category}\nPriority: ${f.priority}\nReview: ${f.reviewed ? 'Reviewed' : 'Needs review'}\n\n${f.description}\n\nFinding ID: ${f.id}\nPhotos:\n${photos.map(p=>`${p.reference}: ${p.originalName}\n  Original: ${p.original ? p.original.split('/').at(-1) : 'NOT INCLUDED'}\n  Annotated: ${p.annotated.split('/').at(-1)}`).join('\n') || 'No photos recorded.'}\n\nAudio notes:\n${voiceNotes.map(v=>`${v.reference}: ${v.title}\n  Audio: ${v.audio.split('/').at(-1)}\n  Transcript: ${v.transcriptPath.split('/').at(-1)}\n${v.transcript||'No transcript entered.'}`).join('\n') || 'No audio notes recorded.'}\n`));
  }
  files.unshift(textFile('START-HERE.html', inspectionReport(metadata), 'text/html'), csvFile('findings.csv',rows), csvFile('photos.csv',photoRows),
    csvFile('audio.csv',audioRows),textFile('inspection.json',JSON.stringify(metadata,null,2),'application/json'),
    textFile('README.txt',`Safety Fieldbook export · schema 2\n\n1. Extract the entire ZIP. Open START-HERE.html in your browser. It works offline.\n2. Use findings.csv to sort/filter findings and photos.csv for one row per photo. Import room/floor/ID columns as TEXT in spreadsheet software to preserve leading zeroes. Formula-like CSV text is prefixed with an apostrophe for spreadsheet safety.\n3. Each finding folder contains its text record and photo pairs. Keep the folder structure unchanged for report links.\n\nProfile: ${profile.label}\n${profile.originals ? 'Original photos are included byte-for-byte, unchanged.' : 'ORIGINAL PHOTOS ARE NOT INCLUDED. This compact sharing copy is not a full archive. Originals stay in the app on the source device.'}\nAnnotated copies: ${profile.type === 'image/png' ? 'full-resolution PNG' : 'JPEG, longest edge at most 1600 px, quality 82%, white background for transparency; no upscaling'}. JPEG may lose small details; use full quality for fine detail or sensitive image evidence.\nJPEG, PNG and many camera photos are already compressed; ZIP compression alone rarely gives large savings. File sizes vary by image content.\n\ninspection.json preserves full record IDs and editable normalized annotation objects. Flattened annotated images alone do not preserve an unmarked original. The app does not currently import this export.\nF001/P01 are references within this export; display order may change in future exports. Match records across exports by their full IDs.\nSaved audio is included unchanged in every export profile, with transcript text files and audio.csv. Audio can increase ZIP size. Transcripts are editable and may be generated on-device. Check transcript_source and transcription_model in audio.csv or JSON; verify text against saved audio.\nThis is a downloaded export, not confirmation of cloud upload.\n`));
  return {files:files.map(file=>({...file,name:`${folder}/${file.name}`})), folder, metadata};
}
export async function makeExport(draft, options = {}) {
  const {files} = await collectExportFiles(draft, options);
  return zipFiles(files);
}
