const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const {DatabaseSync} = require('node:sqlite');

// This fixture never opens the application's database or persistent worker state.
const root = path.resolve(__dirname, '..');
const sql = new DatabaseSync(':memory:');
sql.exec('PRAGMA foreign_keys=ON');
for (const file of fs.readdirSync(path.join(root, 'drizzle')).filter(f => f.endsWith('.sql')).sort()) {
  sql.exec(fs.readFileSync(path.join(root, 'drizzle', file), 'utf8'));
}
const db = {
  prepare(query) {
    let args = [];
    return {
      bind(...values) { args = values; return this; },
      async first() { return sql.prepare(query).get(...args) || null; },
      async all() { return {results: sql.prepare(query).all(...args)}; },
      async run() { return {meta: {changes: sql.prepare(query).run(...args).changes}}; },
    };
  },
  async batch(statements) {
    sql.exec('BEGIN');
    try {
      const result = [];
      for (const statement of statements) result.push(await statement.run());
      sql.exec('COMMIT');
      return result;
    } catch (error) {
      sql.exec('ROLLBACK');
      throw error;
    }
  },
};
let tail = Promise.resolve(), beforeBatch = null;
const batch = db.batch.bind(db);
db.batch = statements => {
  const next = tail.then(() => { const hook = beforeBatch; beforeBatch = null; hook?.(); return batch(statements); });
  tail = next.catch(() => {});
  return next;
};
const objects = new Map();
const bucket = {
  async put(key, bytes) { objects.set(key, bytes.slice(0)); return {key}; },
  async get(key) { const bytes = objects.get(key); return bytes ? {arrayBuffer: async () => bytes.slice(0)} : null; },
  async delete(key) { objects.delete(key); },
};
let clock = Date.parse('2026-10-10T08:00:00Z');
class FrozenDate extends Date {
  constructor(...args) { super(...(args.length ? args : [clock])); }
  static now() { return clock; }
}
const at = value => { clock = Date.parse(value); assert.ok(Number.isFinite(clock), value); };
const env = {
  TRACE_OWNER_EMAIL: 'owner@example.com',
  LLM_CONFIG_ENCRYPTION_KEY: require('node:crypto').randomBytes(32).toString('base64'),
  DB: db,
  BUCKET: bucket,
};
const cache = {};
function load(file) {
  file = path.resolve(root, file);
  if (cache[file]) return cache[file];
  const exports = {};
  cache[file] = exports;
  const source = ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    compilerOptions: {module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022},
  }).outputText;
  vm.runInNewContext(source, {
    exports,
    require: name => {
      if (name === 'cloudflare:workers') return {env};
      if (name === '@/app/chatgpt-auth') return {getChatGPTUser: async () => null};
      if (name.startsWith('@/') || name.startsWith('.')) {
        const target = name.startsWith('@/') ? path.join(root, name.slice(2)) : path.resolve(path.dirname(file), name);
        return load(target + (path.extname(target) ? '' : '.ts'));
      }
      return require(name);
    },
    Response, Request, URL, URLSearchParams, Error, crypto: globalThis.crypto,
    Date: FrozenDate, Intl, Set, Map, FormData, Blob, File, TextEncoder, TextDecoder,
    Uint8Array, ArrayBuffer, AbortController, ReadableStream, btoa, atob,
    setTimeout: (callback, duration) => setTimeout(callback, Math.min(duration, 10)), clearTimeout, console,
  }, {filename: file});
  return exports;
}
const context = load('lib/mcp/context.ts').mcpActor;
const workspaceApi = load('app/api/sales/templates/route.ts');
const quoteApi = load('app/api/sales/quote/route.ts');
const catalog = load('lib/mcp/tools.ts');
const assistantPolicy = load('lib/assistant-policy.ts');
const base = 'https://test.local';
const actor = (id, roles, extra = {}) => ({
  userId: 'local:' + id, email: id + '@example.com', name: id, isAdmin: false,
  permissions: {read: [], write: [], eventStages: [], salesRoles: roles, ...extra},
});
const manager = actor('manager', ['manager']);
const staff = actor('staff', ['staff']);
const finance = actor('finance', ['finance']);
const viewer = actor('viewer', ['viewer']);
const principal = (user = manager, scope = 'write') => ({user, scope, tokenId: null});
const seed = (id, type, data) => {
  const now = new FrozenDate().toISOString();
  sql.prepare('INSERT INTO flow_entities(id,type,data,revision,created,updated) VALUES(?,?,?,1,?,?)').run(id, type, JSON.stringify(data), now, now);
};
const member = user => {
  const now = new FrozenDate().toISOString();
  sql.prepare("INSERT INTO app_members(id,email,name,unit,status,subject,permissions,revision,created,updated) VALUES(?,?,?,'test','active',NULL,?,1,?,?)")
    .run(user.userId.slice(6), user.email, user.name, JSON.stringify(user.permissions), now, now);
};
const request = (route, body, origin = base) => new Request(base + route, {
  method: 'POST', headers: {origin, 'Content-Type': 'application/json'}, body: JSON.stringify(body),
});
async function post(api, route, body, user = manager, status = 200, origin = base) {
  const response = await context.run(user, () => api.POST(request(route, body, origin)));
  const result = await response.json();
  assert.equal(response.status, status, route + ' ' + body.mode + ': ' + JSON.stringify(result));
  return result;
}
// Audit records are expected for MCP reads. Every business table must stay
// byte-for-byte unchanged; ordinary HTTP GETs must not change even the audit.
function snapshot(includeAudit = true) {
  return JSON.stringify(sql.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name").all()
    .filter(({name}) => includeAudit || name !== 'access_audit')
    .map(({name}) => [name, sql.prepare('SELECT * FROM "' + name + '" ORDER BY rowid').all()]));
}
async function get(user = manager, query = {}, status = 200) {
  const before = snapshot();
  const response = await context.run(user, () => workspaceApi.GET(new Request(base + '/api/sales/templates?' + new URLSearchParams(query))));
  const result = await response.json();
  assert.equal(response.status, status, JSON.stringify(result));
  assert.equal(snapshot(), before, 'Template workspace GET must not write any database table');
  return result;
}
async function mcp(user = manager, filters = {}) {
  const before = snapshot(false);
  const result = await catalog.executeTool('get_sales_template_workspace', filters, base, principal(user, 'read'));
  assert.equal(snapshot(false), before, 'MCP report must not modify business data, profiles, templates or historical invoices');
  return result;
}
const catalogPrice = (report, productId, kind = 'representative') => report.prices.find(p => p.productId === productId && p.kind === kind);
const template = (id, values) => seed(id, 'sales_template', {
  kind: 'representative', title: id, templateType: 'fixed', version: 1,
  effectiveFrom: '2026-10-01', discountBps: 1000, cashBps: 5000, minCashBps: 3000, days: 30, maxDays: 60,
  productPrices: [], history: [{actor: manager.userId, at: '2026-10-01T08:00:00Z'}], ...values,
});
const legacyPrice = (id, productId, unitPrice, agentId = '') => seed(id, 'sales_price', {agentId, productId, unitPrice, active: true, reference: 'Approved'});

