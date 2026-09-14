import {asciiDigits} from './batch-number';
export const MAX_HEX_BYTES=10*1024*1024;
export const MAX_UPLOAD_BYTES=MAX_HEX_BYTES+64*1024;
export function normalizeFirmware(input:unknown):Record<string,string>{
 if(!input||typeof input!=='object'||Array.isArray(input))throw new Error('مشخصات نسخه معتبر نیست.');
 const source=input as Record<string,unknown>,result:Record<string,string>={};
 for(const key of ['name','version','deviceModel','board','notes']){
  const value=source[key]??'';if(typeof value!=='string')throw new Error('مشخصات نسخه باید متن باشد.');
  result[key]=value.trim();if(result[key].length>(key==='notes'?4000:160))throw new Error('متن واردشده بیش از حد طولانی است.');
 }
 if(!result.name||!result.version)throw new Error('نام نرم‌افزار و شماره نسخه الزامی است.');
 result.version=asciiDigits(result.version);return result;
}
export function firmwareIdentity(data:Record<string,string>){return JSON.stringify(['name','version','deviceModel','board'].map(key=>asciiDigits(data[key]||'').normalize('NFKC').replace(/ي/g,'ی').replace(/ك/g,'ک').replace(/\s+/g,' ').trim().toLowerCase()));}
export async function sha256(bytes:BufferSource){return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))).map(b=>b.toString(16).padStart(2,'0')).join('');}

// Container integrity only; not certification, hardware compatibility or safe firmware.
export function validateIntelHex(bytes:Uint8Array,filename:string){
 if(!/\.hex$/i.test(filename)||filename.length>180||/[\x00-\x1f\x7f/\\]/.test(filename))throw new Error('نام فایل معتبر نیست؛ فایل با پسوند .hex انتخاب کنید.');
 if(!bytes.length||bytes.length>MAX_HEX_BYTES)throw new Error('فایل HEX باید غیرخالی و حداکثر ۱۰ مگابایت باشد.');
 let text:string;try{text=new TextDecoder('utf-8',{fatal:true}).decode(bytes);}catch{throw new Error('فایل باید متنی و با قالب Intel HEX باشد.');}
 let eof=false,dataBytes=0,lineNumber=0;
 for(const match of text.matchAll(/([^\r\n]*)(?:\r\n|\n|\r|$)/g)){
  const raw=match[1];
  lineNumber++;const line=raw.trim();if(!line)continue;
  const fail=()=>{throw new Error('ساختار یا checksum فایل HEX در خط '+lineNumber+' معتبر نیست.');};
  if(eof||!/^:[0-9a-fA-F]+$/.test(line)||line.length<11||line.length>521||(line.length-1)%2)fail();
  const parts:number[]=[];for(let i=1;i<line.length;i+=2)parts.push(parseInt(line.slice(i,i+2),16));
  const [length,high,low,type]=parts;
  if(parts.length!==length+5||(parts.reduce((a,b)=>a+b,0)&255)!==0||type>5)fail();
  if(type===0)dataBytes+=length;
  else {const expected=type===1?0:type===2||type===4?2:4;if(length!==expected||high!==0||low!==0)fail();if(type===1)eof=true;}
 }
 if(!eof||!dataBytes)throw new Error('فایل HEX باید داده و رکورد پایان فایل داشته باشد.');
 return {dataBytes};
}
