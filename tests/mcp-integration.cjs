const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),ts=require('typescript');
const {DatabaseSync}=require('node:sqlite');const root=path.resolve(__dirname,'..');const sql=new DatabaseSync(':memory:');sql.exec('PRAGMA foreign_keys=ON');for(const f of fs.readdirSync(path.join(root,'drizzle')).filter(f=>f.endsWith('.sql')).sort())sql.exec(fs.readFileSync(path.join(root,'drizzle',f),'utf8'));
const db={prepare(q){let args=[];return{bind(...a){args=a;return this},async first(){return sql.prepare(q).get(...args)||null},async all(){return {results:sql.prepare(q).all(...args)}},async run(){return {meta:{changes:sql.prepare(q).run(...args).changes}}}}},async batch(stmts){sql.exec('BEGIN');try{const r=[];for(const s of stmts)r.push(await s.run());sql.exec('COMMIT');return r;}catch(e){sql.exec('ROLLBACK');throw e;}}};
const objects=new Map();const bucket={async put(k,b){objects.set(k,b.slice(0));return {key:k}},async get(k){const b=objects.get(k);return b?{arrayBuffer:async()=>b.slice(0)}:null},async delete(k){objects.delete(k)}};
let identity=null;const env={TRACE_OWNER_EMAIL:'owner@example.com',LLM_CONFIG_ENCRYPTION_KEY:require('node:crypto').randomBytes(32).toString('base64'),DB:db,BUCKET:bucket};
const cache={};function load(file){file=path.resolve(root,file);if(cache[file])return cache[file];const exports={};cache[file]=exports;const source=ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
vm.runInNewContext(source,{exports,require:n=>{if(n==='cloudflare:workers')return {env};if(n==='@/app/chatgpt-auth')return {getChatGPTUser:async()=>identity};if(n.startsWith('@/')||n.startsWith('.')){const p=n.startsWith('@/')?path.join(root,n.slice(2)):path.resolve(path.dirname(file),n);return load(p+(path.extname(p)?'':'.ts'));}return require(n)},Response,Request,URL,URLSearchParams,Error,crypto:globalThis.crypto,Date,Intl,Set,Map,FormData,Blob,File,TextEncoder,TextDecoder,Uint8Array,ArrayBuffer,AbortController,ReadableStream,btoa,atob,setTimeout:(f,n)=>setTimeout(f,Math.min(n,10)),clearTimeout,console},{filename:file});return exports;}
const auth=load('lib/authorization.ts'),http=load('app/mcp/route.ts'),sse=load('lib/mcp/sse.ts'),tokens=load('app/api/mcp-tokens/route.ts'),configs=load('app/api/llm-config/route.ts'),secrets=load('lib/llm-secrets.ts'),catalog=load('lib/mcp/tools.ts');
const base='https://test.local';const owner={userId:'owner',email:'owner@example.com',displayName:'Owner',fullName:null};
const request=(path,method='GET',body,headers={})=>new Request(base+path,{method,headers:{origin:base,...(body?{'Content-Type':'application/json'}:{}),...headers},...(body?{body:JSON.stringify(body)}:{})});
const rpc=(method,params={},id=1)=>({jsonrpc:'2.0',method,params,id});
let token;
async function call(name,args={},key=token){const r=await http.POST(request('/mcp','POST',rpc('tools/call',{name,arguments:args}),key?{authorization:'Bearer '+key}:{}));assert.equal(r.status,200);const d=await r.json();if(d.result?.isError)return {error:d.result.content[0].text};return JSON.parse(d.result.content[0].text);}
async function mint(scope='read'){return (await (await tokens.POST(request('/api/mcp-tokens','POST',{name:'test',scope,days:1}))).json());}
(async()=>{
 assert.equal((await http.POST(request('/mcp','POST',rpc('tools/call',{name:'get_session'})))).status,401);
 assert.equal((await http.POST(request('/mcp','POST',rpc('tools/list')))).status,200);
 identity=owner;const admin=await auth.session();
 assert.equal((await http.POST(request('/mcp','POST',rpc('tools/list'),{origin:'https://evil.test'}))).status,403);
 assert.equal((await http.POST(request('/mcp','POST',rpc('tools/list'),{'mcp-protocol-version':'invalid'}))).status,400);
 const init=await (await http.POST(request('/mcp','POST',rpc('initialize',{protocolVersion:'2025-06-18'})))).json();assert.equal(init.result.protocolVersion,'2025-06-18');
 const discovery=await (await http.POST(request('/mcp','POST',rpc('tools/list')))).json();assert.ok(discovery.result.tools.length>=35);assert.equal(new Set(discovery.result.tools.map(t=>t.name)).size,discovery.result.tools.length);assert.equal((await http.POST(request('/mcp','POST',{jsonrpc:'2.0',method:'notifications/initialized'}))).status,202);
 assert.ok((await call('create_record',{kind:'product',data:{}})).error); // missing approval
 const id=crypto.randomUUID(),profile={id,revision:0,name:'Provider',model:'test-model',baseUrl:'https://api.example.com/v1',systemPrompt:'Private system instructions',temperature:0.4,maxTokens:2048,apiToken:'secret-provider-token'};
 let r=await configs.PUT(request('/api/llm-config','PUT',profile));assert.equal(r.status,201);assert.ok(!(await r.text()).includes('secret-provider-token'));
 let row=sql.prepare('SELECT * FROM llm_configs WHERE id=?').get(id);assert.ok(row.token_ciphertext&&!row.token_ciphertext.includes('secret-provider-token'));assert.equal(await secrets.decryptToken(row.token_ciphertext,id),'secret-provider-token');
 assert.ok(!JSON.stringify(sql.prepare('SELECT * FROM access_audit').all()).includes('secret-provider-token'));
 assert.equal((await configs.PUT(request('/api/llm-config','PUT',{...profile,revision:1,apiToken:'',baseUrl:'https://different.example/v1'}))).status,400);
 assert.equal((await configs.PUT(request('/api/llm-config','PUT',{...profile,apiToken:''}))).status,409);
 r=await configs.PUT(request('/api/llm-config','PUT',{...profile,revision:1,apiToken:'',name:'Updated'}));assert.equal(r.status,200);assert.equal(sql.prepare('SELECT token_ciphertext FROM llm_configs WHERE id=?').get(id).token_ciphertext,row.token_ciphertext);
 const read=await mint();token=read.token;identity=null;assert.ok(token.startsWith('nfy_'));assert.ok(!JSON.stringify(sql.prepare('SELECT * FROM mcp_tokens').all()).includes(token));
 assert.equal((await call('get_session')).userId,'owner');assert.ok((await call('list_llm_configs')).profiles[0].hasToken);assert.ok((await call('delete_llm_config',{id,revision:2,confirmed:true})).error);
 const cal=await call('get_calendar_context',{dates:['۱۴۰۵/۰۷/۱۱','۱۴۰۴/۱۲/۳۰']});assert.equal(cal.timeZone,'Asia/Tehran');assert.equal(cal.dates[0].iso,'2026-10-03');assert.equal(cal.dates[0].persian,'1405/07/11');assert.ok(cal.dates[1].error);
 const product={code:'TEST1',name:'Test',group:'Oxygen',model:'M1',warrantyMonths:'12',status:'فعال'};
 assert.ok((await call('create_record',{kind:'product',data:product,confirmed:true})).error);assert.equal(sql.prepare('SELECT count(*) AS n FROM records').get().n,0);
 identity=owner;const write=await mint('read_write');token=write.token;identity=null;
 let made=await call('create_record',{kind:'product',data:product,confirmed:true});assert.ok(made.record?.id);const prod=made.record;
 let listed=await call('list_records',{kind:'product',limit:1});assert.equal(listed.total,1);assert.equal(listed.records[0].previous,JSON.stringify(prod.data));
 let changed=await call('update_record',{id:prod.id,previous:listed.records[0].previous,data:{...prod.data,name:'Changed'},confirmed:true});assert.equal(changed.record.data.name,'Changed');assert.ok((await call('update_record',{id:prod.id,previous:listed.records[0].previous,data:{...prod.data,name:'Again'},confirmed:true})).error);
 const device=await call('create_record',{kind:'device',data:{product:prod.id,code:'TEST-001',model:'M1',design:'1',date:'2026-10-01'},confirmed:true});assert.ok(device.record?.id);assert.equal((await call('get_device_passport',{serial:'test-001'})).device.id,device.record.id);
 const importedDate=await call('preview_distribution_import',{rows:[{row:2,data:{serial:'TEST-001',dealerName:'Date test',dealerDate:'۱۴۰۵/۰۷/۱۱'}}]});assert.equal(importedDate.preview[0].data.dealerDate,'2026-10-03');assert.equal(importedDate.preview[0].status,'new');
 const batch=await call('create_record',{kind:'batch',data:{part:'Compressor',date:'2026-10-01',code:'B-001',supplier:'Test',quantity:'10',unit:'عدد',status:'تأیید'},confirmed:true});assert.ok(batch.record?.id);
 const fileId=crypto.randomUUID(),bytes=btoa('date,amount\n2026-10-01,10');let uploaded=await call('upload_batch_file',{batch:batch.record.id,requestId:fileId,filename:'test.csv',base64:bytes,confirmed:true});assert.ok(!uploaded.error,JSON.stringify(uploaded));let download=await call('download_batch_file',{batch:batch.record.id,id:fileId,length:4});assert.equal(atob(download.base64),'date');assert.equal(download.nextOffset,4);
 assert.ok((await call('upload_batch_file',{batch:batch.record.id,requestId:crypto.randomUUID(),filename:'bad.csv',base64:'???',confirmed:true})).error);
 // Admin record management: safe edits, immutable codes and guarded deletion.
 const fresh=await call('create_record',{kind:'batch',data:{...batch.record.data,code:'B-DELETE'},confirmed:true});
 let edit=await call('update_record',{id:fresh.record.id,previous:JSON.stringify(fresh.record.data),data:{...fresh.record.data,supplier:'Corrected',quantity:'20'},confirmed:true});assert.equal(edit.record.data.quantity,'20');
 assert.ok((await call('update_record',{id:fresh.record.id,previous:JSON.stringify(edit.record.data),data:{...edit.record.data,code:'OTHER'},confirmed:true})).error);
 assert.ok((await call('delete_record',{id:fresh.record.id,previous:JSON.stringify(fresh.record.data),confirmed:true})).error);
 assert.equal((await call('delete_record',{id:fresh.record.id,previous:JSON.stringify(edit.record.data),confirmed:true})).deleted,true);
 assert.equal(sql.prepare("SELECT count(*) AS n FROM access_audit WHERE target=? AND action='delete_record'").get(fresh.record.id).n,1);
 assert.ok((await call('delete_record',{id:batch.record.id,previous:JSON.stringify(batch.record.data),confirmed:true})).error); // attachment
 const currentProduct=JSON.parse(sql.prepare('SELECT payload FROM records WHERE id=?').get(prod.id).payload);
 assert.ok((await call('delete_record',{id:prod.id,previous:JSON.stringify(currentProduct),confirmed:true})).error); // device
 sql.prepare('INSERT INTO records(id,kind,payload,created) VALUES(?,?,?,?)').run('linked-event','event',JSON.stringify({batch:batch.record.id}),new Date().toISOString());
 const corrected=await call('update_record',{id:batch.record.id,previous:JSON.stringify(batch.record.data),data:{...batch.record.data,quantity:'100'},confirmed:true});assert.equal(corrected.record.data.quantity,'100');batch.record=corrected.record;
 const notes=await call('update_record',{id:batch.record.id,previous:JSON.stringify(batch.record.data),data:{...batch.record.data,notes:'Inspection note'},confirmed:true});assert.equal(notes.record.data.notes,'Inspection note');
 const unusedProduct=await call('create_record',{kind:'product',data:{...product,code:'UNUSED'},confirmed:true});assert.equal((await call('delete_record',{id:unusedProduct.record.id,previous:JSON.stringify(unusedProduct.record.data),confirmed:true})).deleted,true);
 // A read-only member token cannot gain admin or production privileges.
 const permissions={read:['device'],write:[],eventStages:[],finance:'none'};sql.prepare('INSERT INTO app_members(id,email,name,unit,status,subject,permissions,created,updated) VALUES(?,?,?,?,?,?,?,?,?)').run('reader','reader@example.com','Reader','unit','active','reader',JSON.stringify(permissions),new Date().toISOString(),new Date().toISOString());
 const restricted='nfy_'+'a'.repeat(64),hash=await load('lib/mcp/auth.ts').tokenHash(restricted);sql.prepare('INSERT INTO mcp_tokens(id,token_hash,subject,email,name,scope,expires,created) VALUES(?,?,?,?,?,?,?,?)').run('r',hash,'reader','reader@example.com','R','read_write',new Date(Date.now()+100000).toISOString(),new Date().toISOString());
 assert.ok((await call('list_users',{},restricted)).error);assert.ok((await call('create_record',{kind:'product',data:product,confirmed:true},restricted)).error);assert.ok((await call('list_llm_configs',{},restricted)).error);
 assert.ok((await call('delete_record',{id:batch.record.id,previous:JSON.stringify(notes.record.data),confirmed:true},restricted)).error);
 assert.equal((await call('get_device_passport',{serial:'TEST-001'},restricted)).product,null);
 sql.prepare("UPDATE app_members SET status='disabled' WHERE id='reader'").run();assert.equal((await http.POST(request('/mcp','POST',rpc('tools/list'),{authorization:'Bearer '+restricted}))).status,403);
 // Full legacy SSE: endpoint, POST message, streamed response, replay, isolation and revocation.
 const streamResponse=await sse.openStream(request('/sse?token='+token));assert.equal(streamResponse.status,200);assert.match(streamResponse.headers.get('content-type'),/text\/event-stream/);let reader=streamResponse.body.getReader();const first=new TextDecoder().decode((await reader.read()).value);assert.match(first,/event: endpoint/);const endpoint=first.split('data: ')[1].split('\n')[0];
 assert.equal((await sse.postMessage(request(endpoint,'POST',rpc('initialize',{protocolVersion:'2024-11-05'},91)))).status,202);
 let output='',lastId='';for(let i=0;i<20&&!output.includes('"id":91');i++){const chunk=await reader.read();output+=new TextDecoder().decode(chunk.value);}assert.match(output,/"protocolVersion":"2024-11-05"/);lastId=output.match(/id: ([^\n]+)/)[1];
 assert.equal((await sse.postMessage(request(endpoint.replace(token,read.token),'POST',rpc('ping',{},92)))).status,404);
 const mutation=rpc('tools/call',{name:'create_record',arguments:{kind:'product',data:{...product,code:'SSE2'},confirmed:true}},92);await sse.postMessage(request(endpoint,'POST',mutation));await sse.postMessage(request(endpoint,'POST',mutation));assert.equal(sql.prepare("SELECT count(*) AS n FROM records WHERE json_extract(payload,'$.code')='SSE2'").get().n,1);
 assert.equal((await sse.postMessage(request(endpoint,'POST',rpc('ping',{},92)))).status,409);
 await reader.cancel();const resumed=await sse.openStream(request('/sse?token='+token,'GET',undefined,{'last-event-id':lastId}));assert.equal(resumed.status,200);reader=resumed.body.getReader();output='';for(let i=0;i<20&&!output.includes('"id":92');i++)output+=new TextDecoder().decode((await reader.read()).value);assert.match(output,/SSE2/);await reader.cancel();
 identity=owner;assert.equal((await tokens.DELETE(request('/api/mcp-tokens?id='+write.id,'DELETE'))).status,200);identity=null;assert.equal((await http.POST(request('/mcp','POST',rpc('tools/list'),{authorization:'Bearer '+token}))).status,401);assert.equal((await sse.openStream(request('/sse?token='+token))).status,401);
 assert.equal(sql.prepare('SELECT count(*) AS n FROM mcp_streams WHERE token_id=?').get(write.id).n,0);
 assert.ok(!JSON.stringify(sql.prepare('SELECT * FROM access_audit').all()).includes(write.token));
 console.log('MCP integration passed: '+discovery.result.tools.length+' tools; auth/scopes/origin; encrypted redacted LLM profiles; optimistic concurrency; records and files; SSE handshake/messages/replay/idempotency/isolation/revocation.');
})().catch(e=>{console.error(e);process.exit(1)});
