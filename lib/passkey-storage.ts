// Compatibility with installations updated without applying migration 0024.
// Only absent Passkey tables are added. Existing keys/accounts/schema are never rewritten.
export const passkeyStorageStatements=[
 "CREATE TABLE IF NOT EXISTS auth_passkeys (id TEXT PRIMARY KEY, member_id TEXT NOT NULL REFERENCES app_members(id) ON DELETE CASCADE, account_version INTEGER NOT NULL, rp_id TEXT NOT NULL, public_key TEXT NOT NULL, counter INTEGER NOT NULL DEFAULT 0, transports TEXT NOT NULL DEFAULT '[]', name TEXT NOT NULL, created TEXT NOT NULL, last_used TEXT)",
 'CREATE INDEX IF NOT EXISTS auth_passkeys_member ON auth_passkeys(member_id,rp_id)',
 'CREATE TABLE IF NOT EXISTS auth_passkey_challenges (hash TEXT PRIMARY KEY, kind TEXT NOT NULL, challenge TEXT NOT NULL, origin TEXT NOT NULL, rp_id TEXT NOT NULL, member_id TEXT, account_version INTEGER, expires TEXT NOT NULL)',
 'CREATE INDEX IF NOT EXISTS auth_passkey_challenges_expiry ON auth_passkey_challenges(expires)',
] as const;
const readiness=new WeakMap<object,Promise<void>>();
export class PasskeyStorageError extends Error{
 constructor(public reason:'base'|'schema'|'setup'){super('زیرساخت Passkey روی این سرور آماده نیست؛ فعلاً با رمز وارد شوید و کد پیگیری را به مسئول سامانه بدهید.');this.name='PasskeyStorageError';}
}
function missingPasskeyTable(error:unknown){
 const seen=new Set<unknown>();let current:any=error;
 for(let i=0;i<4&&current&&!seen.has(current);i++){seen.add(current);if(/no such table:\s*["'`]?((?:main\.)?auth_passkeys|(?:main\.)?auth_passkey_challenges)["'`]?\b/i.test(String(current.message||current)))return true;current=current.cause;}
 return false;
}
async function inspect(db:D1Database){
 await db.prepare('SELECT id,member_id,account_version,rp_id,public_key,counter,transports,name,created,last_used FROM auth_passkeys LIMIT 0').all();
 await db.prepare('SELECT hash,kind,challenge,origin,rp_id,member_id,account_version,expires FROM auth_passkey_challenges LIMIT 0').all();
}
async function prepare(db:D1Database){
 try{await db.prepare('SELECT id FROM app_members LIMIT 0').all();await db.prepare('SELECT member_id,version FROM password_accounts LIMIT 0').all();}catch{throw new PasskeyStorageError('base');}
 try{await inspect(db);return;}catch(error){if(!missingPasskeyTable(error))throw new PasskeyStorageError('schema');}
 try{await db.batch(passkeyStorageStatements.map(sql=>db.prepare(sql)));await inspect(db);}catch{throw new PasskeyStorageError('setup');}
}
export function ensurePasskeyStorage(db:D1Database){
 let pending=readiness.get(db);if(!pending){pending=prepare(db);readiness.set(db,pending);pending.catch(()=>{if(readiness.get(db)===pending)readiness.delete(db)});}
 return pending;
}
