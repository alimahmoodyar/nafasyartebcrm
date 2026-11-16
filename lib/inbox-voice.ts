import {AccessError} from './authorization';
export const inboxVoiceLimit=20*1024*1024;
export function validateInboxVoice(filename:string,bytes:Uint8Array){
 if(!filename||filename.length>240||/[\x00-\x1f]/.test(filename)||!bytes.length||bytes.length>inboxVoiceLimit)throw new AccessError('پیام صوتی غیرخالی و حداکثر ۲۰ مگابایت لازم است.',400);
 const head=new TextDecoder('latin1').decode(bytes.slice(0,65536)),tail=new TextDecoder('latin1').decode(bytes.slice(-65536)),ext=filename.split('.').at(-1)?.toLowerCase();
 if(ext==='webm'&&bytes[0]===0x1a&&bytes[1]===0x45&&bytes[2]===0xdf&&bytes[3]===0xa3&&head.includes('webm')&&head.includes('A_OPUS')&&!head.includes('V_VP'))return 'audio/webm';
 if(ext==='ogg'&&head.startsWith('OggS')&&(head.includes('OpusHead')||head.includes('vorbis')))return 'audio/ogg';
 if(['m4a','mp4'].includes(ext||'')&&head.slice(4,8)==='ftyp'&&(head.includes('mp4a')||tail.includes('mp4a')))return 'audio/mp4';
 throw new AccessError('صدای معتبر WebM/Opus، Ogg یا M4A انتخاب کنید.',400);
}
