// Copy bytes independently of a picker File's temporary backing resource.
export function bytesBlob(photo){return photo.originalBytes ? new Blob([photo.originalBytes],{type:photo.mimeType||photo.blob?.type||'image/jpeg'}) : photo.blob;}
function validBytes(buffer,expected){const bytes=buffer instanceof Uint8Array?buffer:new Uint8Array(buffer);if(!bytes.byteLength||(expected&&bytes.byteLength!==expected))throw new Error('Photo bytes are incomplete');return bytes;}
export async function readPhotoBytes(photo){
 if(photo.originalBytes)return validBytes(photo.originalBytes);
 const blob=photo.blob;if(!blob)throw new Error('No readable photo data');
 const attempts=[()=>blob.arrayBuffer(),()=>new Promise((resolve,reject)=>{if(typeof FileReader==='undefined')return reject(new Error('FileReader unavailable'));const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=()=>reject(reader.error);reader.readAsArrayBuffer(blob);}),async()=>{const url=URL.createObjectURL(blob);try{const response=await fetch(url);if(!response.ok)throw new Error('Photo read failed');return response.arrayBuffer();}finally{URL.revokeObjectURL(url);}}];
 for(const read of attempts){try{return validBytes(await read(),blob.size);}catch{}}
 throw new Error('Photo unavailable: this browser cannot read the stored original. The existing record has been kept.');
}
export async function decodePhoto(blob){
 try{if(typeof createImageBitmap==='function')return await createImageBitmap(blob);}catch{}
 if(typeof Image==='undefined')throw new Error('Photo decoding unavailable');
 const url=URL.createObjectURL(blob),image=new Image();
 try{await new Promise((resolve,reject)=>{image.onload=resolve;image.onerror=()=>reject(new Error('Photo could not be decoded'));image.src=url;});return {width:image.naturalWidth,height:image.naturalHeight,source:image,close(){image.src='';}};}finally{URL.revokeObjectURL(url);}
}
export async function copyOriginal(file){const originalBytes=await readPhotoBytes({blob:file});return {originalBytes,mimeType:file.type,blob:new Blob([originalBytes],{type:file.type})};}
export function storedDraft(draft){const copy=structuredClone(draft);for(const f of copy.findings||[])for(const p of f.photos||[])if(p.originalBytes){delete p.blob;}return copy;}
export function restoredDraft(draft){for(const f of draft.findings||[])for(const p of f.photos||[])if(p.originalBytes)p.blob=bytesBlob(p);return draft;}
export function verifyPhotoBytes(saved,expected){if(!saved)throw new Error('Saved photo missing');const actual=validBytes(saved.originalBytes);const bytes=validBytes(expected.originalBytes);if(actual.length!==bytes.length||actual.some((b,i)=>b!==bytes[i]))throw new Error('Saved photo verification failed');return true;}
