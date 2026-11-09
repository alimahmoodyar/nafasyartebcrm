import assert from 'node:assert/strict';
import {createHmac,randomUUID} from 'node:crypto';
import {DatabaseSync} from 'node:sqlite';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';

const {default:worker}=await import(pathToFileURL(resolve(process.argv[2],'worker/index.js')).href);
const sql=new DatabaseSync(':memory:');
sql.exec('CREATE TABLE gas_survey_state (id TEXT PRIMARY KEY, data TEXT NOT NULL)');
const DB={
 prepare(query){
  return {bind(...args){
   return {
    async first(){return sql.prepare(query).get(...args);},
    async run(){return {meta:{changes:Number(sql.prepare(query).run(...args).changes)}};},
   };
  }};
 },
};
const secret='test-bridge',origin='https://public.test',crm='https://private.test';
const env={DB,GAS_SURVEY_BRIDGE_SECRET:secret,NAFASYAR_ORIGIN:crm};
function sign(purpose,value){
 const payload=Buffer.from(JSON.stringify(value)).toString('base64url');
 return payload+'.'+createHmac('sha256',secret).update(purpose+'.'+payload).digest('base64url');
}
const id=randomUUID(),expires=new Date(Date.now()+30000).toISOString(),token=sign('invite',{id,center:'Sample center',expires});
const request=(path,body,from=origin)=>worker.fetch(new Request(origin+path,{method:'POST',headers:{Origin:from,'Content-Type':'application/json'},body:JSON.stringify(body)}),env);
assert.deepEqual(await (await request('/survey',{id,token,mode:'open'})).json(),{center:'Sample center',submitted:false});
const answers={method:'cylinder',rows:[{volume:40,count:3}],pressure:120,peakHours:4};
const submitted=await Promise.all([request('/survey',{id,token,mode:'submit',answers}),request('/survey',{id,token,mode:'submit',answers})]);
assert.equal(submitted.filter(response=>response.status===200).length,1);
const ticket=sign('read',{id,until:Date.now()+30000});
assert.equal((await request('/manage',{id,ticket,mode:'read'})).status,403);
assert.equal((await request('/manage',{id,ticket,mode:'revoke'},crm)).status,404);
const status=await request('/manage',{id,ticket,mode:'read'},crm);
assert.equal(status.headers.get('Access-Control-Allow-Origin'),crm);
const {receipt}=await status.json();
const decoded=JSON.parse(Buffer.from(receipt.split('.')[0],'base64url').toString());
assert.deepEqual(decoded.answers,answers);
assert.equal(receipt,sign('receipt',decoded));
const other=randomUUID(),revoke=sign('revoke',{id:other,until:Date.now()+30000});
assert.equal((await request('/manage',{id:other,ticket:revoke,mode:'revoke'},crm)).status,200);
assert.equal((await request('/survey',{id:other,token:sign('invite',{id:other,center:'Revoked',expires}),mode:'open'})).status,404);
const expired=sign('invite',{id,center:'Expired',expires:new Date(Date.now()-1000).toISOString()});
assert.equal((await request('/survey',{id,token:expired,mode:'open'})).status,404);
console.log('PASS anonymous questionnaire, single submission, signed CRM readback, revocation and expiration');
