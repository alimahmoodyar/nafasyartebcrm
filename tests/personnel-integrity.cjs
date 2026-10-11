const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),ts=require('typescript');
const root=path.resolve(__dirname,'..'),cache=new Map();let storedRows=[];
class AccessError extends Error{constructor(message,status){super(message);this.status=status;}}
const db={prepare(){return {async all(){return {results:storedRows};}}}};
function load(name){
 const filename=path.join(root,name);if(cache.has(filename))return cache.get(filename);
 const exports={};cache.set(filename,exports);
 const source=ts.transpileModule(fs.readFileSync(filename,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
 vm.runInNewContext(source,{exports,require:n=>{
  if(n==='./storage')return {storage:()=>db};
  if(n==='./authorization')return {AccessError};
  if(n==='./personnel-contract'||n==='./persian-date')return load('lib/'+n.slice(2)+'.ts');
  return {};
 },Error,Date,Intl,BigInt,Array,Object,Set,Map,console},{filename});return exports;
}
const domain=load('lib/personnel.ts'),contract=load('lib/personnel-contract.ts');
const day='2026-10-11',created='2026-10-11T08:00:00Z';
const advance=(data={},meta={})=>({id:'advance',type:'hr_request',revision:1,created,data:{memberId:'employee',kind:'advance',state:'hr',amount:'1250',...data},...meta});
const summary=record=>contract.advanceSummary([record],'employee',day);
(async()=>{
 storedRows=[{id:'valid',type:'hr_employee',revision:1,data:'{"memberId":"employee"}'},
  ...['{','null','[]','"PRIVATE-PAYLOAD"','7'].map((data,index)=>({id:'invalid-'+index,type:'hr_request',revision:1,data}))];
 const projection=await domain.readHrRows();assert.equal(projection.rows.length,1);assert.equal(projection.rows[0].id,'valid');
 assert.deepEqual(JSON.parse(JSON.stringify(projection.issues)),storedRows.slice(1).map(({id,type})=>({id,type})));
 assert.ok(!JSON.stringify(projection.issues).includes('PRIVATE-PAYLOAD'));
 await assert.rejects(()=>domain.hrRows(),e=>e instanceof AccessError&&e.status===409&&!e.message.includes('PRIVATE-PAYLOAD'));
 storedRows=storedRows.slice(0,1);assert.equal((await domain.hrRows()).length,1);
 for(const permissions of [null,undefined,'null','[]','"text"','true','7','{'])assert.equal(domain.internal({status:'active',permissions}),false);
 assert.equal(domain.internal({status:'active',permissions:'{}'}),true);
 assert.equal(domain.internal({status:'active',permissions:{}}),true);
 assert.equal(domain.internal({status:'active',permissions:'{"salesAgentId":"outside"}'}),false);
 assert.equal(domain.internal({status:'disabled',permissions:'{}'}),false);
 const legacy=summary(advance());assert.equal(legacy.pending,'1250');assert.equal(legacy.paid,'0');assert.equal(legacy.month,contract.advanceMonth(day));
 assert.equal(summary(advance({state:'paid',payments:[{amount:'250'},{amount:'1000'}]})).paid,'1250');
 for(const amount of [undefined,null,'', 'invalid','-10','12.5',1250])assert.throws(()=>summary(advance({amount})),/مبلغ/);
 for(const payments of [null,{},'[]'])assert.throws(()=>summary(advance({payments})),/فهرست پرداخت/);
 for(const amount of [undefined,null,'bad','-1'])assert.throws(()=>summary(advance({payments:[{amount}]})),/مبلغ/);
 assert.throws(()=>summary(advance({}, {created:'invalid-date'})),/تاریخ ثبت/);
 assert.throws(()=>summary(advance({requestMonth:contract.advanceMonth(day)}, {created:'invalid-date'})),/تاریخ ثبت/);
 assert.throws(()=>summary(advance({requestMonth:'1405-13'})),/ماه ثبت/);
 assert.throws(()=>contract.advanceSummary([], 'employee', 'invalid-date'),/تاریخ گزارش/);
 console.log('Personnel integrity passed: tolerant read diagnostics, strict snapshots, fail-closed permissions, invalid financial totals, and valid legacy reporting.');
})().catch(e=>{console.error(e);process.exitCode=1;});
