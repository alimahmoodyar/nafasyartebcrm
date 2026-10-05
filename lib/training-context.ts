import {AsyncLocalStorage} from 'node:async_hooks';
import {trainingTables} from './training-tables';
export const trainingContext=new AsyncLocalStorage<{actor:string;role:string}>();
const tables=new Set<string>(trainingTables);
// SQL lexer: rewrite identifiers only, never literal values or comments.
export function trainingSQL(sql:string){return sql.replace(/'(?:''|[^'])*'|--[^\n]*|\/\*[\s\S]*?\*\/|"(?:""|[^"])*"|`[^`]*`|\[[^\]]*\]|\b[A-Za-z_][A-Za-z_0-9]*\b/g,token=>{
 if(token.startsWith("'")||token.startsWith('--')||token.startsWith('/*'))return token;
 const quoted=['"','`','['].includes(token[0]),name=quoted?token.slice(1,-1):token;
 if(name.startsWith('training_')||name==='sqlite_master'||name==='sqlite_schema')throw Error('Training SQL cannot address physical tables');
 return tables.has(name)?(quoted?token[0]+'training_'+name+token.at(-1):'training_'+name):token;
});}
export function trainingDatabase(db:D1Database):D1Database{return new Proxy(db,{get(target,key){if(key==='prepare')return (sql:string)=>target.prepare(trainingSQL(sql));if(key==='batch')return target.batch.bind(target);throw Error('Unsupported training database operation');}});}
export function trainingBucket(bucket:R2Bucket):R2Bucket{return new Proxy(bucket,{get(target,key){
 if(['get','head','put','delete'].includes(String(key)))return (name:string|string[],...args:any[])=>(target[key as 'get'] as any).call(target,Array.isArray(name)?name.map(n=>'training/v1/'+n):'training/v1/'+name,...args);
 throw Error('Unsupported training file operation');
}});}
