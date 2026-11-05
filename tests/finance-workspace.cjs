const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),ts=require('typescript'),React=require('react');
const root=path.resolve(__dirname,'..');
function compile(file,require,extras={}){const exports={};vm.runInNewContext(ts.transpileModule(fs.readFileSync(path.join(root,file),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText,{exports,require,console,...extras});return exports}
const model=compile('lib/finance-workspace.ts',()=>{throw Error('Pure finance navigation must not load a domain')});
const admin={isAdmin:true},staff={isAdmin:false},apps=[{key:'finance'},{key:'treasury'},{key:'sales-bank'},{key:'costing'},{key:'personnel'},{key:'sourcing'}];
assert.deepEqual(Array.from(model.financeHomeApps(apps,admin),x=>x.key),['finance','personnel','sourcing']);assert.equal(model.financeHomeApps(apps,staff),apps);assert.equal(model.financeHomeAliases(admin).treasury,'finance');assert.equal(Object.keys(model.financeHomeAliases(staff)).length,0);
for(const key of model.financeStandaloneSections){const target='case:123 / قرارداد';const parsed=model.parseFinanceTarget(model.financeTarget(key,target));assert.equal(parsed.key,key);assert.equal(parsed.target,target)}
assert.equal(model.parseFinanceTarget(model.financeTarget('finance-control','sourcing:PLAN')).key,'purchase-review');assert.equal(model.parseFinanceTarget('finance:unknown:x'),null);assert.equal(model.parseFinanceTarget('finance:treasury:%ZZ'),null);
let slots=[],cursor=0;const leaves={},leaf=name=>leaves[name]||(leaves[name]=function Leaf(){return null});
const ui=compile('components/trace/finance-workspace.tsx',n=>{if(n==='react')return {...React,useState:init=>{const i=cursor++;if(!(i in slots))slots[i]=typeof init==='function'?init():init;return [slots[i],v=>slots[i]=v]},useEffect:()=>{}};if(n==='react/jsx-runtime')return require(n);if(n==='@/lib/finance-workspace')return model;if(n.startsWith('./'))return new Proxy({},{get:(_,name)=>leaf(name)});throw Error(n)});
const nodes=x=>Array.isArray(x)?x.flatMap(nodes):React.isValidElement(x)?[x,...nodes(x.props.children)]:[];
const render=(user=admin,targetId='')=>{cursor=0;return ui.FinanceWorkspace({user,targetId})};
let tree=render();assert.ok(!nodes(tree).some(n=>n.type===leaves.TreasuryPanel),'No financial domain mounts before selection');
const menu=nodes(tree).find(n=>n.type===leaves.SubprogramNavigation);assert.equal(menu.props.items.length,model.financeEntries.length);menu.props.onChange('payables');tree=render();assert.ok(nodes(tree).some(n=>n.type===leaves.PurchasePayablesPanel));assert.ok(!nodes(tree).some(n=>n.type===leaves.TreasuryPanel));
slots=[];tree=render(admin,model.financeTarget('treasury','payment-123'));assert.equal(nodes(tree).find(n=>n.type===leaves.TreasuryPanel).props.targetId,'payment-123');
slots=[];tree=render(staff,model.financeTarget('treasury','private'));assert.ok(!nodes(tree).some(n=>Object.values(leaves).includes(n.type)),'Non-admin cannot mount any financial domain via the hub');
slots=[];tree=render(admin,model.financeTarget('payroll'));assert.equal(nodes(tree).find(n=>n.type===leaves.PersonnelPanel).props.initialManagementView,'hr_payroll');
console.log('PASS finance hub: admin-only grouping, preserved staff home and domain access, saved-layout aliases, deep-link roundtrip, invalid-target rejection, one mounted financial domain, preserved payment target and direct payroll entry');
