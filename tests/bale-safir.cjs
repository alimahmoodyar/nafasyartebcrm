const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const ts=require('typescript');

const objects=new Map();
const env={
 LLM_CONFIG_ENCRYPTION_KEY:Buffer.alloc(32,5).toString('base64'),
 BUCKET:{
  async get(key){const data=objects.get(key);return data?{arrayBuffer:async()=>data.slice().buffer}:null;},
  async put(key,value){objects.set(key,value.slice());},
 },
};
let admin=false,training=false,agent=false;
let providerResult={message_id:'message-1',error_data:null};
const sent=[],warnings=[];
class AccessError extends Error{constructor(message,status){super(message);this.status=status;}}
const authorization={
 AccessError,
 accessResponse:error=>error instanceof AccessError?Response.json({error:error.message},{status:error.status}):null,
 requireAdmin:async()=>{if(!admin)throw new AccessError('Manager required',403);},
 checkOrigin:request=>{if(request.headers.get('origin')!==new URL(request.url).origin)throw new AccessError('Origin denied',403);},
};

const cache=new Map();
function load(relative){
 const file=path.resolve(relative);
 if(cache.has(file))return cache.get(file);
 const exports={};
 cache.set(file,exports);
 const source=ts.transpileModule(fs.readFileSync(file,'utf8'),{
  compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022},
 }).outputText;
 vm.runInNewContext(source,{
  exports,Date,URL,Request,Response,TextEncoder,TextDecoder,Uint8Array,AbortSignal,crypto,btoa,atob,
  console:{warn:(...args)=>warnings.push(args)},
  fetch:async(url,options)=>{
   assert.equal(url,'https://safir.bale.ai/api/v3/send_message');
   assert.equal(options.redirect,'error');
   sent.push({key:options.headers['api-access-key'],body:JSON.parse(options.body)});
   return Response.json(providerResult);
  },
  require(name){
   if(name==='cloudflare:workers')return {env};
   if(name.endsWith('/authorization'))return authorization;
   if(name.endsWith('/training-context'))return {trainingContext:{getStore:()=>training||undefined}};
   if(name.endsWith('/mcp/context'))return {mcpActor:{getStore:()=>agent||undefined}};
   if(name.endsWith('/firmware-storage'))return {boundedBody:request=>request.arrayBuffer()};
   if(name.startsWith('@/'))return load(name.slice(2)+'.ts');
   if(name.startsWith('.'))return load(path.resolve(path.dirname(file),name)+'.ts');
   return require(name);
  },
 },{filename:file});
 return exports;
}

(async()=>{
 const api=load('app/api/integrations/bale/safir/route.ts'),{mirrorBaleSms}=load('lib/bale-safir.ts');
 const base='https://test.local';
 const key='synthetic-provider-key';
 const save=(fields,origin=base)=>api.PUT(new Request(base+'/api/integrations/bale/safir',{
  method:'PUT',headers:{origin,'Content-Type':'application/json'},body:JSON.stringify(fields),
 }));
 assert.equal((await api.GET()).status,403);
 admin=true;agent=true;assert.equal((await api.GET()).status,403);agent=false;
 assert.equal((await save({botId:'1',enabled:true,apiKey:key},'https://other.test')).status,403);
 assert.equal((await save({botId:'1e3',enabled:true,apiKey:key})).status,400);
 assert.deepEqual(await (await api.GET()).json(),{botId:null,hasKey:false,enabled:false});
 await mirrorBaleSms('09120000123','hello');
 assert.equal(sent.length,0);

 const stored=await save({botId:'۱۲۳۴۵۶',enabled:true,apiKey:key});
 assert.equal(stored.status,200,await stored.clone().text());
 assert.deepEqual(await stored.json(),{botId:123456,hasKey:true,enabled:true});
 assert.ok([...objects.values()].every(value=>!new TextDecoder().decode(value).includes(key)));

 await mirrorBaleSms('09120000123','hello');
 assert.equal(sent[0].key,key);
 assert.equal(sent[0].body.bot_id,123456);
 assert.equal(sent[0].body.phone_number,'989120000123');
 assert.deepEqual(sent[0].body.message_data,{message:{text:'hello'}});
 assert.match(sent[0].body.request_id,/^[a-f0-9-]{36}$/);
 await mirrorBaleSms('09120000123','رمز حساب','012345');
 assert.deepEqual(sent[1].body.message_data,{otp_message:{otp:'012345'}});
 assert.notEqual(sent[1].body.request_id,sent[0].body.request_id);

 providerResult={error_data:[{code:17,phone_number:'989120000123'}]};
 await mirrorBaleSms('09120000123','hello');
 assert.equal(warnings.length,0);
 providerResult={error_data:[{code:20,description:key}]};
 await mirrorBaleSms('09120000123','hello');
 assert.equal(warnings.length,1);
 assert.ok(!JSON.stringify(warnings).includes(key));
 training=true;await mirrorBaleSms('09120000123','hello');training=false;
 await mirrorBaleSms('not-a-number','hello');
 assert.equal(sent.length,4);

 assert.equal((await save({botId:'123456',enabled:false,apiKey:''})).status,200);
 await mirrorBaleSms('09120000123','hello');
 assert.equal(sent.length,4);
 console.log('Bale Safir passed: admin-only encrypted setup, delivery by mobile, OTP, absent recipients, disabled config and training isolation.');
})().catch(error=>{console.error(error);process.exitCode=1;});