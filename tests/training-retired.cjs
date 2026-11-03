const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),ts=require('typescript');
const root=path.resolve(__dirname,'..'),cache={};let authenticated=true,checks=0;
const denied=Object.assign(new Error('Authentication required'),{status:401});
function load(file){file=path.resolve(root,file);if(cache[file])return cache[file];const exports={};cache[file]=exports;
 vm.runInNewContext(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{exports,Response,require:n=>{
  if(n==='./authorization')return {requireAccess:async()=>{checks++;if(!authenticated)throw denied;return {userId:'tester'}},accessResponse:e=>e===denied?Response.json({error:e.message},{status:401}):null};
  if(n==='@/lib/training-retired')return load('lib/training-retired.ts');
  throw Error('Retired endpoint must not load storage, fixtures or business handlers: '+n);
 }},{filename:file});return exports;
}
(async()=>{
 for(const file of ['app/api/training/route.ts','app/api/training/[...path]/route.ts']){
  const route=load(file);
  for(const [method,handler] of Object.entries(route)){
   const before=checks,r=await handler(new Request('https://test.local/api/training/flow?_role=role-8',{method,...(method==='GET'?{}:{body:JSON.stringify({confirmed:true,mode:'receipt'})})}));
   assert.equal(r.status,410,method);assert.equal((await r.json()).code,'training_retired');assert.match(r.headers.get('cache-control'),/no-store/);assert.equal(checks,before+1);
   authenticated=false;assert.equal((await handler()).status,401);authenticated=true;
  }
 }
 console.log('Retired training endpoints: authenticated 410, no seeding/dispatch/storage, unauthenticated denied.');
})().catch(e=>{console.error(e);process.exitCode=1});
