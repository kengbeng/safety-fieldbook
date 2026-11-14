import {test} from 'node:test';
import assert from 'node:assert/strict';
import {formatBytes,completionText,friendlyError} from './transfer-ui.mjs';
test('transfer sizes remain legible below one megabyte',()=>{
 assert.equal(formatBytes(4),'4 B');assert.equal(formatBytes(2048),'2.0 KB');assert.equal(formatBytes(1048576),'1.0 MB');
});
test('completion notes use plain singular/plural wording and omit empty counts',()=>{
 assert.equal(completionText({duplicates:1,warnings:1}),'1 identical finding skipped · 1 import note to review.');
 assert.match(completionText({conflicts:2}),/2 conflicting versions/);
 assert.doesNotMatch(completionText({duplicates:0,warnings:0}),/0|duplicates/);
});
test('connection and malformed-code errors give useful recovery directions',()=>{
 assert.match(friendlyError(new Error('Unexpected token in JSON')),/Generate a new QR/);
 assert.match(friendlyError(new Error('Signalling failed (403)')),/same Wi-Fi/);
 assert.equal(friendlyError(new Error('Device storage is full.')),'Device storage is full.');
});
