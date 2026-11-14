import {test} from 'node:test';
import assert from 'node:assert/strict';
import {ArchiveBuffer,pairing,metadata,sha256,MAX_BYTES,Transfer} from './transfer.mjs';
test('pairing validates shape, expiry, and rejects arbitrary endpoints',()=>{const p={v:1,room:'a'.repeat(32),token:'b'.repeat(64),expires:Date.now()+60000};assert.equal(pairing(JSON.stringify(p)).room,p.room);assert.throws(()=>pairing(JSON.stringify({...p,expires:1})));assert.throws(()=>pairing(JSON.stringify({...p,room:'https://evil'})));});
test('archive bounds, exact length and hash verified before import',async()=>{const bytes=new TextEncoder().encode('a compact zip payload'),m={type:'file',name:'inspection.zip',size:bytes.length,sha:await sha256(bytes)};const b=new ArchiveBuffer(m);b.append(bytes.buffer);assert.equal((await b.finish()).size,m.size);const short=new ArchiveBuffer(m);await assert.rejects(short.finish(),/Incomplete/);const corrupt=new ArchiveBuffer({...m,sha:'0'.repeat(64)});corrupt.append(bytes.buffer);await assert.rejects(corrupt.finish(),/checksum/);assert.throws(()=>new ArchiveBuffer({...m,size:MAX_BYTES+1}));assert.throws(()=>metadata({...m,name:'../x.zip'}));const over=new ArchiveBuffer(m);assert.throws(()=>over.append(new ArrayBuffer(bytes.length+1)));});
test('success requires matching hash and post-save acknowledgement',async()=>{const t=new Transfer({},{});t.localVerified=t.peerVerified=true;t.role='sender';t.pending={sha:'a'.repeat(64)};t.sent=true;await assert.rejects(t.message(JSON.stringify({type:'ack',sha:'b'.repeat(64),status:'imported'})));assert.ok(!t.finished);t.close();});
test('receiver does not acknowledge a failed local save',async()=>{const sent=[],t=new Transfer({},{importFile:async()=>{throw Error('Storage full');}});t.localVerified=t.peerVerified=t.accepted=true;t.role='receiver';t.buffer={finish:async()=>new Blob(['zip'])};t.control=m=>sent.push(m);await assert.rejects(t.message(JSON.stringify({type:'end'})),/Storage full/);assert.equal(sent.length,0);t.close();});
test('receiver rejects unverified bytes and duplicate offers',async()=>{const t=new Transfer({},{});t.role='receiver';await assert.rejects(t.message(new ArrayBuffer(1)),/before acceptance/);await assert.rejects(t.message(JSON.stringify({type:'end'})),/not been verified/);t.close();});

test('inspection metadata is bounded before displaying a sender description',()=>{
 const m={type:'file',name:'inspection.zip',size:10,sha:'a'.repeat(64)};
 assert.equal(metadata({...m,description:'Lab inspection · 2 findings'}).description,'Lab inspection · 2 findings');
 assert.throws(()=>metadata({...m,description:'x'.repeat(301)}),/summary/);
 assert.throws(()=>metadata({...m,description:{title:'unsafe'}}),/summary/);
});
test('cancelling during checksum verification never starts the import',async()=>{
 let release,imports=0;const phases=[];
 const t=new Transfer({},{phase:p=>phases.push(p),importFile:async()=>{imports++;}});
 t.role='receiver';t.localVerified=t.peerVerified=t.accepted=true;
 t.buffer={finish:()=>new Promise(resolve=>release=resolve)};
 const receiving=t.message(JSON.stringify({type:'end'}));
 assert.deepEqual(phases,['checking']);t.close();release(new Blob(['zip']));await receiving;
 assert.equal(imports,0);assert.deepEqual(phases,['checking']);
});
test('saving phase precedes import, and completion follows the import save result',async()=>{
 const phases=[],messages=[];let release;
 const t=new Transfer({},{phase:p=>phases.push(p),importFile:()=>new Promise(resolve=>release=resolve)});
 t.role='receiver';t.receivedSha='a'.repeat(64);t.localVerified=t.peerVerified=t.accepted=true;
 t.buffer={finish:async()=>new Blob(['zip'])};t.control=m=>messages.push(m);
 const receiving=t.message(JSON.stringify({type:'end'}));await Promise.resolve();
 assert.deepEqual(phases,['checking','saving']);assert.equal(messages.length,0);
 release({status:'imported'});await receiving;assert.equal(messages[0].type,'ack');assert.ok(t.finished);t.close();
});
