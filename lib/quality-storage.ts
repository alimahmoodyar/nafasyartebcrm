import {flowRole} from './material-flow';
import {requireAccess,can,AccessError} from '@/lib/authorization';
import {storage} from '@/lib/storage';
import type {QTemplate,QReport} from '@/lib/quality';
export async function qualityAccess(write=false){const actor=await requireAccess('device');if(flowRole(actor,'qc'))return actor;if(!can(actor,'event',write?'write':'read')||write&&!actor.isAdmin&&!actor.permissions.eventStages.includes('آزمون نهایی'))throw new AccessError('مجوز کنترل کیفیت و مرحله آزمون نهایی لازم است.',403);return actor;}
export async function qualityRecord(id:string,kind:'device'|'product'){const r=await storage().prepare('SELECT payload FROM records WHERE id=? AND kind=?').bind(id,kind).first<{payload:string}>();if(!r)throw new AccessError('محصول یا دستگاه پیدا نشد.',404);return JSON.parse(r.payload) as Record<string,string>;}
export function templateRow(r:any):QTemplate{return {...r,fields:JSON.parse(r.fields)};}
export async function qualityTemplate(id:string){const r=await storage().prepare('SELECT * FROM quality_templates WHERE id=?').bind(id).first();if(!r)throw new AccessError('فرم پیدا نشد.',404);return templateRow(r);}
export async function qualityReport(id:string){const r=await storage().prepare('SELECT * FROM quality_reports WHERE id=?').bind(id).first<any>();if(!r)throw new AccessError('برگ کنترل کیفیت پیدا نشد.',404);return {...r,values:JSON.parse(r.values),template:await qualityTemplate(r.template_id)} as QReport;}
export function qualityError(e:unknown){return e instanceof AccessError?Response.json({error:e.message},{status:e.status}):Response.json({error:e instanceof Error&&!/D1|SQLITE|UNIQUE|Database/.test(e.message)?e.message:'ثبت یا دریافت انجام نشد؛ فهرست را تازه کنید و دوباره تلاش کنید.'},{status:e instanceof Error&&/UNIQUE/.test(e.message)?409:400});}
