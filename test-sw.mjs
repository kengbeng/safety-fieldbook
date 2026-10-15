import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import vm from 'node:vm';
const source = await fs.readFile(new URL('./sw.js', import.meta.url), 'utf8');
const listeners = {}, cachesByName = new Map(), deleted = [], network = [];
let failInstall = false, claimed = false, skipped = false;
const scope = 'https://example.test/safety-fieldbook/';
const cacheApi = {
  async open(name) {
    if (!cachesByName.has(name)) cachesByName.set(name, new Map());
    const items = cachesByName.get(name);
    return {
      async addAll(requests) {
        if (failInstall) throw new Error('network down');
        for (const req of requests) items.set(req.url, {cached: req.url});
      },
      async match(url) {return items.get(String(url));}
    };
  },
  async keys() {return [...cachesByName.keys()];},
  async delete(name) {deleted.push(name); return cachesByName.delete(name);}
};
const context = vm.createContext({URL, Request, caches: cacheApi,
  fetch: async req => {network.push(req.url); throw new Error('offline');},
  self: {registration:{scope},addEventListener:(name,fn)=>listeners[name]=fn,
    clients:{claim:async()=>{claimed=true;},matchAll:async()=>[]},skipWaiting:()=>{skipped=true;}}
});
vm.runInContext(source, context);
async function lifecycle(type) {let task;listeners[type]({waitUntil:p=>task=p});return task;}
await lifecycle('install');
const activeName=[...cachesByName.keys()][0];
assert.equal(cachesByName.get(activeName).size,13);
for (const url of cachesByName.get(activeName).keys()) {
 assert.ok(url.startsWith(scope));
 const relative=url.slice(scope.length);
 await fs.access(new URL('./'+relative,import.meta.url));
}
cachesByName.set('safety-fieldbook:/safety-fieldbook/:old',new Map());
cachesByName.set('safety-fieldbook:/another-app/:v1',new Map());
cachesByName.set('unrelated-cache',new Map());
cachesByName.set('fieldbook-local-asr:/safety-fieldbook/:v1',new Map());
cachesByName.set('fieldbook-local-asr:/another-app/:v1',new Map());
await lifecycle('activate');
assert.ok(!cachesByName.has('fieldbook-local-asr:/safety-fieldbook/:v1'));
assert.ok(cachesByName.has('fieldbook-local-asr:/another-app/:v1'));
assert.ok(!source.includes('transformers.min.js'));

assert.ok(claimed);
assert.deepEqual(deleted,['safety-fieldbook:/safety-fieldbook/:old','fieldbook-local-asr:/safety-fieldbook/:v1']);
function request(path,mode='cors',method='GET') {
 let response;
 listeners.fetch({request:{url:new URL(path,scope).href,mode,method},respondWith:p=>response=p});
 return response;
}
assert.equal((await request('./','navigate')).cached,scope+'index.html');
assert.equal((await request('index.html?opened=home','navigate')).cached,scope+'index.html');
assert.equal((await request('app.js')).cached,scope+'app.js');
assert.equal(request('../another-app/','navigate'),undefined);
assert.equal(request('private-report.json'),undefined);
assert.equal(request('app.js','cors','POST'),undefined);
assert.equal(network.length,0);
listeners.message({data:{type:'ACTIVATE_UPDATE'}});assert.ok(skipped);
failInstall=true;await assert.rejects(lifecycle('install'),/network down/);
const manifest=JSON.parse(await fs.readFile(new URL('./manifest.webmanifest',import.meta.url),'utf8'));
assert.equal(manifest.start_url,'./');assert.equal(manifest.scope,'./');
assert.equal(manifest.display,'standalone');
for(const icon of manifest.icons)await fs.access(new URL('./'+icon.src,import.meta.url));
console.log('PASS: complete offline shell, subpath navigation, offline asset responses, cache isolation, explicit update activation, failed install rejection, PWA manifest and icons.');
