const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript');
const exportsObject={},timers=new Map();let clock=0,id=0;
vm.runInNewContext(ts.transpileModule(fs.readFileSync('lib/voice-recognition.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{exports:exportsObject,Set,setTimeout(f,ms){timers.set(++id,{f,at:clock+ms});return id},clearTimeout(id){timers.delete(id)}});
function advance(ms){clock+=ms;for(const [id,t] of [...timers])if(t.at<=clock){timers.delete(id);t.f()}}
let r,states=[],notices=[],texts=[],throws=false;
const c=exportsObject.createVoiceRecognition({create(){if(throws)throw Error('constructor');return r={start(){},stop(){},abort(){this.aborted=true}}},onState:s=>states.push(s),onNotice:s=>notices.push(s),onText:s=>texts.push(s)});
c.start('');assert.equal(states.at(-1),'starting');r.onstart();assert.equal(states.at(-1),'listening');
const stale=r.onresult;r.onerror({error:'network'});assert.equal(states.at(-1),'idle');assert.equal(timers.size,0);assert.equal(r.aborted,true);
c.start('قبلی');const active=r;r.onstart();stale({results:[[{transcript:'نباید ثبت شود'}]]});assert.equal(texts.length,0);r.onresult({results:[[{transcript:'سلام'}]]});assert.equal(texts.at(-1),'قبلی سلام');r.onend();assert.equal(states.at(-1),'idle');assert.match(notices.at(-1),/آماده/);
c.start('');advance(15000);assert.equal(states.at(-1),'idle');assert.match(notices.at(-1),/شروع نشد/);assert.equal(timers.size,0);
c.start('');r.onstart();c.stop();advance(2500);assert.equal(states.at(-1),'idle');assert.match(notices.at(-1),/متنی دریافت نشد/);
c.start('');r.onend();assert.doesNotMatch(notices.at(-1),/آماده/);
c.start('');r.onerror({error:'not-allowed'});assert.match(notices.at(-1),/مجوز/);c.start('');r.onstart();const previous=r.onresult;c.cancel();previous({results:[[{transcript:'حساب قبل'}]]});assert.equal(texts.length,1);assert.equal(timers.size,0);
throws=true;c.start('');assert.equal(states.at(-1),'idle');assert.equal(timers.size,0);
console.log('Voice passed: recovery after error without end, startup/stop watchdogs, constructor failures, empty result feedback, transcript draft, stale events and account/unmount cancellation.');
