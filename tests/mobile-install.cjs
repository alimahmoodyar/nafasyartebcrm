const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const manifest=JSON.parse(fs.readFileSync('public/manifest.webmanifest','utf8'));
assert.equal(manifest.display,'standalone');assert.equal(manifest.scope,'/');assert.equal(manifest.start_url,'/');
for(const icon of manifest.icons){const b=fs.readFileSync('public'+icon.src);const [w,h]=icon.sizes.split('x').map(Number);assert.equal(b.readUInt32BE(16),w);assert.equal(b.readUInt32BE(20),h)}
const handlers={},data=new Map(),deleted=[];let fetched=[],fail=false,redirect=false,claimed=false;
const offline=fs.readFileSync('public/offline.html','utf8');
const cache={async put(key,value){data.set(key,value)},async match(key){return data.get(key)?.clone()}};
const caches={async open(){return cache},async match(key){return cache.match(key)},async keys(){return ['hamnafas-public-offline-v0','other-app-data','hamnafas-public-offline-v1']},async delete(key){deleted.push(key)}};
vm.runInNewContext(fs.readFileSync('public/sw.js','utf8'),{self:{location:{origin:'https://company.test'},addEventListener:(name,fn)=>handlers[name]=fn,skipWaiting:async()=>{},clients:{claim:async()=>{claimed=true}}},caches,URL,Response,fetch:async(req)=>{fetched.push(req);if(fail)throw Error('offline');if(redirect)return {ok:true,redirected:true};return new Response(typeof req==='string'?offline:'PRIVATE LIVE PAGE')}});
async function lifecycle(name){let pending;handlers[name]({waitUntil:p=>pending=p});await pending}
async function navigate(path='/',method='GET',mode='navigate'){let response;handlers.fetch({request:{url:'https://company.test'+path,method,mode},respondWith:p=>response=p});return response}
(async()=>{
 redirect=true;await assert.rejects(lifecycle('install'));assert.equal(data.size,0);redirect=false;
 await lifecycle('install');assert.deepEqual([...data.keys()],['/offline.html']);
 await lifecycle('activate');assert.deepEqual(deleted,['hamnafas-public-offline-v0']);assert.equal(claimed,true);
 assert.equal(await (await navigate()).text(),'PRIVATE LIVE PAGE');assert.equal(data.size,1);
 for(const args of [['/api/records'],['/api/auth/login','POST'],['/mcp'],['/api/files/download'],['/','POST'],['/','GET','cors']])assert.equal(await navigate(...args),undefined);
 fail=true;assert.ok((await (await navigate()).text()).includes('hamnafas-public-offline'));assert.equal(data.size,1);
 data.clear();assert.equal((await navigate()).status,503);
 console.log('PASS: manifest icons, standalone configuration, public-only offline cache, auth redirect rejection, no API/file/mutation interception, cache ownership, online network-first and offline fallback.');
})().catch(e=>{console.error(e);process.exit(1)});
