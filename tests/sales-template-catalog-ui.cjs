const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const React = require('react');
const {renderToStaticMarkup} = require('react-dom/server');
const root = path.resolve(__dirname, '..');
const cache = {};
let slots = [], cursor = 0;
const controlledReact = {...React, useState(initial) {
  const i = cursor++;
  if (!(i in slots)) slots[i] = typeof initial === 'function' ? initial() : initial;
  return [slots[i], value => slots[i] = typeof value === 'function' ? value(slots[i]) : value];
}};
function load(file) {
  file = path.resolve(root, file);
  if (cache[file]) return cache[file];
  const out = {}; cache[file] = out;
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(file, 'utf8'), {compilerOptions: {
    module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true,
  }}).outputText, {exports: out, require(name) {
    if (name === 'react') return controlledReact;
    if (!name.startsWith('@/') && !name.startsWith('.')) return require(name);
    const target = name.startsWith('@/') ? path.join(root, name.slice(2)) : path.resolve(path.dirname(file), name);
    return load(fs.existsSync(target + '.ts') ? target + '.ts' : target + '.tsx');
  }, Date, Intl, JSON, Set, Map, BigInt, console}, {filename: file});
  return out;
}
const {SalesTemplateCatalog} = load('components/trace/sales-template-catalog.tsx');
const nodes = value => Array.isArray(value) ? value.flatMap(nodes) : React.isValidElement(value) ? [value, ...nodes(value.props.children)] : [];
const text = value => Array.isArray(value) ? value.map(text).join('') : React.isValidElement(value) ? text(value.props.children) : value == null ? '' : String(value);
const control = (tree, label) => nodes(tree).find(n => n.props['aria-label'] === label);
const button = (tree, label) => nodes(tree).find(n => n.type === 'button' && text(n) === label);
const templateIds = tree => nodes(tree).filter(n => n.type === 'article' && n.props['data-template-id']).map(n => n.props['data-template-id']);
const priceIds = tree => nodes(tree).filter(n => n.type === 'tr' && n.props['data-price-product']).map(n => n.props['data-price-product']);
const kinds = {representative: 'نماینده خریدار', reseller: 'عامل فروش', branch: 'شعبه', end_customer: 'مصرف‌کننده نهایی'};
const productA = {productId: 'a', name: 'دستگاه یک', code: 'P-001', model: 'MODEL-A', unitPrice: '999999999999999999', unitNet: '799999999999999999'};
const productB = {productId: 'b', name: 'دستگاه دوم', code: 'P-002', model: 'MODEL-B', unitPrice: '3333', unitNet: '2666'};
const row = (id, title, values = {}) => ({id, revision: 3, kind: 'representative', title, version: 2, templateType: 'fixed', status: 'previous', temporalStatus: 'active', isSelected: false, isFixedBaseline: false, effectiveFrom: '2026-10-01', effectiveTo: null, durationDays: null, discountBps: 2000, cashBps: 5000, days: 30, maxDays: 60, productPrices: [productA, productB], ...values});
const data = {
  today: '2026-10-12', kinds,
  products: [{id: 'a', name: productA.name, code: productA.code, model: productA.model, status: 'فعال'}, {id: 'b', name: productB.name, code: productB.code, model: productB.model, status: 'فعال'}, {id: 'missing', name: 'بدون قیمت', code: 'NO-PRICE', model: 'NONE', status: 'فعال'}],
  templates: [row('old', 'نسخه پیشین', {version: 1}), row('fixed', 'پایه امروز', {isFixedBaseline: true}), row('promotion', 'تخفیف مهر', {templateType: 'promotion', status: 'active', isSelected: true, effectiveTo: '2026-10-14', durationDays: 3, productPrices: [productA]}), row('future', 'آینده', {status: 'scheduled', temporalStatus: 'scheduled', effectiveFrom: '2026-11-01', kind: 'reseller', productPrices: [productB]}), row('expired', 'پایان تخفیف', {status: 'expired', temporalStatus: 'expired', templateType: 'promotion', effectiveTo: '2026-10-11', durationDays: 1, productPrices: [productA]}), row('legacy', 'قدیمی بدون قیمت', {status: 'active', kind: 'end_customer', productPrices: [], effectiveFrom: null})],
  prices: [
    {...productA, kind: 'representative', productStatus: 'فعال', discountBps: 2000, source: 'sales_template', sourceId: 'promotion', templateId: 'promotion', templateTitle: 'تخفیف مهر', termsTemplateTitle: 'تخفیف مهر', canQuote: true, diagnostics: []},
    {...productB, kind: 'representative', productStatus: 'فعال', discountBps: 2000, source: 'sales_template', sourceId: 'fixed', templateId: 'fixed', templateTitle: 'پایه امروز', termsTemplateTitle: 'تخفیف مهر', canQuote: true, diagnostics: []},
    {...productB, kind: 'reseller', productStatus: 'فعال', discountBps: 0, source: 'cost_approved', sourceId: 'approved-price', templateId: null, templateTitle: null, canQuote: true, diagnostics: []},
    {productId: 'missing', name: 'بدون قیمت', code: 'NO-PRICE', model: 'NONE', kind: 'representative', productStatus: 'فعال', unitPrice: null, unitNet: null, discountBps: 2000, source: null, sourceId: null, templateId: null, templateTitle: null, canQuote: false, diagnostics: [{code: 'no_price', message: 'قیمت پایه این کالا تکمیل نشده است.'}]},
  ],
};
const before = JSON.stringify(data);
let creates = 0, copies = [];
function tree(extra = {}) {cursor = 0; return SalesTemplateCatalog({data, onCreate() {creates++;}, onCopy(value) {copies.push(value);}, ...extra});}
const change = (label, value) => control(tree(), label).props.onChange({target: {value}});
function clear() {const b = button(tree(), 'پاک کردن فیلترها'); if (b) b.props.onClick();}
function tab(label) {nodes(tree()).find(n => n.props.role === 'tab' && text(n) === label).props.onClick();}

