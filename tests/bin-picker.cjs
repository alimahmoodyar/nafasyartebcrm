const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
const vm = require('node:vm');
const path = require('node:path');
const source = fs.readFileSync(path.join(__dirname,'../components/trace/batch-placement.tsx'),'utf8');
const exportsForTest = {};
vm.runInNewContext(ts.transpile(source,{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX,target:ts.ScriptTarget.ES2022}),{
 exports:exportsForTest, require:id=>id==='@/lib/production'?{}:require(id)
});
function fields(node) {
 if (Array.isArray(node)) return node.flatMap(fields);
 if (!node?.props) return [];
 if (['input','select'].includes(node.type)) return [node];
 return fields(node.props.children);
}
let location='';
const picker=options=>fields(exportsForTest.BinPicker({options,value:location,onChange:v=>{location=v}}));
['A','2','3','4'].forEach((value,i)=>{
 const inputs=picker([]);
 assert.equal(inputs.length,4);
 inputs[i].props.onChange({target:{value}});
});
assert.equal(location,'A-2-3-4');
const choices=picker(['A-2-3-4','B-1-1-1','old']);
assert.equal(choices.length,5);
choices[0].props.onChange({target:{value:'B'}});
assert.equal(location,'B-1-1-1');
choices[4].props.onChange({target:{value:'old'}});
assert.equal(location,'old');
console.log('PASS: four manual fields, cascading configured bins and mixed legacy addresses');
