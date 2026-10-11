const assert=require('node:assert/strict'),ts=require('typescript'),fs=require('node:fs'),vm=require('node:vm');
const cache={};
function load(name){
 if(cache[name])return cache[name];
 const out=cache[name]={};
 vm.runInNewContext(ts.transpileModule(fs.readFileSync('lib/'+name+'.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2017}}).outputText,{exports:out,require:id=>id==='./storage'?{storage:()=>{throw Error('Unexpected database call')}}:load(id.replace(/^\.\//,''))});
 return out;
}
const out=load('personnel-positions'),catalogue=load('permissions').jobRoles;
const plain=value=>JSON.parse(JSON.stringify(value));
const rows=[{id:'a',type:'position',data:{active:true,name:'A',members:['me'],supervisor:'private'}},{id:'b',type:'position',data:{active:true,name:'B',members:['me']}},{id:'c',type:'position',data:{active:true,members:['other']}},{id:'d',type:'position',data:{active:false,members:['me']}},{type:'duty_template',data:{active:true,positionId:'a',title:'Own',instructions:'Steps'}},{type:'duty_template',data:{active:true,positionId:'c',title:'Private'}}];
const profiles=out.ownPositionProfiles(rows,'me');
assert.deepEqual(Array.from(profiles,p=>p.id),['a','b']);
assert.equal(profiles[0].tasks[0].title,'Own');
assert.equal(profiles[1].tasks.length,0);
assert.equal(JSON.stringify(profiles).includes('private'),false);
assert.equal(JSON.stringify(profiles).includes('members'),false);
assert.equal(out.ownPositionProfiles(rows,'').length,0);

// The complete explicit role assignment is shown without granting access to any
// catalogue permissions, scoped entity IDs or another person's assignments.
const all=out.ownJobResponsibilities({roleAssignment:{roles:catalogue.map(r=>r.id)}});
assert.equal(all.length,catalogue.length);
assert.deepEqual(plain(all),plain(catalogue.map(r=>({id:r.id,name:r.label,group:r.group,responsibilities:r.actions}))));
for(const description of all)assert.deepEqual(Object.keys(description).sort(),['group','id','name','responsibilities']);
const permissionData={roleAssignment:{roles:['treasurer','sales','treasurer','unknown-role'],salesAgentId:'private-agent',serviceAgentId:'private-service',warehouses:['private-warehouse']},members:['private-member'],grants:{read:['private-grant']}};
const selected=out.ownJobResponsibilities(permissionData);
assert.deepEqual(plain(selected.map(r=>r.id)),['treasurer','sales']);
assert.deepEqual(plain(out.ownJobResponsibilities(JSON.stringify(permissionData))),plain(selected));
assert.equal(JSON.stringify(selected).includes('private-'),false);
assert.equal(selected[0].name,'خزانه‌دار');
assert.equal(selected[0].responsibilities,catalogue.find(r=>r.id==='treasurer').actions);
for(const invalid of [null,undefined,0,true,'not-json','null','true','3','[]',[],{}, {read:['batch'],finance:'write'}, {roleAssignment:null}, {roleAssignment:[]}, {roleAssignment:{roles:'treasurer'}}, {roleAssignment:{roles:[null]}}, {roleAssignment:{roles:['treasurer',{}]}}])assert.equal(out.ownJobResponsibilities(invalid).length,0);
assert.equal(out.ownJobResponsibilities({roleAssignment:{roles:['unknown-role']}}).length,0);
assert.equal(out.ownJobResponsibilities(load('permissions').allPermissions).length,0,'An administrator without explicit assignments has no inferred job description');

// Company-authored descriptions and duty templates stay independent of the
// standard descriptions derived from roles; only the owner's profile is read.
const custom=out.ownPositionProfiles([{id:'own',type:'position',data:{active:true,members:['me'],name:'Company role',responsibilities:'Approved company duties',authorityBoundaries:'Approved limits'}},{id:'other',type:'position',data:{active:true,members:['other'],responsibilities:'Private duties'}},{type:'duty_template',data:{active:true,positionId:'own',title:'Company task',instructions:'Approved instructions'}}],'me');
assert.equal(custom[0].responsibilities,'Approved company duties');
assert.equal(custom[0].tasks[0].instructions,'Approved instructions');
assert.equal(JSON.stringify(selected).includes('Approved company duties'),false);
assert.equal(JSON.stringify(custom).includes('Private duties'),false);
console.log('Personnel position self-scope, role-based responsibilities, malformed permission handling and custom duties passed');