let rendered = tree();
assert.equal(control(rendered, 'فهرست الگوها و قیمت‌های فروش').props.dir, 'rtl');
assert.deepEqual(templateIds(rendered), data.templates.map(t => t.id));
for (const label of ['جست‌وجوی الگو یا کالا', 'نوع خریدار', 'کالا', 'نوع الگو', 'وضعیت الگو']) assert.ok(control(rendered, label), label);
button(rendered, 'تعریف نسخه جدید الگوی فروش').props.onClick(); assert.equal(creates, 1);
for (const [status, ids] of [['active', ['promotion', 'legacy']], ['scheduled', ['future']], ['expired', ['expired']], ['previous', ['old', 'fixed']]]) {change('وضعیت الگو', status); assert.deepEqual(templateIds(tree()), ids);}
clear(); change('نوع الگو', 'promotion'); assert.deepEqual(templateIds(tree()), ['promotion', 'expired']);
change('وضعیت الگو', 'active'); assert.deepEqual(templateIds(tree()), ['promotion']);
clear(); change('نوع خریدار', 'reseller'); assert.deepEqual(templateIds(tree()), ['future']);
change('کالا', 'a'); assert.deepEqual(templateIds(tree()), []); assert.ok(text(tree()).includes('هیچ الگویی با این فیلتر پیدا نشد.'));
clear(); change('جست‌وجوی الگو یا کالا', 'آینده'); assert.deepEqual(templateIds(tree()), ['future']);
change('جست‌وجوی الگو یا کالا', 'MODEL-A'); assert.deepEqual(templateIds(tree()), ['old', 'fixed', 'promotion', 'expired']);
change('جست‌وجوی الگو یا کالا', 'P-۰۰۱'); assert.deepEqual(templateIds(tree()), ['old', 'fixed', 'promotion', 'expired'], 'Persian search digits match Latin product codes');
change('جست‌وجوی الگو یا کالا', 'دستگاه يك'); assert.deepEqual(templateIds(tree()), ['old', 'fixed', 'promotion', 'expired'], 'Arabic letter variants normalize in search');
clear();
assert.ok(text(tree()).includes('الگوی ثابت مبنا'));
let details = control(tree(), 'نمایش قیمت کالاهای پایه امروز');
assert.equal(details.props['aria-expanded'], false); details.props.onClick();
assert.equal(control(tree(), 'نمایش قیمت کالاهای پایه امروز').props['aria-expanded'], true);
let card = nodes(tree()).find(n => n.props['data-template-id'] === 'fixed');
assert.ok(text(card).includes(productA.code)); assert.ok(text(card).includes(productB.code));
const html = renderToStaticMarkup(card);
assert.ok(html.includes(BigInt(productA.unitPrice).toLocaleString('fa-IR')), 'Eighteen-digit displayed price stays precise and grouped');
assert.ok(html.includes('scope="col"')); assert.ok(html.includes('scope="row"'));
change('کالا', 'b'); card = nodes(tree()).find(n => n.props['data-template-id'] === 'fixed');
assert.ok(text(card).includes(productB.code)); assert.ok(!text(card).includes(productA.code), 'Expanded table follows the selected product');
clear(); control(tree(), 'نسخه جدید از پایه امروز').props.onClick();
assert.equal(copies[0], data.templates[1], 'Copy passes the exact selected template without mutating its historical record');
control(tree(), 'نمایش قیمت کالاهای پایه امروز').props.onClick(); assert.equal(control(tree(), 'نمایش قیمت کالاهای پایه امروز').props['aria-expanded'], false);
control(tree(), 'نمایش قیمت کالاهای قدیمی بدون قیمت').props.onClick(); assert.ok(text(tree()).includes('این نسخه فهرست قیمت کالا ندارد'));

