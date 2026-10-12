const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript');
const jsx=(type,props)=>({type,props}),exportsObject={};
vm.runInNewContext(ts.transpileModule(fs.readFileSync('components/trace/sales-referral-fields.tsx','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText,{exports:exportsObject,require:()=>({jsx,jsxs:jsx})});
const flatten=x=>Array.isArray(x)?x.flatMap(flatten):x&&typeof x==='object'?[x,...flatten(x.props?.children)]:[];
const text=x=>Array.isArray(x)?x.map(text).join(''):x&&typeof x==='object'?text(x.props?.children):x==null?'':String(x);
const changes=[],choices=[{id:'referrer',name:'معرف آزمایشی'}],render=(kind,value='',extra={})=>exportsObject.SalesReferralFields({kind,value,choices,onChange:id=>changes.push(id),...extra});
for(const kind of [undefined,'representative','reseller','branch'])assert.equal(render(kind),null,'Direct '+kind+' order never asks for a referrer');
assert.equal(render('end_customer','',{choices:[]}),null,'No empty/irrelevant selector');
let nodes=flatten(render('end_customer'));assert.ok(nodes.some(n=>n.type==='details'&&!n.props.open),'Optional consumer referral is collapsed by default');
assert.ok(text(nodes).includes('فروش مستقیم، بدون معرف'));nodes.find(n=>n.type==='select').props.onChange({target:{value:'referrer'}});assert.deepEqual(changes,['referrer']);
nodes=flatten(render('end_customer','referrer'));assert.ok(nodes.find(n=>n.type==='details').props.open,'Explicit selection remains visible');
for(const kind of ['representative','reseller','branch']){
 nodes=flatten(render(kind,'referrer'));assert.ok(!nodes.some(n=>n.type==='select'),'Existing explicit referral is disclosed, not a general selector');
 assert.ok(text(nodes).includes('معرف آزمایشی'));assert.ok(text(nodes).includes('قرارداد مصوب'));nodes.find(n=>n.type==='button').props.onClick();assert.equal(changes.at(-1),'');
 assert.ok(flatten(render(kind,'referrer',{disabled:true})).find(n=>n.type==='button').props.disabled,'Locked order cannot alter referral');
}
nodes=flatten(render('end_customer','not-accessible'));assert.ok(!nodes.some(n=>n.type==='select'),'An unavailable existing referral cannot look like a blank direct sale');assert.ok(text(nodes).includes('معرف پورسانتی'));
console.log('PASS referral UI: no direct representative/reseller/branch prompt, optional consumer mediation, explicit existing referral disclosure, removal and locked state.');
