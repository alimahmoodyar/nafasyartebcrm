import {trainingContext,trainingBucket} from "./training-context";
import {env} from 'cloudflare:workers';
import {storage} from '@/lib/storage';
import {AccessError} from '@/lib/authorization';
import type {Row} from '@/lib/model';
export function firmwareBucket(){if(!env.BUCKET)throw new AccessError('فضای فایل‌ها موقتاً در دسترس نیست؛ دوباره تلاش کنید.',503);return trainingContext.getStore()?trainingBucket(env.BUCKET):env.BUCKET;}
export type FirmwareFile={version_id:string;object_key:string;filename:string;byte_size:number;sha256:string;uploaded_at:string;uploaded_by:string};
export async function firmwareFile(id:string){return storage().prepare('SELECT * FROM firmware_files WHERE version_id=?').bind(id).first<FirmwareFile>();}
export function withFirmwareFile(row:Row,file:FirmwareFile|null):Row{return file?{...row,data:{...row.data,fileName:file.filename,fileSize:String(file.byte_size),fileHash:file.sha256,fileUploadedAt:file.uploaded_at,fileUploadedBy:file.uploaded_by}}:row;}
export async function firmwareRecord(id:string):Promise<Row>{
 const row=await storage().prepare("SELECT * FROM records WHERE id=? AND kind='firmware'").bind(id).first<{id:string;kind:'firmware';created:string;payload:string}>();
 if(!row)throw new AccessError('نسخه نرم‌افزار پیدا نشد.',404);return{id:row.id,kind:row.kind,created:row.created,data:JSON.parse(row.payload)};
}
// Consume a bounded body even when Content-Length is absent or forged.
export async function boundedBody(request:Request,limit:number){
 const declared=Number(request.headers.get('content-length'));if(declared>limit)throw new AccessError('حجم درخواست بیش از حد مجاز است.',413);
 const reader=request.body?.getReader();if(!reader)return new Uint8Array();let size=0;const chunks:Uint8Array[]=[];
 while(true){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>limit){await reader.cancel();throw new AccessError('حجم درخواست بیش از حد مجاز است.',413);}chunks.push(value);}
 const bytes=new Uint8Array(size);let offset=0;for(const c of chunks){bytes.set(c,offset);offset+=c.length;}return bytes;
}
