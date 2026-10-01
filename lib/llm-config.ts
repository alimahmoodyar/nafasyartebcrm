import {z} from 'zod';
export const configInput=z.object({
 id:z.string().uuid(),revision:z.number().int().min(0),name:z.string().trim().min(1).max(100),model:z.string().trim().min(1).max(160),
 baseUrl:z.string().trim().url().max(1000).refine(v=>{const u=new URL(v);return u.protocol==='https:'&&!u.username&&!u.password&&!u.search&&!u.hash;},'Use an HTTPS base URL without credentials, query or fragment.'),
 systemPrompt:z.string().max(16000),temperature:z.number().min(0).max(2),maxTokens:z.number().int().min(1).max(131072),
 apiToken:z.string().max(4096).optional(),clearToken:z.boolean().optional(),
}).strict().refine(v=>!(v.clearToken&&v.apiToken),'Choose token replacement or removal.');
export type LlmProfile={id:string;revision:number;name:string;model:string;baseUrl:string;systemPrompt:string;temperature:number;maxTokens:number;hasToken:boolean;updated:string};
export function presentConfig(r:any):LlmProfile{return {id:r.id,revision:r.revision,name:r.name,model:r.model,baseUrl:r.base_url,systemPrompt:r.system_prompt,temperature:Number(r.temperature),maxTokens:r.max_tokens,hasToken:!!r.token_ciphertext,updated:r.updated};}
