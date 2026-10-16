import assert from 'node:assert/strict';
import {collectExportFiles, zipFiles, exportFilename, csvCell} from './export.js';
const original = new Blob(['original image bytes'], {type:'image/jpeg'});
const annotation = {type:'text',x:.2,y:.3,dx:0,dy:0,color:'#f00',text:'Label'};
const draft = {id:'inspection-12345',title:'Lab <script>alert(1)</script> / 学校',date:'2026-10-15',inspector:'QA',updatedAt:'2026-10-15T01:00:00Z',findings:[
 {id:'finding-123',building:'E3 / ../',floor:'02',room:'001',description:'=danger, "quoted"\n<script>alert(1)</script>',category:'General safety',priority:'High',reviewed:false,photos:[{id:'photo-1',name:'camera.jpg',blob:original,annotations:[annotation]}]},
 {id:'finding-456',building:'E3 / ../',floor:'02',room:'001',description:'No photo yet',category:'Electrical',priority:'Low',reviewed:false,photos:[]}
]};
const before=JSON.stringify(draft.findings[0].photos[0].annotations);
for(const mode of ['archive','share','full']){
 const calls=[],progress=[];
 const result=await collectExportFiles(draft,{mode,exportedAt:'2026-10-15T02:03:04.000Z',onProgress:(...args)=>progress.push(args)},async(p,profile)=>{
   calls.push(profile);return{blob:new Blob(['rendered'],{type:profile.type}),width:mode==='full'?3000:1600,height:mode==='full'?2000:1067};
 });
 const {folder,files,metadata}=result;
 assert.equal(metadata.schemaVersion,3);assert.equal(metadata.findings[0].reference,'F001');assert.equal(metadata.findings[1].reference,'F002');
 assert.equal(new Set(files.map(f=>f.name)).size,files.length);
 assert.ok(files.every(f=>f.name.startsWith(folder+'/')&&!f.name.split('/').includes('..')));
 for(const name of ['START-HERE.html','findings.csv','photos.csv','inspection.json','README.txt'])assert.ok(files.some(f=>f.name===folder+'/'+name));
 const photo=metadata.findings[0].photos[0];assert.equal(photo.originalIncluded,mode!=='share');
 if(mode==='share'){assert.equal(photo.original,null);assert.ok(!files.some(f=>f.name.includes('_original.')));}else{
  const f=files.find(f=>f.name===folder+'/'+photo.original);assert.equal(await f.blob.text(),await original.text());
 }
 assert.ok(files.some(f=>f.name===folder+'/'+photo.annotated));
 assert.ok(photo.annotated.endsWith(mode==='full'?'.png':'.jpg'));
 assert.deepEqual(photo.annotations,[annotation]);assert.deepEqual(progress,[[1,1]]);
 const report=await files.find(f=>f.name.endsWith('/START-HERE.html')).blob.text();
 assert.ok(!report.includes('<script>'));assert.ok(report.includes('&lt;script&gt;'));assert.ok(!report.includes('Needs review'));assert.ok(report.includes('Complete'));assert.equal(metadata.findings[0].reviewed,undefined);
 assert.ok(report.includes('No photos recorded'));assert.equal(report.includes('original photos are NOT included'),mode==='share');
 const csv=await files.find(f=>f.name.endsWith('/findings.csv')).blob.text();assert.deepEqual([...new Uint8Array(await files.find(f=>f.name.endsWith('/findings.csv')).blob.arrayBuffer()).slice(0,3)],[239,187,191]);assert.ok(csv.includes('"001"'));assert.ok(csv.includes("\"'=danger"));
 assert.ok(files.find(f=>f.name===folder+'/'+metadata.findings[1].folder+'/finding.txt'));
 const zip=await zipFiles(files);assert.equal(zip.type,'application/zip');assert.ok(zip.size>0);
 assert.ok(exportFilename(draft,mode,'2026-10-15T02:03:04.000Z').startsWith('2026-10-15_'));
}
assert.equal(JSON.stringify(draft.findings[0].photos[0].annotations),before);
assert.equal(csvCell('  +formula'),'"\'  +formula"');
await assert.rejects(collectExportFiles(draft,{mode:'invalid'}),/Unknown export/);
await assert.rejects(collectExportFiles(draft,{},async()=>{throw new Error('encode failed')}),/Recovery backup/);
console.log('PASS: all three profiles, original-byte preservation, compact omission, metadata paths, safe filenames, report escaping, CSV quoting, review warnings, no-photo findings, progress and error handling.');