(async () => {
  const admin = {...actor('admin', []), isAdmin: true};
  const flowExpert = actor('flow-expert', [], {flowRoles: ['sales']});
  const external = actor('external', ['manager'], {salesAgentId: 'buyer-representative'});
  for (const user of [manager, staff, finance, viewer, flowExpert, external]) member(user);
  const profile = {name: 'Assigned buyer', kind: 'representative', active: true, ownerId: 'staff', financeId: 'finance', managerId: 'manager', termDays: 30, creditLimit: '1000000', phone: '02112345678', address: 'Address', province: 'تهران', city: 'تهران'};
  seed('buyer-representative', 'sales_agent', {...profile, nationalId: 'PRIVATE_IDENTITY', mobile: 'PRIVATE_MOBILE'});
  seed('buyer-reseller', 'sales_agent', {...profile, kind: 'reseller'});
  const products = [
    ['p-promotion', 'Promotion device', 'P-PROMO', 'PROMO-MODEL', 'فعال'],
    ['p-fixed', 'Fixed fallback device', 'P-FIXED-12', 'FIXED-MODEL', 'فعال'],
    ['p-approved', 'Approved cost device', 'P-COST', 'COST-MODEL', 'فعال'],
    ['p-legacy', 'Legacy price device', 'P-LEGACY', 'LEGACY-MODEL', 'فعال'],
    ['p-private', 'Individual price only', 'P-PRIVATE', 'PRIVATE-MODEL', 'فعال'],
    ['p-missing', 'Missing price device', 'P-MISSING', 'MISSING-MODEL', 'فعال'],
    ['p-inactive', 'Inactive device', 'P-INACTIVE', 'INACTIVE-MODEL', 'غیرفعال'],
    ['p-stopped', 'Stopped device', 'P-STOPPED', 'STOPPED-MODEL', 'توقف تولید'],
  ];
  for (const [id, name, code, model, status] of products) sql.prepare('INSERT INTO records(id,kind,payload,created) VALUES(?,?,?,?)')
    .run(id, 'product', JSON.stringify({name, code, model, status, nationalId: 'NOT_PRODUCT_PUBLIC_DATA'}), new FrozenDate().toISOString());
  sql.prepare('INSERT INTO records(id,kind,payload,created) VALUES(?,?,?,?)').run('not-product', 'customer', JSON.stringify({name: 'PRIVATE_CUSTOMER'}), new FrozenDate().toISOString());
  template('fixed-old', {version: 1, effectiveFrom: '2026-09-01', productPrices: [{productId: 'p-fixed', unitPrice: '1111'}]});
  template('fixed-current', {version: 2, productPrices: [{productId: 'p-promotion', unitPrice: '1001'}, {productId: 'p-fixed', unitPrice: '3333'}, {productId: 'p-approved', unitPrice: '1111'}, {productId: 'p-inactive', unitPrice: '5511'}, {productId: 'p-stopped', unitPrice: '6611'}]});
  template('promotion-current', {version: 3, templateType: 'promotion', effectiveFrom: '2026-10-10', durationDays: 2, effectiveTo: '2099-01-01', discountBps: 2000, productPrices: [{productId: 'p-promotion', unitPrice: '999999999999999999'}, {productId: 'p-approved', unitPrice: '2222'}]});
  template('fixed-future', {version: 4, effectiveFrom: '2026-10-15', productPrices: [{productId: 'p-fixed', unitPrice: '8888'}]});
  template('promotion-expired', {version: 5, templateType: 'promotion', effectiveFrom: '2026-10-05', durationDays: 1, effectiveTo: '2026-10-05', productPrices: [{productId: 'p-fixed', unitPrice: '9999'}]});
  template('reseller-future', {kind: 'reseller', effectiveFrom: '2026-10-11', productPrices: [{productId: 'p-fixed', unitPrice: '4444'}]});
  template('legacy-direct', {kind: 'end_customer', templateType: undefined, effectiveFrom: undefined, discountBps: 500, productPrices: [{productId: 'p-fixed', unitPrice: '7777'}]});
  legacyPrice('legacy-global', 'p-legacy', '1777');
  legacyPrice('legacy-agent', 'p-legacy', '99999', 'buyer-representative');
  legacyPrice('private-agent', 'p-private', '99999', 'buyer-representative');
  seed('approved-price', 'sales_price', {productId: 'p-approved', kind: 'representative', active: true, effectiveFrom: '2026-10-01', unitPrice: '5001', pricingApprovalId: 'approval'});
  seed('future-approved-price', 'sales_price', {productId: 'p-approved', kind: 'representative', active: true, effectiveFrom: '2026-10-20', unitPrice: '9001', pricingApprovalId: 'future-approval'});
  seed('approval', 'pricing_approval', {productId: 'p-approved', kind: 'representative', calculation: {unitPrice: '5001', minimumNet: '3000'}, unitCost: 'PRIVATE_COST', costSnapshot: 'PRIVATE_COST_SNAPSHOT'});
  seed('future-approval', 'pricing_approval', {productId: 'p-approved', kind: 'representative', calculation: {unitPrice: '9001', minimumNet: '3000'}});
  // Historic order and invoice data are deliberately unrelated to current prices.
  seed('historical-order', 'sales_order', {agentId: 'historical-buyer', amount: '4321', state: 'approved', salesTerms: {templateId: 'fixed-old', cashBps: 6000, months: 1}, lines: [{productId: 'p-fixed', unitPrice: '4321'}]});
  seed('historical-invoice', 'sales_invoice', {agentId: 'historical-buyer', amount: '4321', day: '2026-09-01', installments: [{id: '1', due: '2026-09-01', amount: '4321'}], lines: [{productId: 'p-fixed', unitPrice: '4321'}], salesTerms: {templateId: 'fixed-old', cashBps: 6000, months: 1}});

  for (const user of [staff, finance, viewer, flowExpert, external]) {
    assert.equal(assistantPolicy.assistantToolAvailable(user, 'get_sales_template_workspace'), false, 'Assistant must hide manager-only catalog tool from this role');
    await get(user, {}, 403);
    const before = snapshot(false);
    await assert.rejects(() => mcp(user), error => error.status === 403);
    assert.equal(snapshot(false), before);
  }
  const report = await get();
  for (const user of [manager, admin]) assert.equal(assistantPolicy.assistantToolAvailable(user, 'get_sales_template_workspace'), true);
  for (const user of [manager, staff, finance, viewer, flowExpert, external]) assert.equal(assistantPolicy.assistantToolAvailable(user, 'preview_sales_order'), true, 'Manager-only report policy must not suppress the existing quote tool');
  const adminReport = await get(admin);
  assert.deepEqual(adminReport, report, 'Administrator and sales manager use the same catalog');
  assert.equal(report.today, '2026-10-10');
  assert.equal(report.templates.length, 7);
  assert.equal(report.products.length, products.length);
  assert.equal(report.prices.length, products.length * 4, 'Every product has a diagnostic for each purchasing buyer type');
  const versions = new Map(report.templates.map(t => [t.id, t]));
  for (const [id, status] of [['fixed-old', 'previous'], ['fixed-current', 'active'], ['promotion-current', 'active'], ['fixed-future', 'scheduled'], ['promotion-expired', 'expired'], ['reseller-future', 'scheduled'], ['legacy-direct', 'active']]) assert.equal(versions.get(id).status, status, id);
  assert.equal(versions.get('fixed-current').isFixedBaseline, true);
  assert.equal(versions.get('fixed-current').isSelected, true);
  assert.equal(versions.get('promotion-current').isSelected, true);
  assert.equal(versions.get('promotion-current').effectiveTo, '2026-10-11', 'Promotion end is recomputed from duration rather than trusting stale stored text');
  assert.equal(versions.get('legacy-direct').effectiveFrom, null);
  const promotional = catalogPrice(report, 'p-promotion');
  assert.equal(promotional.source, 'sales_template');
  assert.equal(promotional.sourceId, 'promotion-current');
  assert.equal(promotional.unitPrice, '999999999999999999');
  assert.equal(promotional.unitNet, String(999999999999999999n * 8000n / 10000n), 'Eighteen digit prices retain integer rial precision');
  assert.equal(promotional.discountBps, 2000);
  assert.equal(promotional.canQuote, true);
  const fixed = catalogPrice(report, 'p-fixed');
  assert.equal(fixed.unitPrice, '3333');
  assert.equal(fixed.unitNet, '2999');
  assert.equal(fixed.sourceId, 'fixed-current', 'A product omitted from promotion uses its own effective fixed template');
  assert.equal(fixed.discountBps, 1000); assert.equal(fixed.termsTemplateId, 'fixed-current', 'Terms and discount belong to the selected product, not another product promotion');
  const approved = catalogPrice(report, 'p-approved');
  assert.equal(approved.source, 'cost_approved');
  assert.equal(approved.sourceId, 'approved-price');
  assert.equal(approved.unitPrice, '5001');
  assert.equal(approved.unitNet, '4000');
  assert.equal(catalogPrice(report, 'p-legacy').source, 'sales_price');
  assert.equal(catalogPrice(report, 'p-legacy').sourceId, 'legacy-global');
  assert.equal(catalogPrice(report, 'p-legacy').unitPrice, '1777', 'General catalog never uses an individual customer price');
  const noTemplateLegacy = catalogPrice(report, 'p-legacy', 'branch');
  assert.equal(noTemplateLegacy.unitPrice, '1777'); assert.equal(noTemplateLegacy.unitNet, '1777'); assert.equal(noTemplateLegacy.canQuote, true);
  assert.ok(noTemplateLegacy.diagnostics.some(d => d.code === 'no_active_template'), 'Valid legacy price remains usable while missing category terms are explained');
  for (const productId of ['p-private', 'p-missing']) {
    const price = catalogPrice(report, productId);
    assert.equal(price.unitPrice, null); assert.equal(price.unitNet, null); assert.equal(price.canQuote, false);
    assert.ok(price.diagnostics.length, productId + ' has an explicit missing price diagnostic');
  }
  for (const productId of ['p-inactive', 'p-stopped']) assert.equal(catalogPrice(report, productId).canQuote, false, productId);
  assert.equal(catalogPrice(report, 'p-fixed', 'end_customer').unitNet, '7388');
  assert.equal(catalogPrice(report, 'p-fixed', 'reseller').unitPrice, null, 'Future-only category has no current template price');
  assert.ok(catalogPrice(report, 'p-fixed', 'reseller').diagnostics.length);
  const serialized = JSON.stringify(report);
  for (const secret of ['PRIVATE_IDENTITY', 'PRIVATE_MOBILE', 'PRIVATE_CUSTOMER', 'PRIVATE_COST', 'PRIVATE_COST_SNAPSHOT', 'NOT_PRODUCT_PUBLIC_DATA', 'buyer-representative', 'historical-order', 'historical-invoice', 'nationalId', 'costSnapshot', 'minimumNet']) assert.ok(!serialized.includes(secret), 'No customer, identity or internal cost data in general catalog: ' + secret);
  assert.deepEqual(await mcp(), report, 'HTTP and read-only MCP return identical report data');
  for (const productId of ['p-promotion', 'p-fixed', 'p-approved']) {
    const q = await post(quoteApi, '/api/sales/quote', {agentId: 'buyer-representative', items: [{productId, quantity: 1}]}, staff);
    const p = catalogPrice(report, productId);
    assert.equal(q.lines[0].unitPrice, p.unitPrice); assert.equal(q.lines[0].unitNet, p.unitNet); assert.equal(q.lines[0].priceSource, p.source);
  }

  for (const query of [{kind: 'representative'}, {product: 'p-fixed'}, {search: 'FIXED-MODEL'}, {type: 'promotion'}, {status: 'scheduled'}, {kind: 'representative', product: 'p-fixed', type: 'fixed', status: 'previous'}]) {
    const filtered = await get(manager, query);
    assert.deepEqual(await mcp(manager, query), filtered, 'Filter parity ' + JSON.stringify(query));
    if (query.kind) assert.ok(filtered.templates.every(t => t.kind === query.kind));
    if (query.product) assert.ok(filtered.templates.every(t => t.productPrices.some(p => p.productId === query.product)));
    if (query.type) assert.ok(filtered.templates.every(t => t.templateType === query.type));
    if (query.status) assert.ok(filtered.templates.every(t => t.status === query.status));
    assert.ok(filtered.templates.length, 'Valid filter yields its exact matching versions: ' + JSON.stringify(query));
  }
  const absent = await get(manager, {search: 'NO_MATCH_ANYWHERE'});
  assert.equal(absent.templates.length, 0); assert.equal(absent.prices.length, 0);
  const latinCode = await get(manager, {search: 'P-FIXED-12'});
  const persianCode = await get(manager, {search: 'P-FIXED-۱۲'});
  assert.equal(latinCode.prices.length, 4); assert.ok(latinCode.prices.every(p => p.productId === 'p-fixed'));
  assert.deepEqual(persianCode.templates, latinCode.templates); assert.deepEqual(persianCode.prices, latinCode.prices, 'Persian search digits find the same Latin product code');
  assert.deepEqual(await mcp(manager, {search: 'P-FIXED-۱۲'}), persianCode);
  const titleSearch = await get(manager, {search: 'promotion-current'});
  assert.equal(titleSearch.templates.length, 1); assert.equal(titleSearch.templates[0].id, 'promotion-current');
  assert.equal(titleSearch.prices.length, 2); assert.ok(titleSearch.prices.every(p => p.kind === 'representative'), 'Current-price search only matches products covered by the active promotion, including an approved cost price');
  assert.deepEqual(await mcp(manager, {search: 'promotion-current'}), titleSearch);
  for (const query of [{kind: 'referrer'}, {type: 'unknown'}, {status: 'unknown'}, {search: 'x'.repeat(201)}]) await get(manager, query, 400);
  await get(manager, {product: 'not-product'}, 404);
  const pricesWithHistoryFilter = await get(manager, {type: 'promotion', status: 'expired'});
  assert.deepEqual(pricesWithHistoryFilter.prices, report.prices, 'Historical template filters never change actual current prices');
  // A published price cannot claim validity if its actual approval mismatches
  // or the public discount would exceed the approved minimum selling price.
  const originalApproval = sql.prepare("SELECT data FROM flow_entities WHERE id='approval'").get().data;
  const approval = JSON.parse(originalApproval);
  sql.prepare("UPDATE flow_entities SET data=? WHERE id='approval'").run(JSON.stringify({...approval, calculation: {...approval.calculation, unitPrice: '5002'}}));
  let invalidApproved = catalogPrice(await get(), 'p-approved');
  assert.equal(invalidApproved.canQuote, false); assert.ok(invalidApproved.diagnostics.some(d => d.code === 'invalid_price_approval'));
  await post(quoteApi, '/api/sales/quote', {agentId: 'buyer-representative', items: [{productId: 'p-approved', quantity: 1}]}, staff, 409);
  sql.prepare("UPDATE flow_entities SET data=? WHERE id='approval'").run(JSON.stringify({...approval, calculation: {...approval.calculation, minimumNet: '4500'}}));
  invalidApproved = catalogPrice(await get(), 'p-approved');
  assert.equal(invalidApproved.canQuote, false); assert.ok(invalidApproved.diagnostics.some(d => d.code === 'price_approval_discount'));
  await post(quoteApi, '/api/sales/quote', {agentId: 'buyer-representative', items: [{productId: 'p-approved', quantity: 1}]}, staff, 400);
  sql.prepare("UPDATE flow_entities SET data=? WHERE id='approval'").run(JSON.stringify({...approval, calculation: {...approval.calculation, minimumNet: 'bad'}}));
  invalidApproved = catalogPrice(await get(), 'p-approved');
  assert.equal(invalidApproved.canQuote, false); assert.ok(invalidApproved.diagnostics.some(d => d.code === 'invalid_price_approval'), 'Legacy malformed approval must not be labeled usable when actual quote cannot calculate it');
  await post(quoteApi, '/api/sales/quote', {agentId: 'buyer-representative', items: [{productId: 'p-approved', quantity: 1}]}, staff, 400);
  sql.prepare("UPDATE flow_entities SET data=? WHERE id='approval'").run(originalApproval);

  at('2026-10-11T20:29:59.999Z');
  const lastDay = await get();
  assert.equal(lastDay.today, '2026-10-11'); assert.equal(catalogPrice(lastDay, 'p-promotion').sourceId, 'promotion-current');
  assert.equal(catalogPrice(lastDay, 'p-fixed', 'reseller').unitPrice, '4444');
  at('2026-10-11T20:30:00.000Z');
  const nextDay = await get();
  assert.equal(nextDay.today, '2026-10-12'); assert.equal(catalogPrice(nextDay, 'p-promotion').sourceId, 'fixed-current');
  assert.equal(catalogPrice(nextDay, 'p-promotion').unitNet, '900');
  assert.equal(nextDay.templates.find(t => t.id === 'promotion-current').status, 'expired');
  template('fixed-disjoint', {version: 6, effectiveFrom: '2026-10-12', productPrices: [{productId: 'p-missing', unitPrice: '4000'}]});
  const disjoint = await get();
  assert.equal(catalogPrice(disjoint, 'p-missing').termsTemplateId, 'fixed-disjoint');
  assert.equal(catalogPrice(disjoint, 'p-fixed').termsTemplateId, 'fixed-current', 'A newer fixed template for another product does not hide this product baseline');
  assert.equal(disjoint.templates.find(t => t.id === 'fixed-current').status, 'active');
  assert.equal(disjoint.templates.find(t => t.id === 'fixed-disjoint').status, 'active');
  const exactFixed = await get(manager, {product: 'p-fixed'});
  assert.equal(exactFixed.templates.find(t => t.id === 'fixed-current').isSelected, true);
  const afterPromotionQuote = await post(quoteApi, '/api/sales/quote', {agentId: 'buyer-representative', items: [{productId: 'p-promotion', quantity: 1}]}, staff);
  assert.equal(afterPromotionQuote.lines[0].unitPrice, catalogPrice(nextDay, 'p-promotion').unitPrice);
  assert.deepEqual(await mcp(), disjoint);
  const storedPermissions = sql.prepare("SELECT permissions FROM app_members WHERE id='manager'").get().permissions;
  sql.prepare("UPDATE app_members SET permissions=? WHERE id='manager'").run(JSON.stringify(staff.permissions));
  await get(manager, {}, 403); await assert.rejects(() => mcp(manager), error => error.status === 403);
  sql.prepare("UPDATE app_members SET permissions=?,status='inactive' WHERE id='manager'").run(storedPermissions);
  await get(manager, {}, 403); await assert.rejects(() => mcp(manager), error => error.status === 403);
  assert.equal(sql.prepare('PRAGMA foreign_key_check').all().length, 0);
  console.log('PASS independent sales template workspace: manager-only HTTP/MCP and live revocation, scoped filters and status, current promotion/fixed/approved/global price precedence, exact eighteen-digit math, Tehran boundaries, private data isolation, unchanged history and no business writes.');
})().catch(error => { console.error(error); process.exitCode = 1; }).finally(() => sql.close());
