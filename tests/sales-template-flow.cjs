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
const network = load('app/api/sales/network/route.ts');
const sales = load('app/api/sales/route.ts');
const quoteApi = load('app/api/sales/quote/route.ts');
const catalog = load('lib/mcp/tools.ts');
const duties = load('lib/duties.ts');
const base = 'https://test.local';
const actor = (id, roles, extra = {}) => ({
  userId: 'local:' + id, email: id + '@example.com', name: id, isAdmin: false,
  permissions: {read: [], write: [], eventStages: [], salesRoles: roles, ...extra},
});
const manager = actor('manager', ['manager']);
const otherManager = actor('other-manager', ['manager']);
const staff = actor('staff', ['staff']);
const finance = actor('finance', ['finance']);
const viewer = actor('viewer', ['viewer']);
const principal = (user = manager, scope = 'write') => ({user, scope, tokenId: null});
const rows = type => sql.prepare('SELECT * FROM flow_entities WHERE type=?').all(type).map(row => ({...row, data: JSON.parse(row.data)}));
const entity = id => {
  const row = sql.prepare('SELECT * FROM flow_entities WHERE id=?').get(id);
  return row ? {...row, data: JSON.parse(row.data)} : null;
};
const latest = kind => rows('sales_template').filter(row => row.data.kind === kind).sort((a, b) => b.data.version - a.data.version)[0];
const seed = (id, type, data) => {
  const now = new FrozenDate().toISOString();
  sql.prepare('INSERT INTO flow_entities(id,type,data,revision,created,updated) VALUES(?,?,?,1,?,?)').run(id, type, JSON.stringify(data), now, now);
};
const member = user => {
  const now = new FrozenDate().toISOString();
  sql.prepare("INSERT INTO app_members(id,email,name,unit,status,subject,permissions,revision,created,updated) VALUES(?,?,?,'test','active',NULL,?,1,?,?)")
    .run(user.userId.slice(6), user.email, user.name, JSON.stringify(user.permissions), now, now);
};
const domainAudit = id => sql.prepare("SELECT * FROM access_audit WHERE action='sales_network_template' AND target=?").all(id);
const operations = id => sql.prepare('SELECT * FROM inventory_operations WHERE id=?').all(id);
const request = (route, body, origin = base) => new Request(base + route, {
  method: 'POST', headers: {origin, 'Content-Type': 'application/json'}, body: JSON.stringify(body),
});
async function post(api, route, body, user = manager, status = 200, origin = base) {
  const response = await context.run(user, () => api.POST(request(route, body, origin)));
  const result = await response.json();
  assert.equal(response.status, status, route + ' ' + body.mode + ': ' + JSON.stringify(result));
  return result;
}
const templateBody = (kind = 'representative', values = {}) => ({
  id: crypto.randomUUID(), mode: 'template', confirmed: true, kind,
  title: 'Approved ' + kind, effectiveFrom: '2026-10-01',
  discountBps: 1000, cashBps: 5000, minCashBps: 3000, maxCashBps: 7000,
  productPrices: [{productId: 'product', unitPrice: '1000'}],
  months: 1, minMonths: 1, maxMonths: 3, previousId: latest(kind)?.id || '',
  ...values,
});
async function saveTemplate(kind, values = {}, status = 200) {
  const body = templateBody(kind, values);
  const result = await post(network, '/api/sales/network', body, manager, status);
  return {body, result, record: entity(body.id)};
}
const items = [{productId: 'product', quantity: 2}];
const quote = (agentId = 'buyer-representative', user = staff) => post(quoteApi, '/api/sales/quote', {agentId, items}, user);
const salesBody = (mode, values = {}) => ({
  id: crypto.randomUUID(), mode, confirmed: true, agentId: 'buyer-representative',
  notes: 'Actual confirmed decision', ...values,
});
async function order(quoted, values = {}, status = 200) {
  const body = salesBody('order', {
    agentId: quoted.agentId, items, quoteHash: quoted.quoteHash,
    requestSource: {channel: 'phone', contactName: 'Buyer', day: duties.dayAt(), reference: 'Actual request'},
    ...values,
  });
  const result = await post(sales, '/api/sales', body, staff, status);
  return {body, result, record: entity(body.id)};
}
async function expectQuote(templateId, rate, cashBps, months, agentId = 'buyer-representative', unitPrice = '1000') {
  const recordCount = sql.prepare('SELECT COUNT(*) n FROM flow_entities').get().n;
  const operationCount = sql.prepare('SELECT COUNT(*) n FROM inventory_operations').get().n;
  const quoted = await quote(agentId);
  assert.equal(quoted.salesTerms.templateId, templateId);
  assert.equal(quoted.baseDiscountBps, rate);
  assert.equal(quoted.lines[0].discountBps, rate);
  assert.equal(quoted.lines[0].unitPrice, unitPrice);
  const unitNet = BigInt(unitPrice) * BigInt(10000 - rate) / 10000n;
  assert.equal(quoted.lines[0].unitNet, String(unitNet));
  assert.equal(quoted.amount, String(2n * unitNet));
  assert.equal(quoted.discount, String(2n * (BigInt(unitPrice) - unitNet)));
  assert.equal(quoted.salesTerms.cashBps, cashBps);
  assert.equal(quoted.salesTerms.months, months);
  assert.equal(quoted.installments.reduce((total, part) => total + BigInt(part.amount), 0n), BigInt(quoted.amount));
  const preview = await catalog.executeTool('preview_sales_order', {agentId, items}, base, principal(staff, 'read'));
  assert.equal(preview.quoteHash, quoted.quoteHash, 'HTTP and MCP must use the same date-selected template');
  assert.equal(sql.prepare('SELECT COUNT(*) n FROM flow_entities').get().n, recordCount, 'Previews must not save or reserve sales records');
  assert.equal(sql.prepare('SELECT COUNT(*) n FROM inventory_operations').get().n, operationCount, 'Previews must not issue sales operations');
  return quoted;
}