// Version status/type filters never hide the actual current price when tabs
// change. Product, category and text filters intentionally stay shared.
change('نوع الگو', 'promotion'); change('وضعیت الگو', 'expired');
tab('قیمت‌های معتبر امروز'); rendered = tree();
assert.ok(!control(rendered, 'نوع الگو')); assert.ok(!control(rendered, 'وضعیت الگو'));
assert.deepEqual(priceIds(rendered), ['a', 'b', 'b', 'missing']);
assert.ok(text(rendered).includes('قیمت پایه این کالا تکمیل نشده است.')); assert.ok(text(rendered).includes('نیازمند تکمیل')); assert.ok(text(rendered).includes('قیمت مصوب بهای تمام‌شده'));
assert.ok(text(rendered).includes('تخفیف تارگت کسب‌شده، بدهی معوق و شرایط اختصاصی خریدار'));
change('نوع خریدار', 'representative'); change('کالا', 'b'); assert.deepEqual(priceIds(tree()), ['b']);
change('جست‌وجوی الگو یا کالا', 'MODEL-B'); assert.deepEqual(priceIds(tree()), ['b']);
change('جست‌وجوی الگو یا کالا', 'تخفیف مهر'); assert.deepEqual(priceIds(tree()), ['b'], 'Price search includes its distinct payment terms template');
change('جست‌وجوی الگو یا کالا', 'ناموجود'); assert.deepEqual(priceIds(tree()), []); assert.ok(text(tree()).includes('هیچ کالایی با این فیلتر پیدا نشد.'));
clear(); tab('فهرست الگوها'); assert.deepEqual(templateIds(tree()), data.templates.map(t => t.id));
const focused = []; const tabs = nodes(tree()).filter(n => n.props.role === 'tab');
tabs[0].props.onKeyDown({key: 'End', preventDefault() {}, currentTarget: {parentElement: {querySelectorAll() {return [{focus() {focused.push(0);}}, {focus() {focused.push(1);}}];}}}});
assert.deepEqual(focused, [1]); assert.equal(nodes(tree()).find(n => n.props.role === 'tab' && n.props['aria-selected']).props.children, 'قیمت‌های معتبر امروز');
tab('فهرست الگوها');
rendered = tree({loading: true}); assert.equal(control(rendered, 'فهرست الگوها و قیمت‌های فروش').props['aria-busy'], true);
assert.equal(button(rendered, 'تعریف نسخه جدید الگوی فروش').props.disabled, true); assert.equal(control(rendered, 'نسخه جدید از پایه امروز').props.disabled, true);
assert.ok(text(rendered).includes('در حال دریافت الگوها و قیمت‌ها'));
slots = []; assert.ok(text(tree({data: {...data, templates: [], prices: []}})).includes('هنوز الگوی فروشی تعریف نشده است'));
slots = []; const scopedData={...data,templates:[row('partial','بخشی از کالاها',{status:'active',isSelected:true,isFixedBaseline:true,selectedProductIds:['b'],fixedBaselineProductIds:['a','b']})]};
const scopedTree=()=>{cursor=0;return SalesTemplateCatalog({data:scopedData,onCreate(){},onCopy(){}});};
control(scopedTree(),'کالا').props.onChange({target:{value:'a'}});control(scopedTree(),'وضعیت الگو').props.onChange({target:{value:'active'}});
assert.deepEqual(templateIds(scopedTree()),[], 'An active rule for B is not active when filtering A');
control(scopedTree(),'وضعیت الگو').props.onChange({target:{value:'previous'}});assert.deepEqual(templateIds(scopedTree()),['partial']);
control(scopedTree(),'کالا').props.onChange({target:{value:'b'}});control(scopedTree(),'وضعیت الگو').props.onChange({target:{value:'active'}});assert.deepEqual(templateIds(scopedTree()),['partial']);
slots=[];

