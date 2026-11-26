const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const {execFileSync}=require('node:child_process');
const {performance}=require('node:perf_hooks');
const {DatabaseSync}=require('node:sqlite');
const ts=require('typescript');

const root=path.resolve(__dirname,'..');
const migration='0030_sourcing_read_indexes.sql';
const baseline=process.argv[2];
const sql=new DatabaseSync(':memory:');
sql.exec('PRAGMA foreign_keys=ON');
for(const file of fs.readdirSync(path.join(root,'drizzle')).filter(file=>file.endsWith('.sql')).sort()){
 if(file!==migration||!baseline)sql.exec(fs.readFileSync(path.join(root,'drizzle',file),'utf8'));
}
const put=sql.prepare('INSERT INTO flow_entities(id,type,data,revision,created,updated) VALUES(?,?,?,1,?,?)');
const seed=(id,type,data)=>put.run(id,type,JSON.stringify(data),'2025-01-01','2025-01-01');
const suppliers=2000,shipments=3500;
sql.exec('BEGIN');
for(let i=0;i<suppliers;i++){
 const key=String(i).padStart(5,'0');
 seed('vendor:'+key,'supplier',{route:'foreign',name:'Supplier '+key,kind:'manufacturer',active:true,country:'TR'});
 seed('part:'+key,'material',{code:'PART-'+key,name:'Part '+key,unit:'unit'});
 seed('link:'+key,'supplier_material',{materialId:'part:'+key,supplierId:'vendor:'+key,status:'pending'});
 seed('order:'+key,'purchase_order',{supplierLinkId:'link:'+key,route:'foreign',state:'confirmed',quantity:20,eta:'2025-01-04'});
 for(let receipt=0;receipt<4;receipt++){
  seed('receipt:'+key+':'+receipt,'receipt',{purchaseOrderId:'order:'+key,quantity:5,state:'accepted',accepted:5});
 }
 seed('review:'+key,'supplier_review',{linkId:'link:'+key,status:'pending'});
}
for(let i=0;i<shipments;i++){
 const key=String(i).padStart(5,'0');
 seed('shipment:'+key,'purchase_shipment',{route:i%6?'foreign':'domestic',title:'Shipment '+key,supplierName:'Supplier '+key,initial:{lines:[{code:'PART-'+key,name:'Part '+key,quantity:5}]},foreign:{physical:'preparing'},history:[{notes:'Sample event '.repeat(24)}]});
 seed('doc:'+key,'shipment_file',{shipmentId:'shipment:'+key,kind:'packing',filename:'packing.pdf',objectKey:'private-example'});
}
sql.exec('COMMIT');