(async () => {
  for (const user of [manager, otherManager, staff, finance, viewer]) member(user);
  for (const kind of ['representative', 'reseller', 'branch', 'end_customer']) {
    seed('buyer-' + kind, 'sales_agent', {
      name: 'Buyer ' + kind, kind, active: true, ownerId: 'staff', financeId: 'finance', managerId: 'manager',
      termDays: 30, creditLimit: '1000000', phone: '02112345678', address: 'Actual address', province: 'Tehran', city: 'Tehran',
    });
  }
  seed('buyer-snapshot', 'sales_agent', {...entity('buyer-representative').data, name: 'Historical buyer'});
  sql.prepare("INSERT INTO records(id,kind,payload,created) VALUES('product','product',?,?)")
    .run(JSON.stringify({name: 'Device', model: 'N1', code: 'P1', status: 'فعال'}), new FrozenDate().toISOString());
  seed('price', 'sales_price', {agentId: '', productId: 'product', unitPrice: '1000', active: true, reference: 'Approved price'});
  for (const [id, kind] of [['product-fixed', 'product'], ['product-legacy', 'product'], ['inactive-product', 'product'], ['non-product', 'customer']]) {
    sql.prepare('INSERT INTO records(id,kind,payload,created) VALUES(?,?,?,?)')
      .run(id, kind, JSON.stringify({name: id, model: id, status: id === 'inactive-product' ? 'غیرفعال' : 'فعال'}), new FrozenDate().toISOString());
  }
  seed('specific-price', 'sales_price', {agentId: 'buyer-representative', productId: 'product', unitPrice: '9900', active: true, reference: 'Earlier individual price'});
  seed('legacy-price', 'sales_price', {agentId: '', productId: 'product-legacy', unitPrice: '1777', active: true, reference: 'Legacy fallback'});

  // Both transports must enforce active managerial authority and explicit confirmation.
  for (const user of [staff, finance, viewer]) {
    const body = templateBody();
    await post(network, '/api/sales/network', body, user, 403);
    assert.equal(entity(body.id), null);
    await assert.rejects(() => catalog.executeTool('sales_network_apply', {
      id: body.id, mode: body.mode, confirmed: true, data: body,
    }, base, principal(user)), error => error.status === 403);
    assert.equal(domainAudit(body.id).length, 0);
  }
  const unconfirmed = templateBody('representative', {confirmed: false});
  await post(network, '/api/sales/network', unconfirmed, manager, 400);
  assert.equal(entity(unconfirmed.id), null);
  assert.equal(operations(unconfirmed.id).length, 0);
  await assert.rejects(() => catalog.executeTool('sales_network_apply', {
    id: unconfirmed.id, mode: 'template', confirmed: false, data: unconfirmed,
  }, base, principal()), error => error.status === 400);
  assert.equal(entity(unconfirmed.id), null);
  await assert.rejects(() => catalog.executeTool('sales_network_apply', {
    id: crypto.randomUUID(), mode: 'template', confirmed: true, data: templateBody(),
  }, base, principal(manager, 'read')), /read-only/);
  const foreignOrigin = templateBody();
  await post(network, '/api/sales/network', foreignOrigin, manager, 403, 'https://foreign.local');
  assert.equal(entity(foreignOrigin.id), null);

  // Newly submitted templates need a real start; only persisted legacy rows get compatibility.
  for (const effectiveFrom of [undefined, '', '2026-02-30', '2026-13-01', '1405/07/19', '2026-10-01T00:00:00Z']) {
    const invalid = await saveTemplate('representative', {effectiveFrom}, 400);
    assert.equal(invalid.record, null);
    assert.equal(operations(invalid.body.id).length, 0);
    assert.equal(domainAudit(invalid.body.id).length, 0);
  }
  await saveTemplate('representative', {templateType: 'seasonal'}, 400);
  await saveTemplate('representative', {cashBps: 2000}, 400);
  // Product prices are an explicit, bounded catalog selection, never arbitrary free-form data.
  for (const productPrices of [undefined, null, [], {}, [{productId: 'missing', unitPrice: '1000'}], [{productId: 'non-product', unitPrice: '1000'}], [{productId: 'inactive-product', unitPrice: '1000'}],
    [{productId: 'product', unitPrice: '1000'}, {productId: 'product', unitPrice: '2000'}],
    ...[undefined, '', '0', '-1', '1.5', '1e3', '1,000', '1000000000000000000', 1000].map(unitPrice => [{productId: 'product', unitPrice}])]) {
    const invalid = await saveTemplate('representative', {productPrices}, 400);
    assert.equal(invalid.record, null);
    assert.equal(operations(invalid.body.id).length, 0);
    assert.equal(domainAudit(invalid.body.id).length, 0);
  }
  const missingMcpPrices = {id: crypto.randomUUID(), mode: 'template', confirmed: true, data: {...templateBody(), productPrices: []}};
  await assert.rejects(() => catalog.executeTool('sales_network_apply', missingMcpPrices, base, principal()), error => error.status === 400);
  assert.equal(entity(missingMcpPrices.id), null);
  const productBeforeRace = sql.prepare("SELECT payload FROM records WHERE id='product'").get().payload;
  beforeBatch = () => sql.prepare("UPDATE records SET payload=? WHERE id='product'").run(JSON.stringify({...JSON.parse(productBeforeRace), status: 'غیرفعال'}));
  const raced = await saveTemplate('representative', {}, 409);
  assert.equal(raced.record, null, 'A catalog mutation after validation must roll back the entire template save');
  assert.equal(operations(raced.body.id).length, 0);
  assert.equal(domainAudit(raced.body.id).length, 0);
  sql.prepare("UPDATE records SET payload=? WHERE id='product'").run(productBeforeRace);
  const fixed = await saveTemplate('representative', {productPrices: [{productId: 'product', unitPrice: '1000'}, {productId: 'product-fixed', unitPrice: '3333'}]});
  assert.equal(fixed.record.data.templateType, 'fixed', 'Omitting type defaults a new template to fixed');
  assert.equal(fixed.record.data.effectiveFrom, '2026-10-01');
  assert.ok(!fixed.record.data.effectiveTo, 'A fixed template has no expiry');
  assert.equal(fixed.record.data.version, 1);
  assert.deepEqual(fixed.record.data.productPrices, [{productId: 'product', unitPrice: '1000'}, {productId: 'product-fixed', unitPrice: '3333'}]);
  assert.equal(fixed.record.data.history.length, 1);
  assert.equal(fixed.record.data.history[0].actor, manager.userId);
  assert.equal(fixed.record.data.history[0].at, new FrozenDate().toISOString());
  assert.ok(!Object.hasOwn(fixed.record.data, 'notes'));
  const repeated = await post(network, '/api/sales/network', fixed.body);
  assert.equal(repeated.repeated, true);
  assert.equal(domainAudit(fixed.body.id).length, 1);
  assert.equal(operations(fixed.body.id).length, 1);
  const audit = domainAudit(fixed.body.id)[0];
  assert.equal(audit.actor, manager.userId);
  assert.equal(JSON.parse(audit.after).effectiveFrom, '2026-10-01');
  await post(network, '/api/sales/network', {...fixed.body, title: 'Changed retry'}, manager, 409);
  await post(network, '/api/sales/network', fixed.body, otherManager, 409);

  const mcpId = crypto.randomUUID();
  const mcpData = {kind: 'end_customer', title: 'Direct baseline', templateType: 'fixed', effectiveFrom: '2026-10-01', discountBps: 500, cashBps: 10000, months: 0, productPrices: [{productId: 'product', unitPrice: '1000'}]};
  const mcpArgs = {id: mcpId, mode: 'template', confirmed: true, data: mcpData};
  await catalog.executeTool('sales_network_apply', mcpArgs, base, principal());
  assert.equal((await catalog.executeTool('sales_network_apply', mcpArgs, base, principal())).repeated, true);
  assert.equal(entity(mcpId).data.effectiveFrom, mcpData.effectiveFrom);
  assert.equal(entity(mcpId).data.templateType, 'fixed');
  assert.equal(domainAudit(mcpId).length, 1, 'MCP retry must not duplicate the domain audit');
  assert.equal(operations(mcpId).length, 1);
  const mcpAudit = sql.prepare("SELECT after FROM access_audit WHERE actor=? AND target='sales_network_apply' AND action='mcp_call'").all(manager.userId).map(row => JSON.parse(row.after));
  assert.ok(mcpAudit.filter(row => row.outcome === 'succeeded').length >= 2);
  const missingMcpStart = {id: crypto.randomUUID(), mode: 'template', confirmed: true, data: {...mcpData, effectiveFrom: undefined, previousId: mcpId}};
  await assert.rejects(() => catalog.executeTool('sales_network_apply', missingMcpStart, base, principal()), error => error.status === 400);
  assert.equal(entity(missingMcpStart.id), null);

  for (const durationDays of [undefined, 0, -1, 1.5, '2']) {
    const invalid = await saveTemplate('representative', {templateType: 'promotion', effectiveFrom: '2026-10-12', durationDays}, 400);
    assert.equal(invalid.record, null);
  }
  await saveTemplate('reseller', {templateType: 'promotion', effectiveFrom: '2026-10-12', durationDays: 2}, 400);
  const futureReseller = await saveTemplate('reseller', {effectiveFrom: '2026-10-20'});
  await saveTemplate('reseller', {templateType: 'promotion', effectiveFrom: '2026-10-19', durationDays: 3}, 400);
  const resellerPromo = await saveTemplate('reseller', {templateType: 'promotion', effectiveFrom: '2026-10-20', durationDays: 2});
  assert.equal(resellerPromo.record.data.effectiveTo, '2026-10-21');
  assert.equal(futureReseller.record.data.effectiveFrom, '2026-10-20');

  const scheduled = await saveTemplate('representative', {effectiveFrom: '2026-10-13', discountBps: 1200, cashBps: 6000, months: 2});
  await saveTemplate('representative', {previousId: fixed.body.id}, 409);
  const promotion = await saveTemplate('representative', {
    templateType: 'promotion', effectiveFrom: '2026-10-12', durationDays: 3, effectiveTo: '2027-01-01',
    discountBps: 2000, cashBps: 7000, months: 3, productPrices: [{productId: 'product', unitPrice: '2501'}],
  });
  assert.equal(promotion.record.data.effectiveTo, '2026-10-14', 'The server computes inclusive expiry and ignores a submitted end');
  assert.equal(promotion.record.data.durationDays, 3);
  await saveTemplate('representative', {templateType: 'promotion', effectiveFrom: '2026-10-14', durationDays: 2}, 400);
  await saveTemplate('representative', {templateType: 'promotion', effectiveFrom: '2026-10-11', durationDays: 2}, 400);
  const during = await saveTemplate('representative', {effectiveFrom: '2026-10-14', discountBps: 1500, cashBps: 6500, months: 2});
  const oneDay = await saveTemplate('representative', {templateType: 'promotion', effectiveFrom: '2026-10-16', durationDays: 1, discountBps: 2200, cashBps: 7000, months: 3});
  assert.equal(oneDay.record.data.effectiveTo, oneDay.record.data.effectiveFrom);
  const otherCategory = await saveTemplate('end_customer', {
    templateType: 'promotion', effectiveFrom: '2026-10-12', durationDays: 1, effectiveTo: '2026-10-31',
    discountBps: 900, cashBps: 10000, maxCashBps: 10000, months: 0, minMonths: 0,
  });
  assert.equal(otherCategory.record.data.effectiveTo, '2026-10-12', 'The same dates are permitted for different buyer categories');

  // Saved legacy templates remain immediately valid without inventing migration dates.
  seed('legacy-branch', 'sales_template', {kind: 'branch', title: 'Legacy branch terms', discountBps: 700, cashBps: 6000, months: 1, version: 1, history: []});
  const legacyBefore = sql.prepare('SELECT data FROM flow_entities WHERE id=?').get('legacy-branch').data;
  const newBranch = await saveTemplate('branch', {effectiveFrom: '2026-10-12', discountBps: 800, cashBps: 6000, months: 1});
  await saveTemplate('branch', {effectiveFrom: '2026-10-20', discountBps: 900, cashBps: 6000, months: 1});
  at('2026-10-11T08:00:00Z');
  await expectQuote('legacy-branch', 700, 6000, 1, 'buyer-branch');
  const beforeStart = await expectQuote(fixed.body.id, 1000, 5000, 1);
  await expectQuote(mcpId, 500, 10000, 0, 'buyer-end_customer');

  // The decisive boundary is Tehran midnight, even while the UTC date is unchanged.
  at('2026-10-11T20:29:59.999Z');
  assert.equal(duties.dayAt(), '2026-10-11');
  await expectQuote(fixed.body.id, 1000, 5000, 1);
  at('2026-10-11T20:30:00.000Z');
  assert.equal(duties.dayAt(), '2026-10-12');
  const started = await expectQuote(promotion.body.id, 2000, 7000, 3, 'buyer-representative', '2501');
  const staleStart = await order(beforeStart, {}, 409);
  assert.equal(staleStart.record, null);
  assert.equal(operations(staleStart.body.id).length, 0);
  await expectQuote(newBranch.body.id, 800, 6000, 1, 'buyer-branch');
  await expectQuote(otherCategory.body.id, 900, 10000, 0, 'buyer-end_customer');
  const mixedItems = [{productId: 'product', quantity: 2}, {productId: 'product-fixed', quantity: 1}, {productId: 'product-legacy', quantity: 1}];
  const mixed = await post(quoteApi, '/api/sales/quote', {agentId: 'buyer-representative', items: mixedItems}, staff);
  assert.deepEqual(mixed.lines.map(line => line.unitPrice), ['2501', '3333', '1777'], 'Promotion row wins, omitted promotion product uses current fixed row, and a product omitted from both uses its legacy price');
  assert.deepEqual(mixed.lines.map(line => line.unitNet), ['2000', '2666', '1421'], 'Category discount applies exactly once to each selected base price using integer rial rounding');
  assert.deepEqual(mixed.lines.map(line => line.priceSource), ['sales_template', 'sales_template', 'sales_price']);
  assert.deepEqual(mixed.lines.map(line => line.priceTemplateId), [promotion.body.id, fixed.body.id, '']);
  assert.equal(mixed.amount, '8087');
  assert.equal(mixed.discount, '2025');
  const mixedMcp = await catalog.executeTool('preview_sales_order', {agentId: 'buyer-representative', items: mixedItems}, base, principal(staff, 'read'));
  assert.equal(mixedMcp.quoteHash, mixed.quoteHash);

  const historicalQuote = await quote('buyer-snapshot');
  const historicalOrder = await order(historicalQuote);
  assert.equal(historicalOrder.record.data.salesTerms.templateId, promotion.body.id);
  await post(sales, '/api/sales', salesBody('order_review', {agentId: 'buyer-snapshot', orderId: historicalOrder.body.id, revision: 1, approved: true}));
  const approvedSnapshot = entity(historicalOrder.body.id).data;
  assert.equal(approvedSnapshot.amount, historicalQuote.amount);
  assert.equal(approvedSnapshot.salesTerms.cashBps, 7000);
  assert.equal(approvedSnapshot.salesTerms.months, 3);

  at('2026-10-13T08:00:00Z');
  await expectQuote(promotion.body.id, 2000, 7000, 3, 'buyer-representative', '2501');
  await expectQuote(mcpId, 500, 10000, 0, 'buyer-end_customer');
  assert.equal(scheduled.record.data.effectiveFrom, '2026-10-13');
  at('2026-10-14T20:29:59.999Z');
  assert.equal(duties.dayAt(), '2026-10-14');
  const onEnd = await expectQuote(promotion.body.id, 2000, 7000, 3, 'buyer-representative', '2501');
  at('2026-10-14T20:30:00.000Z');
  assert.equal(duties.dayAt(), '2026-10-15');
  const afterEnd = await expectQuote(during.body.id, 1500, 6500, 2);
  assert.notEqual(afterEnd.quoteHash, onEnd.quoteHash);
  assert.notEqual(started.quoteHash, beforeStart.quoteHash);
  const staleEnd = await order(onEnd, {}, 409);
  assert.equal(staleEnd.record, null);
  assert.equal(operations(staleEnd.body.id).length, 0);
  const savedFixedOrder = await order(afterEnd);
  assert.equal(savedFixedOrder.record.data.salesTerms.templateId, during.body.id);

  // A promotion order approved during its window can be invoiced later using its original snapshot.
  const invoiceBody = salesBody('invoice', {
    agentId: 'buyer-snapshot', orderId: historicalOrder.body.id, revision: entity(historicalOrder.body.id).revision, reference: 'PROMO-HISTORICAL',
  });
  await post(sales, '/api/sales', invoiceBody, finance);
  const invoice = entity(invoiceBody.id);
  assert.equal(invoice.data.amount, historicalQuote.amount);
  assert.equal(invoice.data.discount, historicalQuote.discount);
  assert.deepEqual(invoice.data.lines, JSON.parse(JSON.stringify(historicalQuote.lines)));
  assert.deepEqual(invoice.data.salesTerms, JSON.parse(JSON.stringify(historicalQuote.salesTerms)));
  assert.equal(invoice.data.installments[0].amount, String(BigInt(historicalQuote.amount) * 7000n / 10000n));
  const invoiceBefore = sql.prepare('SELECT data FROM flow_entities WHERE id=?').get(invoice.id).data;
  const orderBefore = sql.prepare('SELECT data FROM flow_entities WHERE id=?').get(savedFixedOrder.body.id).data;
  const historicalTerms = JSON.stringify(entity(historicalOrder.body.id).data.salesTerms);
  const newer = await saveTemplate('representative', {effectiveFrom: '2026-10-15', discountBps: 1600, cashBps: 6600, months: 2});
  await expectQuote(newer.body.id, 1600, 6600, 2);
  await order(afterEnd, {}, 409);
  assert.equal(sql.prepare('SELECT data FROM flow_entities WHERE id=?').get(invoice.id).data, invoiceBefore);
  assert.equal(sql.prepare('SELECT data FROM flow_entities WHERE id=?').get(savedFixedOrder.body.id).data, orderBefore);
  assert.equal(JSON.stringify(entity(historicalOrder.body.id).data.salesTerms), historicalTerms);
  assert.equal(sql.prepare('SELECT data FROM flow_entities WHERE id=?').get('legacy-branch').data, legacyBefore);
  // A price-only revision invalidates a prepared quote without rewriting historical invoices.
  const beforePriceChange = await quote();
  const newPrice = await saveTemplate('representative', {effectiveFrom: '2026-10-15', discountBps: 1600, cashBps: 6600, months: 2, productPrices: [{productId: 'product', unitPrice: '1501'}]});
  await expectQuote(newPrice.body.id, 1600, 6600, 2, 'buyer-representative', '1501');
  await order(beforePriceChange, {}, 409);
  assert.equal(sql.prepare('SELECT data FROM flow_entities WHERE id=?').get(invoice.id).data, invoiceBefore);
  assert.equal(sql.prepare('SELECT data FROM flow_entities WHERE id=?').get(savedFixedOrder.body.id).data, orderBefore);

  at('2026-10-16T08:00:00Z');
  await expectQuote(oneDay.body.id, 2200, 7000, 3);
  at('2026-10-17T08:00:00Z');
  await expectQuote(newPrice.body.id, 1600, 6600, 2, 'buyer-representative', '1501');
  const leapBaseline = await saveTemplate('reseller', {effectiveFrom: '2028-02-01'});
  const leapPromo = await saveTemplate('reseller', {templateType: 'promotion', effectiveFrom: '2028-02-28', durationDays: 3});
  assert.equal(leapPromo.record.data.effectiveTo, '2028-03-01', 'Inclusive duration crosses leap February correctly');
  assert.equal(leapBaseline.record.data.templateType, 'fixed');

  // An omitted rate inherits the fixed terms eligible on its start, never a promotion
  // or a newer fixed version whose start lies after the new template's start.
  await saveTemplate('branch', {templateType: 'promotion', effectiveFrom: '2026-10-21', durationDays: 1, discountBps: 2500});
  const inheritedFixed = await saveTemplate('branch', {effectiveFrom: '2026-10-18', discountBps: undefined});
  assert.equal(inheritedFixed.record.data.discountBps, 800, 'Fixed inheritance skips the latest promotion and the later scheduled fixed');
  await saveTemplate('branch', {effectiveFrom: '2026-10-25', discountBps: 3200});
  const inheritedPromotion = await saveTemplate('branch', {templateType: 'promotion', effectiveFrom: '2026-10-19', durationDays: 1, discountBps: undefined});
  assert.equal(inheritedPromotion.record.data.discountBps, 800, 'Promotion inheritance uses the fixed terms eligible on its own start');
  at('2026-10-19T08:00:00Z');
  await expectQuote(inheritedPromotion.body.id, 800, 5000, 1, 'buyer-branch');

  // Catalog-size boundaries are checked before the template/version/audit can be persisted.
  const bulkPrices = Array.from({length: 101}, (_, i) => ({productId: 'bulk-product-' + i, unitPrice: i === 0 ? '999999999999999999' : String(i + 1)}));
  for (const item of bulkPrices) sql.prepare('INSERT INTO records(id,kind,payload,created) VALUES(?,\'product\',?,?)').run(item.productId, JSON.stringify({name: item.productId, status: 'فعال'}), new FrozenDate().toISOString());
  const maximum = await saveTemplate('end_customer', {effectiveFrom: '2099-01-01', productPrices: bulkPrices.slice(0, 100)});
  assert.equal(maximum.record.data.productPrices.length, 100);
  const tooMany = await saveTemplate('end_customer', {effectiveFrom: '2099-01-02', productPrices: bulkPrices}, 400);
  assert.equal(tooMany.record, null);
  assert.equal(domainAudit(tooMany.body.id).length, 0);
  at('2099-01-01T08:00:00Z');
  const preciseArgs = {agentId: 'buyer-end_customer', items: [{productId: bulkPrices[0].productId, quantity: 1}]};
  const precise = await post(quoteApi, '/api/sales/quote', preciseArgs, staff);
  assert.equal(precise.lines[0].unitPrice, '999999999999999999', 'Template prices work without a separate sales-price row and retain eighteen digits');
  assert.equal(precise.amount, String(999999999999999999n * 9000n / 10000n));
  assert.equal(precise.discount, String(999999999999999999n - 999999999999999999n * 9000n / 10000n));
  assert.equal((await catalog.executeTool('preview_sales_order', preciseArgs, base, principal(staff, 'read'))).quoteHash, precise.quoteHash);

  // Day definitions use the real MCP/HTTP handlers and the actual invoice day.
  // Older calendar-month snapshots must remain byte-for-byte unchanged.
  at('2026-10-26T08:00:00Z');
  const oldSnapshots=sql.prepare("SELECT id,data FROM flow_entities WHERE type IN ('sales_order','sales_invoice') ORDER BY id").all();
  const dailyBody=templateBody('representative',{effectiveFrom:'2026-10-26',days:47,maxDays:60});
  for(const key of ['months','minMonths','maxMonths'])delete dailyBody[key];
  await catalog.executeTool('sales_network_apply',{id:dailyBody.id,mode:'template',confirmed:true,data:dailyBody},base,principal());
  assert.equal(entity(dailyBody.id).data.days,47);assert.equal(entity(dailyBody.id).data.maxDays,60);assert.equal(entity(dailyBody.id).data.months,undefined);
  const repeatedDaily=await post(network,'/api/sales/network',dailyBody);assert.equal(repeatedDaily.repeated,true);
  const dailyQuote=await quote();assert.equal(dailyQuote.salesTerms.days,47);assert.equal(dailyQuote.salesTerms.maxDays,60);assert.equal(dailyQuote.termDays,47);assert.equal(dailyQuote.due,'2026-12-12');assert.equal(dailyQuote.installments.find(p=>p.kind==='balance').due,'2026-12-12');
  assert.equal((await catalog.executeTool('preview_sales_order',{agentId:'buyer-representative',items},base,principal(staff,'read'))).quoteHash,dailyQuote.quoteHash);
  for(const days of [61,-1,0.5,'47'])await post(quoteApi,'/api/sales/quote',{agentId:'buyer-representative',items,salesTerms:{cashBps:5000,days}},staff,400);
  const earlyDaily=await post(quoteApi,'/api/sales/quote',{agentId:'buyer-representative',items,salesTerms:{cashBps:10000,days:0}},staff);assert.ok(earlyDaily.installments.every(p=>p.due==='2026-10-26'));
  const atLimit=await post(quoteApi,'/api/sales/quote',{agentId:'buyer-representative',items,salesTerms:{cashBps:5000,days:60}},staff);assert.equal(atLimit.salesTerms.days,60);
  const dailyOrder=await order(dailyQuote);await post(sales,'/api/sales',salesBody('order_review',{orderId:dailyOrder.body.id,revision:1,approved:true}));
  at('2026-10-27T08:00:00Z');
  const dailyInvoiceBody=salesBody('invoice',{orderId:dailyOrder.body.id,revision:entity(dailyOrder.body.id).revision,reference:'DAY-BASED-INVOICE'});
  await post(sales,'/api/sales',dailyInvoiceBody,finance);assert.equal(entity(dailyInvoiceBody.id).data.installments.find(p=>p.kind==='balance').due,'2026-12-13');assert.equal(entity(dailyInvoiceBody.id).data.salesTerms.days,47);
  const beforeNewVersion=sql.prepare('SELECT data FROM flow_entities WHERE id=?').get(dailyInvoiceBody.id).data;
  await saveTemplate('representative',{effectiveFrom:'2026-10-27',days:15,maxDays:60});assert.equal((await quote()).salesTerms.days,15);assert.equal(sql.prepare('SELECT data FROM flow_entities WHERE id=?').get(dailyInvoiceBody.id).data,beforeNewVersion);
  for(const previous of oldSnapshots)assert.equal(sql.prepare('SELECT data FROM flow_entities WHERE id=?').get(previous.id).data,previous.data,'Legacy order/invoice snapshot '+previous.id);
  for(const values of [{days:70,maxDays:60},{days:-1},{days:1.5},{days:'30'},{days:30,maxDays:367}])await saveTemplate('representative',{effectiveFrom:'2026-10-27',...values},400);
  const payment=load('lib/sales-payment-terms.ts'),paymentContract=load('lib/sales-network-contract.ts');
  for(const [day,days,end] of [['2028-02-28',2,'2028-03-01'],['2026-12-31',1,'2027-01-01'],['2026-03-20',1,'2026-03-21'],['2026-10-27',0,'2026-10-27']])assert.equal(paymentContract.termsPlan('101',{cashBps:5000,days},day).find(p=>p.kind==='balance').due,end);
  for(const day of ['2026-03-20','2026-09-20','2028-02-28'])assert.equal(payment.addPaymentDays(day,payment.salesPaymentDays({months:1},day)),paymentContract.addSolarMonths(day,1));
  console.log('PASS day-based sales terms: exact day invoices, zero/maximum limits, invalid input rollback, month-end/year/leap boundaries, HTTP/MCP parity and immutable legacy snapshots.');
  sql.prepare("UPDATE app_members SET status='inactive' WHERE id='manager'").run();
  const revoked = templateBody();
  await post(network, '/api/sales/network', revoked, manager, 403);
  await assert.rejects(() => catalog.executeTool('sales_network_apply', {id: revoked.id, mode: 'template', confirmed: true, data: revoked}, base, principal()), error => error.status === 403);
  assert.equal(entity(revoked.id), null);
  assert.equal(sql.prepare('PRAGMA foreign_key_check').all().length, 0);
  console.log('PASS sales template flow: HTTP/MCP authority, confirmation, bounded catalog-price validation, concurrent product-change rollback, exact BigInt price/discount math, promotion/fixed/legacy price precedence, idempotent audit, legacy fixed terms, scheduled defaults, inclusive Tehran promotion dates, price-only stale quotes, and immutable orders/invoices.');
})().catch(error => { console.error(error); process.exitCode = 1; }).finally(() => sql.close());
