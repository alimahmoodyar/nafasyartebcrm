import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {gzipSync} from 'node:zlib';
import {execFileSync} from 'node:child_process';
import PizZip from 'pizzip';

// Ship the verified model with the station. No runtime connection to the provider.
const base=fileURLToPath(new URL('../public/attendance-station/speech/',import.meta.url));
const checksum='977cb5faa538f3a835ccfd35f5f6d8284b5c450b89c700b9bd4736b66536ad46';
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const engines=[
 [
  "models/face_landmark_68_tiny_model-shard1",
  "https://raw.githubusercontent.com/justadudewhohacks/face-api.js/a86f011d72124e5fb93e59d5c4ab98f699dd5c9c/weights/face_landmark_68_tiny_model-shard1",
  "b98e9f2f7da76f8a6dda9741a36ed485b224b889d552de2b2c1bb16217f67bfc"
 ],
 [
  "models/face_recognition_model-shard1",
  "https://raw.githubusercontent.com/justadudewhohacks/face-api.js/a86f011d72124e5fb93e59d5c4ab98f699dd5c9c/weights/face_recognition_model-shard1",
  "412566a2b8d814d84c60b8055ec5d3b3b2328ef7cd7853384e03ec3db7b053d8"
 ],
 [
  "models/face_recognition_model-shard2",
  "https://raw.githubusercontent.com/justadudewhohacks/face-api.js/a86f011d72124e5fb93e59d5c4ab98f699dd5c9c/weights/face_recognition_model-shard2",
  "69350fdecd845c532e44dd8f7d0521c773505ef46b87cc34f46640a0cc334ecc"
 ],
 [
  "models/tiny_face_detector_model-shard1",
  "https://raw.githubusercontent.com/justadudewhohacks/face-api.js/a86f011d72124e5fb93e59d5c4ab98f699dd5c9c/weights/tiny_face_detector_model-shard1",
  "b7503ce7df31039b1c43316a9b865cab6a70dd748cc602d3fa28b551503c3871"
 ],
 [
  "face-api.min.js",
  "https://raw.githubusercontent.com/justadudewhohacks/face-api.js/a86f011d72124e5fb93e59d5c4ab98f699dd5c9c/dist/face-api.min.js",
  "5d66ec95338d7fcc365ce15481b8599baf4b6e22c9a624b76d4ca821a669a659"
 ],
 [
  "speech/vosk.js",
  "https://cdn.jsdelivr.net/npm/vosk-browser@0.0.8/dist/vosk.js",
  "29504515526e974f4cb053cf08811c4de5fb2a74007c0a5a957db50eaa8d5d0c"
 ]
];
for(const [file,url,checksum] of engines){
 const target=path.resolve(base,'..',file);
 if(fs.existsSync(target)&&hash(fs.readFileSync(target))===checksum)continue;
 const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'attendance-engine-'));
 try{
  const artifact=path.join(tmp,'asset');
  execFileSync('curl',['-fsSL','--retry','3','--max-time','180','-o',artifact,url],{windowsHide:true});
  if(hash(fs.readFileSync(artifact))!==checksum)throw Error('Attendance asset checksum mismatch: '+file);
  fs.mkdirSync(path.dirname(target),{recursive:true});fs.copyFileSync(artifact,target);
 }finally{fs.rmSync(tmp,{recursive:true,force:true})}
}
const parts=Array.from({length:3},(_,i)=>path.join(base,'fa-0.42.'+i+'.bin'));
const stamp=path.join(base,'.model-checksums-v2');
const existing=fs.existsSync(stamp)?fs.readFileSync(stamp,'utf8').trim().split('\n'):[];
if(!parts.every((file,i)=>fs.existsSync(file)&&hash(fs.readFileSync(file))===existing[i])){
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'attendance-speech-'));
 try{
  const archive=process.env.ATTENDANCE_FA_MODEL_ZIP||path.join(dir,'model.zip');
  if(!process.env.ATTENDANCE_FA_MODEL_ZIP)execFileSync('curl',['-fsSL','--retry','3','--max-time','180','-o',archive,'https://alphacephei.com/vosk/models/vosk-model-small-fa-0.42.zip'],{windowsHide:true});
  const bytes=fs.readFileSync(archive);if(hash(bytes)!==checksum)throw Error('Persian speech model checksum mismatch');
  const zip=new PizZip(bytes),blocks=[];
  // Standard USTAR, fixed timestamps so builds are reproducible.
  for(const file of Object.values(zip.files).sort((a,b)=>a.name<b.name?-1:1)){
   const name=file.name.replace(/^vosk-model-small-fa-0\.42\//,'model/');
   if(name!=='model/'&&!/^model\/(am|graph|conf|ivector)\//.test(name))continue;
   const payload=file.dir?Buffer.alloc(0):file.asNodeBuffer(),header=Buffer.alloc(512);
   header.write(name,0,100);header.write(file.dir?'0000755\0':'0000644\0',100);header.write('0000000\0',108);header.write('0000000\0',116);
   header.write(payload.length.toString(8).padStart(11,'0')+'\0',124);header.write('00000000000\0',136);
   header.fill(32,148,156);header.write(file.dir?'5':'0',156);header.write('ustar\0',257);header.write('00',263);
   header.write(header.reduce((sum,n)=>sum+n,0).toString(8).padStart(6,'0')+'\0 ',148);
   blocks.push(header,payload,Buffer.alloc((512-payload.length%512)%512));
  }
  blocks.push(Buffer.alloc(1024));const packed=gzipSync(Buffer.concat(blocks),{level:6}),chunk=20*1024*1024;
  if(Math.ceil(packed.length/chunk)!==parts.length)throw Error('Unexpected speech asset count');
  const checks=parts.map((file,i)=>{const piece=packed.subarray(i*chunk,(i+1)*chunk);fs.writeFileSync(file,piece);return hash(piece)});
  fs.writeFileSync(stamp,checks.join('\n'));
 }finally{fs.rmSync(dir,{force:true,recursive:true})}
}