let readRows=0;
const db={prepare(query){
 let args=[];
 return {bind(...values){args=values;return this;},async first(){const result=sql.prepare(query).get(...args);readRows+=Number(!!result);return result||null;},async all(){const results=sql.prepare(query).all(...args);readRows+=results.length;return {results};}};
}};
const actor={userId:'test:buyer',name:'Synthetic buyer',isAdmin:false,permissions:{read:[],write:[],eventStages:[],supplyRoles:['foreign']}};
function loader(useBaseline){
 const cache=new Map();
 const original=new Set(['app/api/suppliers/route.ts','app/api/foreign-purchases/route.ts','lib/suppliers.ts']);
 function load(relative){
  if(cache.has(relative))return cache.get(relative);
  const exports={};cache.set(relative,exports);
  const source=useBaseline&&original.has(relative)
   ?execFileSync('git',['show',baseline+':'+relative],{cwd:root,encoding:'utf8'})
   :fs.readFileSync(path.join(root,relative),'utf8');
  const script=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
  vm.runInNewContext(script,{exports,require(name){
   if(name==='cloudflare:workers')return {env:{DB:db}};
   if(name==='@/app/chatgpt-auth')return {getChatGPTUser:async()=>null};
   if(name.startsWith('@/')||name.startsWith('.')){
    const next=name.startsWith('@/')?name.slice(2):path.posix.normalize(path.posix.join(path.posix.dirname(relative),name));
    return load(next+(path.posix.extname(next)?'':'.ts'));
   }
   return require(name);
  },Response,Request,URL,URLSearchParams,Error,crypto,Date,Intl,Set,Map,FormData,Blob,File,TextEncoder,TextDecoder,Uint8Array,ArrayBuffer,AbortController,ReadableStream,btoa,atob,setTimeout,clearTimeout,console},{filename:relative});
  return exports;
 }
 return load;
}
async function measure(load,route,query,samples){
 const api=load('app/api/'+route+'/route.ts');
 const context=load('lib/mcp/context.ts').mcpActor;
 const run=async()=>{
  readRows=0;
  const start=performance.now();
  const response=await context.run(actor,()=>api.GET(new Request('https://test.local/api/'+route+'?'+query)));
  const body=await response.text();
  assert.equal(response.status,200,body.slice(0,250));
  return {ms:performance.now()-start,bytes:Buffer.byteLength(body),rows:readRows,body:JSON.parse(body)};
 };
 await run();
 const measurements=[];
 for(let i=0;i<samples;i++)measurements.push(await run());
 const sorted=measurements.map(item=>item.ms).sort((a,b)=>a-b);
 const last=measurements.at(-1);
 return {p95Ms:Number(sorted[Math.ceil(samples*.95)-1].toFixed(2)),bytes:last.bytes,rows:last.rows,body:last.body};
}
async function main(){
 const current=loader(false),old=baseline&&loader(true);
 const scopes=[
  {route:'suppliers',name:'supplier-list',before:'route=foreign',after:'route=foreign&view=list',field:'suppliers'},
  {route:'suppliers',name:'supplier-search',before:'route=foreign',after:'route=foreign&view=list&search=Supplier+00017',field:'suppliers',id:'vendor:00017'},
  {route:'suppliers',name:'supplier-detail',before:'route=foreign',after:'route=foreign&view=detail&supplier=vendor:00017',field:'suppliers',id:'vendor:00017'},
  {route:'foreign-purchases',name:'shipment-list',before:'',after:'view=shipments',field:'shipments'},
  {route:'foreign-purchases',name:'shipment-search',before:'search=PART-00017',after:'view=shipments&search=PART-00017',field:'shipments',id:'shipment:00017'},
  {route:'foreign-purchases',name:'shipment-detail',before:'id=shipment:00017',after:'view=detail&id=shipment:00017',field:'shipments',id:'shipment:00017'},
 ];
 const beforeByQuery=new Map();
 if(old){
  for(const scope of scopes){
   const key=scope.route+'?'+scope.before;
   if(!beforeByQuery.has(key))beforeByQuery.set(key,await measure(old,scope.route,scope.before,8));
  }
  sql.exec(fs.readFileSync(path.join(root,'drizzle',migration),'utf8'));
 }
 for(const scope of scopes){
  const after=await measure(current,scope.route,scope.after,30);
  const ids=after.body[scope.field].map(row=>row.id);
  if(scope.id)assert.deepEqual(ids,[scope.id]);
  else{assert.equal(ids.length,30);assert.equal(after.body.hasMore,true);}
  const before=beforeByQuery.get(scope.route+'?'+scope.before);
  if(before){
   const oldRows=before.body[scope.field];
   assert.deepEqual(ids,(scope.id?oldRows.filter(row=>row.id===scope.id):oldRows.slice(0,30)).map(row=>row.id));
   if(scope.name==='supplier-detail'){
    const links=before.body.links.filter(link=>link.data.supplierId===scope.id);
    assert.deepEqual(after.body.links,links);
    assert.deepEqual(after.body.orders,before.body.orders.filter(order=>links.some(link=>link.id===order.data.supplierLinkId)));
   }
   if(scope.name==='shipment-detail')assert.deepEqual(after.body.shipments,before.body.shipments);
   assert.ok(after.rows<before.rows,scope.name);
  }
  const {body:_after,...afterStats}=after,{body:_before,...beforeStats}=before||{};
  console.log(JSON.stringify({name:scope.name,before:before?beforeStats:null,after:afterStats}));
 }
 const lookup=await current('lib/mcp/context.ts').mcpActor.run(actor,()=>current('app/api/suppliers/route.ts').GET(new Request('https://test.local/api/suppliers?route=foreign&view=list&page=2')));
 const second=await lookup.json();
 assert.equal(second.suppliers[0].id,'vendor:00030');
 assert.equal(second.suppliers.length,30);
 const plan=sql.prepare("EXPLAIN QUERY PLAN SELECT id FROM flow_entities WHERE type='purchase_shipment' AND json_extract(data,'$.route')='foreign' ORDER BY created,id LIMIT 31").all();
 assert.ok(plan.some(step=>step.detail.includes('idx_sourcing_route_list')),JSON.stringify(plan));
 console.log('PASS scaled sourcing reads with stable pagination and matching results.');
}
main().catch(error=>{console.error(error);process.exitCode=1;});
