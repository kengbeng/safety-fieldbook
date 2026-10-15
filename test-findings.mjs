import assert from 'node:assert/strict';
import {selectFindings} from './findings.js';
const findings=Array.from({length:27},(_,i)=>({id:String(i),description:`Finding ${i}`,building:i<12?'Science':'Arts',room:String(i).padStart(3,'0'),priority:i%2?'High':'Low',reviewed:i%3===0}));
let result=selectFindings(findings);assert.equal(result.items.length,10);assert.equal(result.pages,3);assert.equal(result.total,27);
result=selectFindings(findings,{page:2});assert.equal(result.items.length,7);assert.equal(result.items[0].index,20);
result=selectFindings(findings,{query:' science HIGH ',page:99});assert.equal(result.total,6);assert.equal(result.page,0);assert.ok(result.items.every(({finding:f})=>f.building==='Science'&&f.priority==='High'));
assert.equal(selectFindings(findings,{query:'003'}).items[0].finding.id,'3');
assert.deepEqual(selectFindings(findings,{query:'missing'}).items,[]);assert.equal(selectFindings([]).pages,1);
assert.equal(findings.length,27);console.log('PASS: bounded pages, stable finding numbers, multi-term search, page clamping, empty results, source records unchanged.');
