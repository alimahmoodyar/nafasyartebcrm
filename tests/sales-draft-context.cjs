const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const out = {};
vm.runInNewContext(ts.transpileModule(fs.readFileSync(path.join(__dirname, '../lib/sales-order-draft.ts'), 'utf8'), {compilerOptions: {module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022}}).outputText, {exports: out, require() {return {};}, Set, JSON});
const previous = {tool: 'sales_apply', args: {mode: 'order', agentId: 'buyer', items: [{productId: 'a', quantity: 1}, {productId: 'b', quantity: 2}], salesTerms: {cashBps: 4000, days: 45}}};
const draft = {...previous.args, salesTerms: {...previous.args.salesTerms}};
const resolve = (args, message = 'ادامه بده', prior = previous) => out.salesDraftArgs('sales_apply', args, prior, message);
assert.equal(resolve(draft), draft, 'Existing negotiation is retained for the same buyer and product set');
assert.equal(resolve({...draft, items: [{productId: 'b', quantity: 10}, {productId: 'a', quantity: 8}]}).salesTerms.days, 45, 'Quantity changes and row ordering do not change product policy');
for (const args of [
  {...draft, agentId: 'other-buyer'},
  {...draft, items: [{productId: 'c', quantity: 1}]},
  {...draft, items: [{productId: 'a', quantity: 1}]},
  {...draft, items: [...draft.items, {productId: 'c', quantity: 1}]},
]) assert.equal(resolve(args).salesTerms, undefined, 'Negotiation is cleared when buyer or product set changes');
for (const args of [{...draft, agentId: ''}, {...draft, items: []}, {...draft, items: [{productId: '', quantity: 1}]}]) assert.equal(resolve(args, '۴۰ درصد نقد').salesTerms, undefined, 'Even explicit negotiations need selected buyer and products');
assert.equal(resolve({...draft, items: [{productId: 'c', quantity: 1}]}, 'برای این محصول ۴۰ درصد نقد و ۴۵ روزه می‌خواهم').salesTerms.days, 45, 'An explicit new negotiation applies to the new fully selected context');
assert.equal(resolve(draft, 'ادامه بده', {...previous, tool: 'unrelated'}).salesTerms, undefined);
assert.equal(resolve(draft, 'ادامه بده', {...previous, args: {...previous.args, salesTerms: undefined}}).salesTerms, undefined, 'The model cannot invent an override when previous draft used defaults');
assert.equal(JSON.stringify(previous.args.salesTerms), '{"cashBps":4000,"days":45}', 'Sanitization never mutates previous browser data');
console.log('PASS sales draft context: buyer/product identity, stale proposal clearing, quantity/reordering preservation, explicit negotiation and incomplete-selection guards.');