assert.equal(JSON.stringify(data), before, 'Rendering, filters, expansion and copy never rewrite the report');
console.log('PASS sales template catalog UI: controlled name/code/model/category/product/type/status search, version and current price separation, exact grouped rial prices, scoped expansion, copy/create callbacks, readable diagnostics, keyboard tabs and loading/empty states.');

// Exercise the actual owning form: opening the catalog is a read, and copying
// a historical row begins a new operation chained to the latest version.
let networkSlots = [], networkCursor = 0, effects = [], requests = [], fixture, reportFixture, reportFailure = false, networkFailure = false, malformedReport = false;
const networkReact = {...React, useState(initial) {
  const i = networkCursor++;
  if (!(i in networkSlots)) networkSlots[i] = typeof initial === 'function' ? initial() : initial;
  return [networkSlots[i], value => networkSlots[i] = typeof value === 'function' ? value(networkSlots[i]) : value];
}, useEffect(fn) {effects.push(fn);}};
const leaves = {}, leaf = name => leaves[name] || (leaves[name] = function Leaf() {return null;});
const networkModule = {};
vm.runInNewContext(ts.transpileModule(fs.readFileSync(path.join(root, 'components/trace/sales-network-panel.tsx'), 'utf8'), {compilerOptions: {
  module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true,
}}).outputText, {exports: networkModule, require(name) {
  if (name === 'react') return networkReact;
  if (name === 'react/jsx-runtime') return require(name);
  if (name.startsWith('@/lib/')) return load(name.slice(2) + '.ts');
  return new Proxy({}, {get: (_, key) => leaf(key)});
}, crypto: globalThis.crypto, Date, Intl, JSON, Set, Map, BigInt, console, fetch: async (url, options) => {
  requests.push({url, method: options?.method || 'GET', body: options?.body ? JSON.parse(options.body) : undefined});
  const failed = url === '/api/sales/templates' && reportFailure || url === '/api/sales/network' && networkFailure;
  return {ok: !failed, json: async () => failed ? {error: url === '/api/sales/network' ? 'Access revoked' : 'Report unavailable'} : options?.method === 'POST' ? {} : url === '/api/sales/templates' ? malformedReport ? {} : reportFixture : fixture};
}}, {filename: 'sales-network-panel.tsx'});
function networkTree(templatesOnly = true) {networkCursor = 0; return networkModule.SalesNetworkPanel({templatesOnly, selected: '', members: [], onChange() {}});}
const catalogNode = () => nodes(networkTree()).find(n => n.type === leaves.SalesTemplateCatalog);
async function mountNetwork(manager = true, fail = false, failNetwork = false, malformed = false) {
  networkSlots = []; effects = []; requests = []; reportFailure = fail; networkFailure = failNetwork; malformedReport = malformed;
  fixture = {today: '2026-10-12', roles: {manager}, agents: [], portfolio: [], records: [], products: data.products, prices: [], templates: [
    {id: 'historic-reseller', type: 'sales_template', created: '2026-10-01T00:00:00Z', revision: 2, data: {kind: 'reseller', version: 1, title: 'Historic raw', effectiveFrom: '2026-10-01', discountBps: 1000, cashBps: 5000, days: 20, maxDays: 40, productPrices: [{productId: 'a', unitPrice: '1000'}]}},
    {id: 'latest-reseller', type: 'sales_template', created: '2026-10-11T00:00:00Z', revision: 1, data: {kind: 'reseller', version: 5, title: 'Latest raw', effectiveFrom: '2026-11-01', discountBps: 500, cashBps: 7000, days: 30, maxDays: 60, productPrices: [{productId: 'b', unitPrice: '2222'}]}},
  ]};
  reportFixture = {...data, templates: [row('historic-reseller', 'Historic display', {kind: 'reseller', templateType: 'promotion', status: 'expired', version: 1, discountBps: 1500, cashBps: 4000, minCashBps: 2000, days: 47, maxDays: 60, durationDays: 3, productPrices: [productA]})]};
  networkTree(); effects.splice(0).forEach(fn => fn());
  await new Promise(resolve => setImmediate(resolve)); effects = [];
  return networkTree();
}
(async () => {
  await mountNetwork();
  assert.deepEqual(requests.map(r => r.url), ['/api/sales/network', '/api/sales/templates']);
  assert.ok(catalogNode()); assert.equal(catalogNode().props.data, reportFixture);
  assert.equal(nodes(networkTree()).filter(n => n.type === 'button' && text(n) === 'تعریف نسخه جدید الگوی فروش').length, 0, 'Loaded child owns one create action');
  const source = reportFixture.templates[0], original = JSON.stringify({reportFixture, fixture});
  catalogNode().props.onCopy(source);
  let draft = networkSlots[2];
  assert.match(draft.id, /^[0-9a-f-]{36}$/i); assert.notEqual(draft.id, source.id); assert.equal(draft.previousId, 'latest-reseller');
  assert.equal(draft.mode, 'template'); assert.equal(draft.kind, 'reseller'); assert.equal(draft.confirmed, true);
  assert.equal(draft.effectiveFrom, '2026-10-12', 'Copied history starts on current server date until manager edits it');
  for (const key of ['templateType', 'discountBps', 'cashBps', 'minCashBps', 'days', 'maxDays', 'durationDays', 'title']) assert.equal(draft[key], source[key], key);
  assert.deepEqual(JSON.parse(JSON.stringify(draft.productPrices)), [{productId: 'a', unitPrice: productA.unitPrice}]);
  assert.notEqual(draft.productPrices, source.productPrices); assert.notEqual(draft.productPrices[0], source.productPrices[0]);
  for (const key of ['revision', 'version', 'status', 'isSelected', 'sourceId', 'effectiveTo']) assert.ok(!Object.hasOwn(draft, key), 'Historical metadata cannot become mutation input: ' + key);
  assert.equal(requests.filter(r => r.method === 'POST').length, 0, 'Copy opens the confirmation form without writing');
  assert.ok(text(networkTree()).includes('نسخه قبلی حفظ می‌شود'));
  const input = nodes(networkTree()).find(n => n.type === leaves.NumberInput && n.props.fieldKey === 'unitPrice0');
  input.props.onChange({target: {value: '123456789012345678'}});
  assert.equal(JSON.stringify({reportFixture, fixture}), original, 'Editing copied prices does not mutate the source/history');
  const newId = draft.id;
  await nodes(networkTree()).find(n => n.type === 'form').props.onSubmit({preventDefault() {}});
  const written = requests.filter(r => r.method === 'POST'); assert.equal(written.length, 1);
  assert.equal(written[0].url, '/api/sales/network'); assert.equal(written[0].body.id, newId); assert.equal(written[0].body.previousId, 'latest-reseller');
  assert.deepEqual(written[0].body.productPrices, [{productId: 'a', unitPrice: '123456789012345678'}]);
  assert.equal(networkSlots[2], null); assert.ok(catalogNode(), 'Saving refreshes the independent catalog');
  assert.equal(requests.filter(r => r.url === '/api/sales/templates').length, 2);
  catalogNode().props.onCreate(); draft = networkSlots[2]; assert.notEqual(draft.id, newId); assert.equal(draft.kind, 'representative'); assert.equal(networkSlots[7], '', 'Ordinary creation clears copied-history notice');
  await mountNetwork(false); assert.deepEqual(requests.map(r => r.url), ['/api/sales/network']); assert.ok(!catalogNode()); assert.ok(text(networkTree()).includes('فقط در دسترسی مدیر فروش'));
  await mountNetwork(true, true); assert.ok(!catalogNode(), 'Report failure never presents empty data as a real catalog'); assert.ok(text(networkTree()).includes('Report unavailable'));
  assert.ok(button(networkTree(), 'تعریف نسخه جدید الگوی فروش'), 'Manager retains a working form launcher if report cannot load');
  await mountNetwork(true, false, false, true); assert.ok(!catalogNode(), 'Malformed successful response is an error, not an empty valid catalog');
  assert.ok(nodes(networkTree()).some(n => n.props.role === 'alert')); assert.ok(button(networkTree(), 'تعریف نسخه جدید الگوی فروش'));
  await mountNetwork(true, false, true); assert.ok(!catalogNode()); assert.deepEqual(requests.map(r => r.url), ['/api/sales/network']);
  assert.ok(nodes(networkTree()).some(n => n.props.role === 'alert' && text(n).includes('Access revoked')));
  networkFailure = false; button(networkTree(), 'تلاش مجدد').props.onClick(); await new Promise(resolve => setImmediate(resolve));
  assert.ok(catalogNode(), 'Initial access/connection failure can recover by retrying the real load');
  catalogNode().props.onCopy(reportFixture.templates[0]); assert.ok(networkSlots[2]);
  networkFailure = true; button(networkTree(), 'تازه‌سازی الگوها و قیمت‌ها').props.onClick(); await new Promise(resolve => setImmediate(resolve));
  assert.equal(networkSlots[0], null); assert.equal(networkSlots[2], null); assert.equal(networkSlots[5], null, 'Revocation/load failure clears stale manager data, catalog and editable draft');
  assert.ok(!catalogNode()); assert.ok(!nodes(networkTree()).some(n => n.type === 'form')); assert.ok(button(networkTree(), 'تلاش مجدد'));
  console.log('PASS sales catalog integration: manager-only report fetch, single create action, historical copy as new UUID with latest version pointer, precise cloned payload, no write before submit, independent refresh and visible report failure.');
})().catch(error => {console.error(error); process.exitCode = 1;});
