importScripts('./storage.js');
const CACHE='attendance-station-shell-r73.2';
const scope=new URL(self.registration.scope);
const local=name=>new URL(name,scope).href;
const files=['index.html','station.js','storage.js','camera.js','acknowledge.js','face-api.min.js','style.css','manifest.webmanifest','/brand/nafasyar-logo.png','/brand/hamnafas-192.png','/brand/hamnafas-512.png'];
for(const name of ['tiny_face_detector','face_landmark_68_tiny','face_recognition']){
 files.push('models/'+name+'_model-weights_manifest.json','models/'+name+'_model-shard1');
}
files.push('models/face_recognition_model-shard2');
self.addEventListener('install',event=>event.waitUntil((async()=>{
 const speechResponse=await fetch(local('speech/assets.json'),{cache:'reload'});
 if(!speechResponse.ok)throw new Error('speech manifest unavailable');
 const speech=await speechResponse.json(),cache=await caches.open(CACHE);
 for(const file of [...new Set([...files,'speech/assets.json',...speech])]){
  const url=local(file);if(new URL(url).origin!==scope.origin)throw new Error('non-local station asset');
  const response=await fetch(url,{cache:'reload'});
  if(!response.ok||response.redirected||(!url.endsWith('index.html')&&response.headers.get('content-type')?.includes('text/html')))throw new Error('station download failed');
  await cache.put(url,response);
 }
 await self.skipWaiting();
})()));
self.addEventListener('activate',event=>event.waitUntil((async()=>{
 for(const key of await caches.keys())if(key.startsWith('attendance-station-shell-')&&key!==CACHE)await caches.delete(key);
 await self.clients.claim();
})()));
self.addEventListener('fetch',event=>{
 const url=new URL(event.request.url);
 if(event.request.method!=='GET'||url.origin!==scope.origin||!(url.pathname.startsWith(scope.pathname)||files.includes(url.pathname)))return;
 if(url.href===local('speech/fa-0.42.tar.gz')){
  event.respondWith((async()=>{
   const cache=await caches.open(CACHE),paths=[0,1,2].map(i=>local('speech/fa-0.42.'+i+'.bin'));
   const parts=await Promise.all(paths.map(path=>cache.match(path)));
   if(parts.some(part=>!part?.body))return new Response('Offline model unavailable',{status:503});
   const stream=new ReadableStream({async start(controller){try{for(const part of parts){const reader=part.body.getReader();try{for(;;){const r=await reader.read();if(r.done)break;controller.enqueue(r.value)}}finally{reader.releaseLock()}}controller.close()}catch(error){controller.error(error)}}});
   return new Response(stream,{headers:{'Content-Type':'application/gzip'}});
  })());return;
 }
 const target=url.pathname===scope.pathname?local('index.html'):url.origin+url.pathname;
 event.respondWith((async()=>{const response=await (await caches.open(CACHE)).match(target);return response||fetch(event.request)})());
});

self.addEventListener('sync',event=>{
 if(event.tag!=='attendance-send')return;
 event.waitUntil((async()=>{
  const installation=await read('station','connection');
  if(installation)await flushQueue(event=>sendStationEvent(installation.token,event));
 })());
});
