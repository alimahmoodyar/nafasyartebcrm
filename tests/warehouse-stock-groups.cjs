const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript');
const tree={};vm.runInNewContext(ts.transpileModule(fs.readFileSync('lib/warehouse-tree.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{exports:tree,Map,Set});
const out={};vm.runInNewContext(ts.transpileModule(fs.readFileSync('lib/warehouse-stock.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{exports:out,Map,Set,require:()=>tree});
const entry=(id,code,quantity,unit='عدد',kind='material',warehouse='w1',locations='A')=>({item_id:id,itemCode:code,quantity,unit,kind,warehouseId:warehouse,locations,warehouse:'raw',name:'Same name',row:{id,data:{code:'LOT-'+id}},passport:{details:[],lot:[{label:'Code',value:id}]}});
const lots=[entry('b1','20100040',1250),entry('b1','20100040',750,'عدد','material','w2','B'),entry('b2','20100040',3000),entry('d1','SA5',1000,'دستگاه','product'),entry('d2','SA5',1000,'دستگاه','product')];
let groups=out.groupWarehouseStock(lots);assert.equal(groups.length,2);assert.equal(groups[0].quantity,5000);assert.equal(groups[0].lotCount,2,'One batch in two locations counts once');assert.equal(groups[0].entries.length,3);assert.equal(groups[0].passport.lot.length,0,'A group never masquerades as the first lot');assert.equal(groups[1].quantity,2000);assert.equal(groups[1].lotCount,2);
assert.equal(out.groupWarehouseStock(out.filterWarehouseStock(lots,{warehouse:'w2'}))[0].quantity,750);assert.equal(out.groupWarehouseStock(out.filterWarehouseStock(lots,{query:'LOT-b2'}))[0].quantity,3000);assert.equal(out.groupWarehouseStock(out.filterWarehouseStock(lots,{query:'ناموجود'})).length,0);
assert.equal(out.groupWarehouseStock([entry('a','X',1000),entry('b','X',1000,'کیلوگرم'),entry('c','X',1000,'عدد','product')]).length,3,'Never combine different units or kinds');assert.equal(out.groupWarehouseStock([entry('a','',1000),entry('b','',1000)]).length,2,'Missing codes never merge by shared name');assert.equal(lots[0].quantity,1250,'Grouping is read-only');
console.log('PASS stock groups: batch placement totals, unique lot counts, product serial sums, filtered subtotals, units/kinds/missing-code isolation and immutable detail rows.');

const ws=[{id:'root',data:{name:'Root'}},{id:'w1',data:{name:'Child',parentId:'root'}},{id:'w2',data:{name:'Grandchild',parentId:'w1'}}];
assert.equal(out.filterWarehouseStock(lots,{warehouse:'root'},ws).length,5);
assert.equal(out.filterWarehouseStock(lots,{warehouse:'w1',includeChildren:false},ws).length,4);
assert.equal(out.filterWarehouseStock(lots,{warehouse:'root',includeChildren:false},ws).length,0);
assert.equal(tree.warehousePath(ws,'w2'),'Root / Child / Grandchild');
const reserved=out.groupWarehouseStock([{...lots[0],quantity:5000,reserved:2000},{...lots[1],quantity:3000,reserved:500}])[0];assert.equal(reserved.quantity,8000);assert.equal(reserved.reserved,2500);assert.equal(reserved.available,5500);
assert.equal(tree.warehouseDescendants([{id:'a',data:{parentId:'b'}},{id:'b',data:{parentId:'a'}}],'a').size,2,'Corrupt legacy cycles terminate');
