import {storedDraft,restoredDraft,verifyPhotoBytes} from './photo-data.js';
export class LocalStorageAdapter {
  async open(){this.db=await new Promise((resolve,reject)=>{const r=indexedDB.open('safety-fieldbook',1);r.onupgradeneeded=()=>r.result.createObjectStore('drafts',{keyPath:'id'});r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);r.onblocked=()=>reject(new Error('Close other Fieldbook tabs and reload.'));});}
  async list(){return new Promise((resolve,reject)=>{const t=this.db.transaction('drafts');const r=t.objectStore('drafts').getAll();r.onsuccess=()=>resolve(r.result.map(restoredDraft));r.onerror=()=>reject(r.error);});}
  async save(draft){return new Promise((resolve,reject)=>{const t=this.db.transaction('drafts','readwrite');t.objectStore('drafts').put(storedDraft(draft));t.oncomplete=()=>resolve({destination:'local',confirmed:true});t.onerror=()=>reject(t.error);t.onabort=()=>reject(t.error||new Error('Local save aborted'));});}
  async get(id){return new Promise((resolve,reject)=>{const r=this.db.transaction('drafts').objectStore('drafts').get(id);r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});}
  async verifyPhoto(id,photo){const draft=await this.get(id);return verifyPhotoBytes(draft?.findings.flatMap(f=>f.photos).find(p=>p.id===photo.id),photo);}
  async remove(id){return new Promise((resolve,reject)=>{const t=this.db.transaction('drafts','readwrite');t.objectStore('drafts').delete(id);t.oncomplete=resolve;t.onerror=()=>reject(t.error);t.onabort=()=>reject(t.error||new Error('Delete aborted'));});}
  async clear(){return new Promise((resolve,reject)=>{const t=this.db.transaction('drafts','readwrite');t.objectStore('drafts').clear();t.oncomplete=resolve;t.onerror=()=>reject(t.error);t.onabort=()=>reject(t.error||new Error('Clear aborted'));});}
}
// Cloud adapters must implement connect(), upload(exportBundle), disconnect().
// Only a verified provider response may set a confirmed cloud upload state.
export const cloudProviders=[{id:'dropbox',name:'Dropbox',available:false,requirements:'Uploads are not available yet. A future connection will let you choose a Dropbox folder; use a shared folder for central collection.'},{id:'sharepoint',name:'Microsoft SharePoint',available:false,requirements:'Uploads are not available yet. A future connection needs a university site and document library; administrator approval may be required.'}];
