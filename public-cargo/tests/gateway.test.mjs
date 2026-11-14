import test from 'node:test';
import assert from 'node:assert/strict';
import {Script} from 'node:vm';
import worker,{handle,BACKEND} from '../worker/index.js';
const origin='https://cargo.test',env={CARGO_BACKEND_SERVICE_TOKEN:'synthetic-private-secret'},key={missionId:crypto.randomUUID(),token:'f'.repeat(64)},body={...key,mode:'read'};
const req=(data=body,headers={})=>new Request(origin+'/api/handover',{method:'POST',headers:{origin,'Content-Type':'application/json',...headers},body:JSON.stringify(data)});
test('anonymous shell, valid client JavaScript, no private secret or identity requirement',async()=>{
 const r=await worker.fetch(new Request(origin+'/transport/handover'),env,{});assert.equal(r.status,200);const html=await r.text();assert.ok(html.includes('دریافت بار'));assert.ok(!html.includes(env.CARGO_BACKEND_SERVICE_TOKEN));assert.ok(!html.includes(BACKEND));assert.match(r.headers.get('content-security-policy'),/frame-ancestors 'none'/);assert.equal(r.headers.get('referrer-policy'),'no-referrer');assert.equal(r.headers.get('cache-control'),'no-store');
 const script=html.match(/<script nonce="[^"]+">([\s\S]*?)<\/script>/)[1];new Script(script);assert.match(script,/getUserMedia/);assert.match(script,/toBlob/);assert.ok(!script.includes('innerHTML'));assert.ok(!script.includes('localStorage'));
});
test('only fixed POST endpoint; cookies and caller identity never forwarded; output allowlist',async()=>{
 let calls=0;const r=await handle(req(body,{cookie:'owner-cookie',authorization:'Bearer owner','oai-authenticated-user-id':'owner'}),env,async(url,options)=>{
  calls++;assert.equal(url,BACKEND+'/api/transport/handover');assert.equal(options.redirect,'error');assert.equal(options.headers.Origin,BACKEND);assert.equal(options.headers['OAI-Sites-Authorization'],'Bearer '+env.CARGO_BACKEND_SERVICE_TOKEN);assert.equal(options.headers.cookie,undefined);assert.equal(options.headers.authorization,undefined);assert.equal(options.headers['oai-authenticated-user-id'],undefined);assert.deepEqual(JSON.parse(new TextDecoder().decode(options.body)),body);
  return Response.json({id:key.missionId,code:'cargo-1',totalRial:'999',externalAccess:{tokenHash:'secret'},items:[{name:'part',quantity:1,unit:'item',unitPrice:'999',internal:'private'}]});
 });assert.equal(calls,1);assert.deepEqual(await r.json(),{id:key.missionId,code:'cargo-1',items:[{name:'part',quantity:1,unit:'item'}]});
 for(const path of ['/api/finance','/api/transport/external-link','/api/handover?url=https://evil.test','/signin-with-chatgpt'])assert.equal((await handle(new Request(origin+path),env)).status,404);
});
test('reject malformed, cross-site, absent origin, general operation and oversized inputs before upstream',async()=>{
 const never=()=>{throw Error('should not call upstream');};
 assert.equal((await handle(req(body,{origin:'https://evil.test'}),env,never)).status,403);
 assert.equal((await handle(req(body,{origin:''}),env,never)).status,403);
 assert.equal((await handle(req(body,{'sec-fetch-site':'cross-site'}),env,never)).status,403);
 for(const data of [{...body,token:'wrong'},{...body,mode:'financial_review'},{...body,missionId:'../finance'}])assert.equal((await handle(req(data),env,never)).status,400);
 assert.equal((await handle(req(body,{'Content-Length':String(12*1024*1024)}),env,never)).status,400);
 assert.equal((await handle(req(body),{},never)).status,503);
});
test('forwards photo and confirm to same handler; no redirect, HTML or upstream credential leaks',async()=>{
 const photo=new FormData();photo.set('metadata',JSON.stringify({...key,mode:'photo'}));photo.set('file',new Blob(['synthetic-photo'],{type:'image/jpeg'}),'cargo.jpg');
 const r=await handle(new Request(origin+'/api/handover',{method:'POST',headers:{origin},body:photo}),env,async(url,options)=>{assert.equal(url,BACKEND+'/api/transport/handover');const f=await new Response(options.body,{headers:{'Content-Type':options.headers['Content-Type']}}).formData();assert.equal(f.get('file').size,15);return Response.json({id:'photo-id',secret:'private'});});assert.deepEqual(await r.json(),{id:'photo-id'});
 assert.deepEqual(await (await handle(req({...body,mode:'confirm'}),env,async()=>Response.json({saved:true,repeated:true,secret:'x'}))).json(),{saved:true,repeated:true});
 for(const response of [new Response('<html>login</html>',{headers:{'Content-Type':'text/html'}}),Response.redirect('https://evil.test')]){const result=await handle(req(),env,async()=>response);assert.equal(result.status,503);assert.ok(!(await result.text()).includes('evil.test'));}
 assert.equal((await handle(req(),env,async()=>{throw Error(env.CARGO_BACKEND_SERVICE_TOKEN)})).status,503);
 assert.equal((await handle(req(),env,async()=>Response.json({error:'link expired'},{status:403}))).status,403);
});
