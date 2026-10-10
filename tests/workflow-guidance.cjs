const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript');
const exportsGuide={};vm.runInNewContext(ts.transpileModule(fs.readFileSync('lib/workflow-guidance.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{exports:exportsGuide,Date});
const {guidanceOutline}=exportsGuide,task={id:'test',state:'open',due:'2026-11-01',data:{instructions:'Specific original instruction',evidence:'Signed inspection report'}};
// Discover producer flags, so newly added workflow families must receive a real profile.
const flags=new Set();for(const dir of ['lib','app/api']){function walk(d){for(const e of fs.readdirSync(d,{withFileTypes:true})){const p=d+'/'+e.name;if(e.isDirectory())walk(p);else if(p.endsWith('.ts')&&!p.includes('workflow-guidance'))for(const m of fs.readFileSync(p,'utf8').matchAll(/\b([a-zA-Z]+Workflow)\s*:\s*true/g))flags.add(m[1]);}}walk(dir);}
for(const flag of flags){const g=guidanceOutline({...task,data:{...task.data,[flag]:true}});assert.notEqual(g.kind,'general',flag);assert.equal(g.instructions,task.data.instructions);assert.equal(g.evidence,task.data.evidence);assert.ok(g.humanChecks.length);assert.ok(g.submitChecks.every(c=>c.status==='on_submit'));}
const blocked=guidanceOutline({...task,state:'blocked'});assert.equal(blocked.checks[0].status,'attention');
assert.equal(guidanceOutline({...task,due:'invalid'}).checks[1].status,'unknown');
const closed=guidanceOutline({...task,state:'completed',data:{treasuryWorkflow:true,workflowRole:'ceo'}});assert.ok(closed.closed);assert.ok(!closed.steps.some(s=>s.includes('صادر کنید')));
assert.equal(guidanceOutline({...task,data:{missingOwner:true}}).checks.find(c=>c.key==='owner').status,'attention');
console.log('PASS workflow guidance:',flags.size,'producer families, original evidence/instructions, blocked/closed/invalid deadlines, unassigned owner, no fabricated passed submit guards.');
