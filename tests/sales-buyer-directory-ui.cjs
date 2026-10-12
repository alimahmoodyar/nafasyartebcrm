const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),ts=require('typescript'),React=require('react');
const root=path.resolve(__dirname,'..'),cache={};let slots=[],cursor=0,back;
function pure(file){if(cache[file])return cache[file];const exports={};cache[file]=exports;vm.runInNewContext(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{exports,Intl,Date,require:n=>pure(path.resolve(path.dirname(file),n+'.ts'))});return exports;}
const out={};vm.runInNewContext(ts.transpileModule(fs.readFileSync(path.join(root,'components/trace/sales-buyer-directory.tsx'),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText,{exports:out,Set,require:n=>n==='react'?{useState:init=>{const i=cursor++;if(!(i in slots))slots[i]=init;return [slots[i],v=>slots[i]=v]}}:n==='react/jsx-runtime'?require(n):n.includes('buyer-search')?pure(path.join(root,'lib/buyer-search.ts')):n.includes('sales-network-contract')?pure(path.join(root,'lib/sales-network-contract.ts')):n==='./program-workspace'?{useWorkspaceBack:(fn,enabled)=>{back=enabled?fn:null;return ()=>{}}}:{NumberInput:'NumberInput'}});
const row=(id,name,kind='representative',active=true)=>({id,canOperate:true,data:{name,kind,active,ownerId:'seller',contact:'هماهنگ‌کننده',mobile:'09123456789',province:'تهران',city:'تهران'}});
let agents=[row('baran','باران سلامت'),row('branch','شعبه اصفهان','branch'),row('consumer','علي كريمي','end_customer',false),row('referrer','معرف سلامت','referrer')],members=[{id:'seller',name:'سولماز ابراهیم‌زاده'}],opened=[];
const nodes=x=>Array.isArray(x)?x.flatMap(nodes):React.isValidElement(x)?[x,...nodes(x.props.children)]:[];
const text=x=>Array.isArray(x)?x.map(text).join(''):React.isValidElement(x)?text(x.props.children):x==null?'':String(x);
function render(initialBuyerId=''){cursor=0;return out.SalesBuyerDirectory({agents,members,initialBuyerId,createAction:React.createElement('button',{},'CREATE'),renderDossier:a=>{opened.push(a.id);return React.createElement('div',{'data-buyer':a.id},'PROFILE_'+a.id)}});}
const field=label=>nodes(render()).find(n=>n.type==='label'&&text(n).startsWith(label));
const change=(label,value)=>nodes(field(label)).find(n=>n.type==='select'||n.type==='NumberInput').props.onChange({target:{value}});
const cards=()=>nodes(render()).filter(n=>n.type==='article');
const before=JSON.stringify(agents);
assert.equal(cards().length,4);assert.deepEqual(opened,[],'Listing/searching does not open or mutate business records');
change('جست‌وجوی نام','علی کریمی');assert.equal(cards().length,1,'Persian/Arabic names match');assert.ok(text(cards()[0]).includes('علي كريمي'));
change('جست‌وجوی نام','سولماز ابراهیم زاده');assert.equal(cards().length,4,'Search includes assigned expert and normalizes zero-width spaces');
change('جست‌وجوی نام','۰۹۱۲۳۴۵۶۷۸۹');assert.equal(cards().length,4,'Persian phone digits match');
change('جست‌وجوی نام','');change('نوع خریدار','branch');assert.equal(cards().length,1);assert.ok(text(cards()[0]).includes('شعبه اصفهان'));
change('نوع خریدار','');change('وضعیت پرونده','inactive');assert.equal(cards().length,1);change('وضعیت پرونده','');
change('جست‌وجوی نام','باران');const open=nodes(cards()[0]).find(n=>n.type==='button');open.props.onClick();assert.ok(text(render()).includes('PROFILE_baran'));assert.equal(nodes(render()).filter(n=>n.type==='article').length,0,'Only selected dossier is shown');assert.ok(back,'Header back returns to directory');back();assert.equal(cards().length,1,'Back preserves directory search');
change('جست‌وجوی نام','missing');assert.ok(text(render()).includes('پرونده‌ای پیدا نشد'));assert.equal(cards().length,0);
slots=[];render('baran');assert.ok(text(render('baran')).includes('PROFILE_baran'),'Existing selected buyer opens directly');agents=agents.filter(a=>a.id!=='baran');assert.ok(text(render()).includes('این پرونده در فهرست فعلی شما نیست'));assert.ok(!text(render()).includes('PROFILE_baran'),'Removed authority never renders stale dossier');
agents=[];slots=[];assert.ok(text(render()).includes('پرونده‌ای در دسترسی شما نیست'));assert.deepEqual(JSON.stringify([row('baran','باران سلامت'),row('branch','شعبه اصفهان','branch'),row('consumer','علي كريمي','end_customer',false),row('referrer','معرف سلامت','referrer')]),before,'Filtering and opening preserve source records');
console.log('PASS unified buyer directory: Persian name/expert/phone search, kind/status filters, selected dossier, retained search on back, direct selection, missing permission and empty states without mutations.');
