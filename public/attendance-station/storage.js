// Templates and the station credential never enter the service-worker cache.
let database;
function openDatabase(){
 return new Promise((resolve,reject)=>{
  const request=indexedDB.open('hamnafas-attendance-station',1);
  request.onupgradeneeded=()=>{
   const db=request.result;
   db.createObjectStore('station');
   db.createObjectStore('people',{keyPath:'id'});
   const events=db.createObjectStore('events',{keyPath:'id'});
   events.createIndex('at','at');events.createIndex('pending',['state','at','id']);
   events.createIndex('member',['memberId','at']);
  };
  request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);
 });
}
async function transaction(names,mode,operation){
 database||=openDatabase();const db=await database;
 return new Promise((resolve,reject)=>{
  const tx=db.transaction(names,mode);let result,problem;
  const set=value=>{result=value},abort=message=>{problem=new Error(message);tx.abort()};
  tx.oncomplete=()=>resolve(result);tx.onabort=()=>reject(problem||tx.error||new Error('ذخیره روی ایستگاه کامل نشد.'));
  operation(tx,set,abort);
 });
}
function read(store,key){
 return transaction([store],'readonly',(tx,set)=>{const r=tx.objectStore(store).get(key);r.onsuccess=()=>set(r.result)});
}
function people(){
 return transaction(['people'],'readonly',(tx,set)=>{const r=tx.objectStore('people').getAll();r.onsuccess=()=>set(r.result)});
}
function enroll(person,vectors,score){
 return transaction(['people'],'readwrite',(tx,set,abort)=>{
  const items=tx.objectStore('people'),r=items.getAll();
  r.onsuccess=()=>{
   if(r.result.some(p=>p.id!==person.id&&vectors.filter(v=>score(v,p)<.50).length>=2))return abort('این چهره قبلاً برای فرد دیگری ثبت شده است.');
   items.put({id:person.id,name:person.name,vectors});
  };
 });
}
function record(memberId,direction){
 return transaction(['events'],'readwrite',(tx,set,abort)=>{
  const events=tx.objectStore('events'),at=new Date().toISOString(),range=IDBKeyRange.bound([memberId,''],[memberId,'\uffff']);
  const previous=events.index('member').openCursor(range,'prev');
  previous.onsuccess=()=>{
   const last=previous.result?.value;
   if(last&&Date.parse(at)-Date.parse(last.at)<60000)return abort('تردد نزدیک به هم قبلاً روی این ایستگاه ثبت شده است.');
   const event={id:crypto.randomUUID(),at,memberId,direction,state:'pending'};
   events.add(event);set(event);
  };
 });
}
async function pending(cursor){
 return transaction(['events'],'readonly',(tx,set)=>{
  const r=tx.objectStore('events').index('pending').getAll(IDBKeyRange.bound(cursor||['pending',''],['pending','\uffff'],!!cursor),40);
  r.onsuccess=()=>set(r.result);
 });
}
async function queueCount(){
 return transaction(['events'],'readonly',(tx,set)=>{
  const r=tx.objectStore('events').index('pending').count(IDBKeyRange.bound(['pending',''],['pending','\uffff']));
  r.onsuccess=()=>set(r.result);
 });
}
async function acknowledge(id){
 return transaction(['events'],'readwrite',(tx)=>{
  const events=tx.objectStore('events'),r=events.get(id);
  r.onsuccess=()=>{if(r.result){events.put({...r.result,state:'sent'});const expire=new Date(Date.now()-86400000*7).toISOString();
   const old=events.index('pending').openCursor(IDBKeyRange.bound(['sent',''],['sent',expire]));
   old.onsuccess=()=>{if(old.result){old.result.delete();old.result.continue()}};}};
 });
}


async function flushQueue(send){
  const held=new Set();let conflict='',cursor;
  while(true){
   const batch=await pending(cursor);if(!batch.length)break;
   for(const event of batch){
    cursor=[event.state,event.at,event.id];
    const {id,memberId,at,direction}=event;
    if(held.has(memberId))continue;
    try{
     const result=await send({id,memberId,at,direction});
     if(result.saved!==true||result.id!==id){throw new Error('ثبت تردد در سرور تأیید نشد.')};
     await acknowledge(id);
    }catch(e){if(e.status!==409&&e.status!==400&&e.status!==422)throw e;held.add(memberId);conflict=e.message;}
   }
  }
 return conflict;
}

async function sendStationEvent(token,event){
 const response=await fetch('/api/personnel/stations/sync',{method:'POST',credentials:'omit',cache:'no-store',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},body:JSON.stringify(event)});
 const result=await response.json().catch(()=>null);
 if(!response.ok||!result){const error=new Error(result?.error||'هم‌نفس در دسترس نیست.');error.status=response.status;throw error;}
 return result;
}
