import assert from 'node:assert/strict';
import {LocalStorageAdapter} from './storage.js';
const adapter=new LocalStorageAdapter(), records=new Map([['a',{id:'a'}],['b',{id:'b'}]]);
let failure=false, committed=false;
adapter.db={transaction(name,mode){
 assert.equal(name,'drafts');assert.equal(mode,'readwrite');
 const tx={error:failure?new Error('simulated abort'):null};let action;
 tx.objectStore=store=>{assert.equal(store,'drafts');return{delete:id=>action=()=>records.delete(id),clear:()=>action=()=>records.clear()};};
 queueMicrotask(()=>{if(failure){tx.onabort();}else{action();committed=true;tx.oncomplete();}});return tx;
}};
const deletion=adapter.remove('a');assert.equal(committed,false);await deletion;
assert.equal(committed,true);assert.deepEqual([...records.keys()],['b']);
failure=true;await assert.rejects(adapter.clear(),/simulated abort/);assert.equal(records.size,1);
failure=false;await adapter.clear();assert.equal(records.size,0);
console.log('PASS: single removal, clear limited to drafts store, transaction-completion confirmation and aborted deletion rejection.');
