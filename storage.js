export class LocalStorageAdapter {
  async open(){this.db=await new Promise((resolve,reject)=>{const r=indexedDB.open('safety-fieldbook',1);r.onupgradeneeded=()=>r.result.createObjectStore('drafts',{keyPath:'id'});r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);r.onblocked=()=>reject(new Error('Close other Fieldbook tabs and reload.'));});}
  async list(){return new Promise((resolve,reject)=>{const t=this.db.transaction('drafts');const r=t.objectStore('drafts').getAll();r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});}
  async save(draft){return new Promise((resolve,reject)=>{const t=this.db.transaction('drafts','readwrite');t.objectStore('drafts').put(draft);t.oncomplete=()=>resolve({destination:'local',confirmed:true});t.onerror=()=>reject(t.error);t.onabort=()=>reject(t.error||new Error('Local save aborted'));});}
  async remove(id){return new Promise((resolve,reject)=>{const t=this.db.transaction('drafts','readwrite');t.objectStore('drafts').delete(id);t.oncomplete=resolve;t.onerror=()=>reject(t.error);});}
}
// Cloud adapters must implement connect(), upload(exportBundle), disconnect().
// Only a verified provider response may set a confirmed cloud upload state.
export const cloudProviders=[{id:'dropbox',name:'Dropbox',available:false,requirements:'Requires a registered OAuth app with PKCE and a per-user account connection.'},{id:'sharepoint',name:'Microsoft SharePoint',available:false,requirements:'Requires Microsoft app registration, delegated permissions, a destination library and possibly administrator approval.'}];
