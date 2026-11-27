'use strict';
const el=id=>document.getElementById(id),fail=message=>{throw new Error(message)};
const poses=['روبه‌رو','کمی به راست','کمی به چپ'],video=el('live');
const time=new Intl.DateTimeFormat('fa-IR',{timeZone:'Asia/Tehran',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'});
const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));
let installation,ready=false,view='station',stream=null,job=0,busy=false,samples=[],roster=[],syncing=false,stopWake,installPrompt;
const say=(message,error=false)=>{el('message').textContent=message;el('message').classList.toggle('error',error)};
function draw(){
 const enrolling=view==='enroll',mode=installation?.station.mode;
 el('station').hidden=enrolling;el('enroll').hidden=!enrolling;el('title').textContent=enrolling?'ثبت چهره پرسنل':'ایستگاه تردد';
 for(const key of ['enroll','station']){el(key+'-tab').classList.toggle('on',key===view);el(key+'-tab').disabled=!ready}
 el('in').hidden=mode==='out';el('out').hidden=mode==='in';
 for(const key of ['in','out','listen'])el(key).disabled=!ready||busy;
 el('capture').disabled=!ready||busy||!el('consent').checked||!el('name').value;
 el('name').disabled=busy||samples.length>0;el('redo').hidden=!samples.length;el('redo').disabled=busy;
 el('pose').textContent=samples.length===3?'سه نما آماده ثبت است':'نمای '+poses[samples.length];
 el('capture').textContent=samples.length===3?'ثبت چهره':stream?'گرفتن نمای '+poses[samples.length]:'روشن کردن وب‌کم';
 el('camera-stop').hidden=!stream&&!busy;
}
async function perform(action){
 if(busy||!ready)return;busy=true;const ticket=++job;draw();
 try{await action(ticket)}catch(e){if(ticket===job)say(({NotAllowedError:'اجازه استفاده از دوربین یا میکروفن را در مرورگر بدهید.',NotFoundError:'دوربین یا میکروفن در دسترس نیست.'})[e.name]||e.message,true)}
 finally{if(ticket===job){busy=false;if(view==='station')stopCamera();draw()}}
}
async function api(path,options={}){
 const response=await fetch('/api/personnel/stations/'+path,{cache:'no-store',...options});
 const result=await response.json().catch(()=>null);
 if(!response.ok||!result||result.error){const error=new Error(result?.error||'پاسخ معتبر از هم‌نفس دریافت نشد.');error.status=response.status;throw error;}
 return result;
}
async function link(){
 let ticket=new URLSearchParams(location.hash.slice(1)).get('ticket');history.replaceState(null,'',location.pathname);
 const current=await read('station','connection');
 if(current&&ticket)fail('این مرورگر قبلاً به یک ایستگاه متصل شده است. برای ایستگاه دیگری از سیستم یا نمایهٔ دیگری استفاده کنید.');
 if(current)return current;
 if(!ticket)fail('از پروفایل اداری «نصب و اتصال ایستگاه» را باز کنید.');
 const result=await api('link',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({ticket})});
 if(!result.station?.id||!result.token)fail('اتصال کامل نشد.');
 await transaction(['station'],'readwrite',tx=>tx.objectStore('station').add(result,'connection'));
 return result;
}
async function loadRoster(){
 const people=[],seen=new Set();let after='';
 do{
  const query=new URLSearchParams({stationId:installation.station.id});if(after)query.set('after',after);
  const page=await api('roster?'+query);
  if(!Array.isArray(page.people))fail('فهرست پرسنل فعال دریافت نشد.');
  people.push(...page.people);after=page.next||'';
  if(after&&seen.has(after))fail('دریافت فهرست پرسنل کامل نشد.');seen.add(after);
 }while(after);
 return people;
}
async function enrollment(){
 await perform(async ticket=>{
  const staff=await loadRoster();assertCurrent(ticket);roster=staff;
  const select=el('name');select.replaceChildren(new Option('انتخاب فرد',''),...staff.map(p=>new Option(p.name,p.id)));
  await turnOffWake();discard();stopCamera();el('consent').checked=false;view='enroll';say('فرد را انتخاب کنید و سه نما بگیرید.');
 });
}
el('capture').onclick=()=>perform(async ticket=>{
 if(view!=='enroll'||!el('consent').checked)return;
 const person=roster.find(p=>p.id===el('name').value);if(!person)fail('فرد را انتخاب کنید.');
 if(samples.length===3){
  const active=await loadRoster();assertCurrent(ticket);
  if(!active.some(p=>p.id===person.id))fail('پروندهٔ فعال یا دسترسی اداری تأیید نشد.');
  const known=await people();assertCurrent(ticket);
  if(known.some(p=>p.id!==person.id&&samples.filter(v=>score(v,p)<.50).length>=2))fail('این چهره قبلاً برای فرد دیگری ثبت شده است.');
  const linked=await api('roster',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({stationId:installation.station.id,memberId:person.id})});
  assertCurrent(ticket);if(linked.enrolled!==true)fail('ثبت چهره روی ایستگاه تأیید نشد.');
  await enroll(person,samples.slice(),score);assertCurrent(ticket);discard();view='station';say('چهره '+person.name+' برای همین ایستگاه ثبت شد.');return;
 }
 if(!stream){await camera(ticket);say('نمای '+poses[samples.length]+' را بگیرید.');return}
 const shot=frame(),vector=await describe(shot);assertCurrent(ticket);
 if(samples.some(v=>distance(v,vector)>.56))fail('نما با تصاویر قبلی همخوانی ندارد.');
 const fig=document.createElement('figure'),cap=document.createElement('figcaption');fig.className='thumb';cap.textContent=poses[samples.length];fig.append(shot,cap);el('previews').append(fig);samples.push(vector);
 if(samples.length===3){stopCamera();say('سه نما را بررسی و ثبت کنید.')}else say('نمای '+poses[samples.length]+' را بگیرید.');
});
async function syncQueue(){
 if(syncing||!installation)return;syncing=true;
 try{
  const conflict=navigator.onLine?await flushQueue(event=>sendStationEvent(installation.token,event)):'';
  const count=await queueCount();
  el('queue').textContent=count?count.toLocaleString('fa-IR')+' تردد در انتظار ارسال'+(conflict?' · نیازمند بررسی اداری: '+conflict:''):'همه ترددهای این ایستگاه ارسال شده‌اند.';
 }catch(e){el('queue').textContent='تردد در صف باقی ماند. '+e.message}
 finally{syncing=false}
}
async function punch(direction){
 await perform(async ticket=>{
  const registered=await people();assertCurrent(ticket);if(!registered.length)fail('ابتدا اداری چهرهٔ فرد را روی این ایستگاه ثبت کند.');
  say('روبه دوربین نگاه کنید.');await camera(ticket);await pause(500);assertCurrent(ticket);
  const id=identify(await describe(frame()),registered);await pause(200);assertCurrent(ticket);
  if(identify(await describe(frame()),registered)!==id)fail('چهره در دو تصویر یکسان تشخیص داده نشد.');
  assertCurrent(ticket);stopCamera();
  if(!direction){direction=await chooseDirection(ticket);assertCurrent(ticket)}
  const event=await record(id,direction),name=registered.find(p=>p.id===id).name;
  say(name+'، '+(direction==='in'?'ورود':'خروج')+' شما ساعت '+time.format(new Date(event.at))+' روی ایستگاه ثبت شد.');
  if(navigator.serviceWorker?.controller)navigator.serviceWorker.ready.then(registration=>registration.sync?.register('attendance-send')).catch(()=>{});
  void syncQueue();try{await window.stationVoice?.announce(installation.station.id,direction)}catch{}
 });
}
function chooseDirection(ticket){
 say('شناسایی شدید. ورود یا خروج را انتخاب کنید.');
 return new Promise((resolve,reject)=>{
  const buttons=['in','out'].map(id=>el(id));
  const finish=(event)=>{if(event){event.stopImmediatePropagation();event.preventDefault()}clearInterval(timer);buttons.forEach(b=>b.removeEventListener('click',finish,true));event?resolve(event.currentTarget.id):reject(new Error('انتخاب تردد لغو شد.'))};
  const expire=Date.now()+15000;const timer=setInterval(()=>{if(job!==ticket||Date.now()>=expire)finish()},200);
  buttons.forEach(b=>{b.disabled=false;b.addEventListener('click',finish,true)});
 });
}
async function turnOffWake(){const stop=stopWake;stopWake=null;if(stop)await stop();el('listen').textContent='فعال کردن «منو ببین»'}
el('listen').onclick=()=>perform(async ticket=>{
 if(stopWake){await turnOffWake();return}
 window.stationVoice?.prepare();say('در حال آماده‌سازی شنیدن…');
 const {startWake}=await import('./speech/wake.js');
 const stop=await startWake(()=>{if(view==='station'&&!busy&&!document.hidden)return punch(installation.station.mode==='both'?null:installation.station.mode)},error=>{void turnOffWake();say(error.message||'شنیدن متوقف شد.',true)});
 if(ticket!==job){await stop();return}stopWake=stop;el('listen').textContent='توقف شنیدن';say('آماده‌ام. بگویید «منو ببین».');
});
for(const dir of ['in','out'])el(dir).onclick=()=>{window.stationVoice?.prepare();void punch(dir)};
el('redo').onclick=()=>{samples.pop();el('previews').lastElementChild?.remove();draw()};
el('station-tab').onclick=()=>{cancel();discard();view='station';draw();say('نوع تردد را انتخاب کنید.')};
el('enroll-tab').onclick=enrollment;el('camera-stop').onclick=()=>{cancel();say('دوربین خاموش شد.')};
el('consent').onchange=()=>{if(!el('consent').checked){cancel();discard()}draw()};el('name').onchange=draw;
function refreshStation(){void syncQueue();if(installation&&navigator.onLine)void window.stationVoice?.refresh(installation)}
el('sync').onclick=refreshStation;window.addEventListener('online',refreshStation);
document.addEventListener('visibilitychange',()=>{if(document.hidden){cancel();discard();void turnOffWake();if(view==='enroll'){view='station';draw()}}});
window.addEventListener('pagehide',()=>{cancel();window.stationVoice?.stop();void turnOffWake()});
window.addEventListener('beforeinstallprompt',event=>{event.preventDefault();installPrompt=event;el('install').hidden=false});
el('install').onclick=async()=>{if(installPrompt){await installPrompt.prompt();const choice=await installPrompt.userChoice;if(choice.outcome==='accepted')await navigator.storage?.persist?.();installPrompt=null;el('install').hidden=true}};
const clock=()=>{el('clock').textContent=time.format(new Date())};clock();setInterval(clock,1000);
async function offlineReady(){
 const registration=await navigator.serviceWorker.register('./sw.js');
 await new Promise((resolve,reject)=>{
  const worker=registration.installing||registration.waiting||registration.active;
  if(!worker)return reject(new Error('ذخیره آفلاین آماده نشد.'));
  function state(){if(worker.state==='activated')resolve();if(worker.state==='redundant')reject(new Error('دریافت فایل‌های آفلاین کامل نشد.'))}
  worker.addEventListener('statechange',state);state();
 });
 el('offline').textContent='ایستگاه برای کار آفلاین آماده است.';
}
(async()=>{
 draw();installation=await link();el('location').textContent=installation.station.name+' · '+installation.station.location;
 el('offline').textContent='در حال ذخیره برنامه برای استفاده آفلاین…';
 offlineReady().catch(e=>el('offline').textContent=e.message);
 await Promise.all([faceapi.nets.tinyFaceDetector,faceapi.nets.faceLandmark68TinyNet,faceapi.nets.faceRecognitionNet].map(net=>net.loadFromUri('./models')));
 ready=true;draw();say('آماده ثبت تردد.');refreshStation();setInterval(refreshStation,30000);
})().catch(e=>say(e.message,true));
