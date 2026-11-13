const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),ts=require('typescript');
const {DatabaseSync}=require('node:sqlite');const root=path.resolve(__dirname,'..');const sql=new DatabaseSync(':memory:');sql.exec('PRAGMA foreign_keys=ON');for(const f of fs.readdirSync(path.join(root,'drizzle')).filter(f=>f.endsWith('.sql')).sort())sql.exec(fs.readFileSync(path.join(root,'drizzle',f),'utf8'));
let beforeBatch=null;
const db={prepare(q){let args=[];return{bind(...a){args=a;return this},async first(){return sql.prepare(q).get(...args)||null},async all(){return {results:sql.prepare(q).all(...args)}},async run(){return {meta:{changes:sql.prepare(q).run(...args).changes}}}}},async batch(stmts){if(beforeBatch){const hook=beforeBatch;beforeBatch=null;hook();}sql.exec('BEGIN');try{const r=[];for(const s of stmts)r.push(await s.run());sql.exec('COMMIT');return r;}catch(e){sql.exec('ROLLBACK');throw e;}}};
const objects=new Map();const bucket={async put(k,b){objects.set(k,b.slice(0));return {key:k}},async get(k){const b=objects.get(k);return b?{arrayBuffer:async()=>b.slice(0)}:null},async delete(k){objects.delete(k)}};
let barcodeModule=null;let identity=null;const env={TRACE_OWNER_EMAIL:'owner@example.com',LLM_CONFIG_ENCRYPTION_KEY:require('node:crypto').randomBytes(32).toString('base64'),DB:db,BUCKET:bucket};
const cache={};function load(file){file=path.resolve(root,file);if(cache[file])return cache[file];const exports={};cache[file]=exports;const source=ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
vm.runInNewContext(source,{exports,require:n=>{if(n==='@bwip-js/generic')return barcodeModule;if(n==='cloudflare:workers')return {env};if(n==='@/app/chatgpt-auth')return {getChatGPTUser:async()=>identity};if(n.startsWith('@/')||n.startsWith('.')){const p=n.startsWith('@/')?path.join(root,n.slice(2)):path.resolve(path.dirname(file),n);return load(p+(path.extname(p)?'':'.ts'));}return require(n)},Response,Request,URL,URLSearchParams,Error,crypto:globalThis.crypto,structuredClone,Date,Intl,Set,Map,FormData,Blob,File,TextEncoder,TextDecoder,Uint8Array,ArrayBuffer,AbortController,ReadableStream,btoa,atob,setTimeout:(f,n)=>setTimeout(f,Math.min(n,10)),clearTimeout,console},{filename:file});return exports;}







const migration=fs.readFileSync(path.join(root,'drizzle/0026_lookup_indexes.sql'),'utf8');sql.exec(migration);
const journal=JSON.parse(fs.readFileSync(path.join(root,'drizzle/meta/_journal.json'),'utf8'));for(const f of fs.readdirSync(path.join(root,'drizzle')).filter(f=>f.endsWith('.sql')))assert.ok(journal.entries.some(e=>e.tag===f.slice(0,-4)),'Migration must be discoverable: '+f);
const base="type='as_case' AND json_extract(data,'$.domain')='home' AND COALESCE(json_extract(data,'$.agentId'),'')=''",closed="json_extract(data,'$.state') IN ('closed','resolved','returned')";
const samples=[['idx_records_kind_code',"SELECT id FROM records WHERE kind='batch' AND json_extract(payload,'$.code')=?",['code']],['idx_flow_receipt_batch',"SELECT id FROM flow_entities WHERE type='receipt' AND json_extract(data,'$.batchId')=?",['batch']],['idx_receipt_retired_candidates',"SELECT r.id FROM flow_entities r,json_each(r.data,'$.identityHistory') h WHERE r.type='receipt' AND json_array_length(r.data,'$.identityHistory')>0 AND json_extract(h.value,'$.from.code')=? LIMIT 1",['old']],['idx_office_serial_created','SELECT id FROM flow_entities WHERE '+base+" AND json_extract(data,'$.serial')=? ORDER BY created DESC,id LIMIT 20",['serial']],['idx_office_open_created','SELECT COUNT(*) n FROM flow_entities WHERE '+base+' AND NOT ('+closed+')',[]],['idx_office_history_created','SELECT id FROM flow_entities WHERE '+base+' AND '+closed+' ORDER BY created DESC,id LIMIT 20',[]]];
samples.push(['idx_office_serial_created','SELECT id FROM flow_entities WHERE '+base+" AND json_extract(data,'$.serial')=? AND NOT ("+closed+') ORDER BY created DESC,id LIMIT 1',['serial']]);
for(const[name,q,args]of samples){const plan=sql.prepare('EXPLAIN QUERY PLAN '+q).all(...args);assert.ok(plan.some(r=>r.detail.includes(name)),name+': '+JSON.stringify(plan));}
assert.equal(sql.prepare('PRAGMA foreign_key_check').all().length,0);assert.equal(sql.prepare('PRAGMA integrity_check').get().integrity_check,'ok');
console.log('PASS lookup migration: append-only discovery, idempotent six-index schema, expected query plans without index hints or ANALYZE, integrity and foreign keys.');
