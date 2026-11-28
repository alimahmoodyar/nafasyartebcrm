const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const vm = require('node:vm');

const source = fs.readFileSync(path.join(__dirname, '../app/page.tsx'), 'utf8');
const page = ts.createSourceFile('page.tsx', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
const handlers = [];
let homeButton;
function visit(node) {
  if (ts.isFunctionDeclaration(node) && ['goHome', 'navigate'].includes(node.name?.text)) handlers.push(node.getText(page));
  if (ts.isJsxElement(node) && node.openingElement.getText(page).includes('className="workspace-home-crumb"')) homeButton = node;
  ts.forEachChild(node, visit);
}
visit(page);
assert.match(homeButton.getText(page), /onClick=\{goHome\}/);
assert.match(homeButton.getText(page), /<span>خانه<\/span>/);
const script = ts.transpile(handlers.join('\n') + '\ngoHome();');
for (const [tab, identity, destination, target] of [
  ['warehouse', {userId:'employee'}, 'home', ''],
  ['home', {userId:'multi-role'}, 'home', ''],
  ['users', {isAdmin:true}, 'home', ''],
  ['warehouse', {profileReview:{id:'central-store'}}, 'role-testing', 'central-store']
]) {
  const state = {};
  const context = {tab,identity,navigationHistory:{current:['home','warehouse','tasks']},visibleSections:[],
    sectionDestination:(user,section,target)=>({section,target}),window:{dispatchEvent(){}},CustomEvent:class {}};
  for (const key of ['Tab','WorkTarget','EmployeeWorkspace','WarehouseMenu','AssistantWorkspace','Selected','Form','BreadcrumbSegments','Query','Filter']) {
    context['set'+key] = value => { state[key] = typeof value === 'function' ? value(null) : value; };
  }
  vm.runInNewContext(script, context);
  assert.equal(state.Tab,destination);
  assert.equal(state.WorkTarget,target);
  assert.equal(state.WarehouseMenu,'');
  assert.equal(state.EmployeeWorkspace,null);
  assert.equal(context.navigationHistory.current.length,0);
  assert.equal(state.BreadcrumbSegments.length,0);
}
console.log('PASS: shared home button, nested warehouse, employee home, admin and role preview');
