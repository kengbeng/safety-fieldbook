import assert from 'node:assert/strict';
import {photoRowLayout,fieldNotesFilename} from './field-notes.js';
const images=[{width:1200,height:800},{width:700,height:1200}];
const full=photoRowLayout(images,1200),fit=photoRowLayout(images,340);
assert.ok(fit&&fit.height<full.height,'Use remaining page space instead of moving a whole photo row');
assert.ok(fit.height+48<=340);
assert.equal(photoRowLayout(images,150),null,'Move to a new page when photos would become too small');
for(const [i,item] of fit.items.entries()){assert.ok(Math.abs(item.width/item.height-images[i].width/images[i].height)<.001);assert.ok(item.width<=fit.cell);assert.ok(item.height<=fit.height);}
assert.ok(fieldNotesFilename({date:'2026-11-11',title:'Workshop / A'}).endsWith('_field-notes.pdf'));
console.log('PASS: photo rows fill available page space, preserve aspect ratios, and avoid unreadably small images.');
