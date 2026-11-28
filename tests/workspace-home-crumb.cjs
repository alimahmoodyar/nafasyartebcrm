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
  if (ts.isFunctionDeclaration(node) && ['goHome', 'goBack', 'resetPageNavigation', 'navigate'].includes(node.name?.text)) handlers.push(node.getText(page));
  if (ts.isJsxElement(node) && node.openingElement.getText(page).includes('onClick={goHome}')) homeButton = node;
  ts.forEachChild(node, visit);
}
visit(page);
assert.match(homeButton.getText(page), /onClick=\{goHome\}/);
assert.match(homeButton.getText(page), /className="workspace-crumb-link"[^>]*>خانه<\/button>/);
const script = ts.transpile(handlers.join('\n') + '\ngoHome();');
for (const [tab, identity, destination, target] of [
  ['warehouse', {userId:'employee'}, 'home', ''],
  ['home', {userId:'multi-role'}, 'home', ''],
  ['users', {isAdmin:true}, 'home', ''],
  ['warehouse', {profileReview:{id:'central-store'}}, 'role-testing', 'central-store']
]) {
  const state = {};
  const context = {tab,identity,workTarget:'',centralWorkspace:false,centralPage:false,centralHistory:{current:[]},navigationHistory:{current:['home','warehouse','tasks']},visibleSections:[],
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

const centralScript = ts.transpile(handlers.join('\n'));
for (const [origin, identity, homeTarget] of [
  ['home', {userId:'warehouse-user'}, ''],
  ['role-testing', {userId:'manager',profileReview:{id:'central-store'}}, 'central-store']
]) {
  for (const menu of ['stock','operations','supply','dispatch','returns','counts','']) {
    const context = {
      tab:origin,workTarget:homeTarget,identity,centralWorkspace:true,centralPage:false,warehouseMenu:menu,
      centralHistory:{current:[]},navigationHistory:{current:[]},visibleSections:[{key:'warehouse'},{key:'routine-production'}],
      sectionDestination:(_user,section,target)=>({section,target}),window:{dispatchEvent(){}},CustomEvent:class {}
    };
    context.setTab=value=>{context.tab=value;context.centralPage=!['home','role-testing'].includes(value)};
    context.setWorkTarget=value=>{context.workTarget=value};
    context.setWarehouseMenu=value=>{context.warehouseMenu=value};
    for (const key of ['AssistantWorkspace','BreadcrumbSegments','Query','Filter']) context['set'+key]=()=>{};
    vm.createContext(context);
    vm.runInContext(centralScript,context);
    vm.runInContext('navigate("warehouse","first");navigate("warehouse","nested");navigate("routine-production","count");',context);
    context.goBack();
    assert.equal(context.tab,'warehouse');
    assert.equal(context.workTarget,'nested');
    context.goBack();
    assert.equal(context.workTarget,'first');
    context.goBack();
    assert.equal(context.tab,origin);
    assert.equal(context.workTarget,homeTarget);
    assert.equal(context.warehouseMenu,menu);
    if(menu){context.goBack();assert.equal(context.warehouseMenu,'')}
    assert.equal(context.navigationHistory.current.length,0);
  }
}
console.log('PASS: central warehouse Back restores exact screen and home menu for each warehouse group');
