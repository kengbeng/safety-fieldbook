import {createPhotoFinding} from './findings.js';
// Only decoded images create records. Persist each original before proceeding to the next file.
export async function addPhotosToInspection({draft,files,findingId=null,save,decode=createImageBitmap,createId=()=>crypto.randomUUID(),onProgress=()=>{}}){
 let finding=findingId?draft.findings.find(f=>f.id===findingId):null;
 if(findingId&&!finding)throw new Error('This finding is no longer available.');
 let added=0,created=false,saveError=null;const rejected=[];
 for(let index=0;index<files.length;index++){
  const file=files[index];onProgress(index+1,files.length);
  try{if(!file.type.startsWith('image/'))throw new Error('Unsupported image format');const bitmap=await decode(file);bitmap.close();}
  catch(error){rejected.push(file.name||'Image');continue;}
  if(!finding){finding=createPhotoFinding(draft.findings.at(-1),createId());draft.findings.push(finding);created=true;}
  finding.photos.push({id:createId(),name:file.name||'Photo',blob:file,annotations:[]});finding.reviewed=false;added++;
  try{await save(draft);saveError=null;}catch(error){saveError=error;}
 }
 return {finding,created,added,rejected,saveError};
}
