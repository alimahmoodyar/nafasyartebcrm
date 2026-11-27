const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {DatabaseSync}=require('node:sqlite');
const ts=require('typescript');
const vm=require('node:vm');
const repo=path.resolve(__dirname,'..');
const sqlite=new DatabaseSync(':memory:');
for(const name of fs.readdirSync(path.join(repo,'drizzle')).filter(n=>n.endsWith('.sql')).sort()){
 sqlite.exec(fs.readFileSync(path.join(repo,'drizzle',name),'utf8'));
}
const db={prepare(sql){const statement=sqlite.prepare(sql);return {bind(...args){return {
 all:async()=>({results:statement.all(...args)}),
 run:async()=>({meta:{changes:statement.run(...args).changes}})
}}}}};
const api={};
vm.runInNewContext(ts.transpile(fs.readFileSync(path.join(repo,'lib/exhibition-visits.ts'),'utf8'),{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}),{exports:api,require:id=>id==='./authorization'?{AccessError:Error}:{validDay:s=>/^\d{4}-\d{2}-\d{2}$/.test(s)}});
async function test(){
 const actor={id:'seller',manager:false},other={id:'other',manager:false};
 const visit={id:'visit-'+crypto.randomUUID(),event:'غرفه الف',draft:true,revision:0,fields:{phone:'۰۹۱'}};
 await api.saveVisit(db,actor,visit,[]);
 assert.equal((await api.readVisits(db,actor,'')).events[0],visit.event);
 assert.equal((await api.readVisits(db,other,visit.event)).visits.length,0);
 assert.equal((await api.readVisits(db,actor,'غرفه ب')).visits.length,0);
 const [draft]=(await api.readVisits(db,actor,visit.event)).visits;
 assert.equal(draft.data.phone,'۰۹۱');assert.equal(draft.data.draft,true);
 const edit={...visit,revision:draft.revision,draft:false,fields:{person:'بازدیدکننده',company:'مرکز',position:'مدیر',specialty:'خرید',phone:'09120000001',action:'تماس',assignee:'other',due:'2026-12-01'}};
 await assert.rejects(api.saveVisit(db,other,edit,['other']));
 await api.saveVisit(db,actor,edit,['other']);
 await assert.rejects(api.saveVisit(db,actor,edit,['other']));
 const saved=(await api.readVisits(db,other,visit.event)).visits;
 assert.equal(saved.length,1);assert.equal(saved[0].id,draft.id);assert.equal(saved[0].data.draft,false);assert.equal(saved[0].data.due,edit.fields.due);
 console.log('Exhibition draft, scoped list, completion, assignment and stale-write checks passed.');
}
test().catch(e=>{console.error(e);process.exitCode=1});
