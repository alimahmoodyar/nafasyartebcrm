const assert=require('node:assert/strict');
const {execFileSync,spawnSync}=require('node:child_process');
const fs=require('node:fs');
const path=require('node:path');
const os=require('node:os');

const script=path.resolve(__dirname,'../scripts/verify-release.mjs');
const scratch=fs.mkdtempSync(path.join(os.tmpdir(),'hamnafas-release-check-'));
function git(directory,...args){
 return execFileSync('git',['-C',directory,...args],{encoding:'utf8',stdio:['ignore','pipe','pipe']}).trim();
}
function write(directory,file,contents){fs.writeFileSync(path.join(directory,file),contents);}
function commit(directory,title){git(directory,'add','--all');git(directory,'commit','-m',title);}
function checkout(label){
 const directory=path.join(scratch,label);
 fs.mkdirSync(path.join(directory,'lib'),{recursive:true});
 git(directory,'init','-q');
 git(directory,'config','user.name','Release Test');
 git(directory,'config','user.email','qa@example.test');
 write(directory,'lib/release-number.ts','export const releaseNumber = 68;\n');
 write(directory,'profile.tsx',label==='hosted'?'// Hosted baseline\nexport const expanded = true;\n':'export const expanded = true;\n');
 commit(directory,'Previous release');
 return {directory,base:git(directory,'rev-parse','HEAD')};
}
try{
 const source=checkout('source'),hosted=checkout('hosted');
 const verify=()=>spawnSync(process.execPath,[script,'69',source.base,hosted.directory,hosted.base],{cwd:source.directory,encoding:'utf8'});
 for(const entry of [source,hosted]){
  write(entry.directory,'lib/release-number.ts','export const releaseNumber = 69;\n');
  commit(entry.directory,'Bump release');
 }
 write(source.directory,'profile.tsx','export const expanded = false;\n');
 write(source.directory,'new-photo.tsx','export const menu = true;\n');
 let result=verify();
 assert.equal(result.status,1);
 assert.match(result.stderr,/uncommitted files/);
 assert.match(result.stderr,/profile\.tsx/);
 assert.match(result.stderr,/new-photo\.tsx/);
 git(source.directory,'add','profile.tsx');
 result=verify();
 assert.equal(result.status,1);
 assert.match(result.stderr,/M  profile\.tsx/);
 commit(source.directory,'Reviewed profile changes');
 result=verify();
 assert.equal(result.status,1);
 assert.match(result.stderr,/different changes/);
 assert.match(result.stderr,/profile\.tsx/);

 write(hosted.directory,'profile.tsx','// Hosted baseline\nexport const expanded = false;\n');
 write(hosted.directory,'new-photo.tsx','export const menu = true;\n');
 commit(hosted.directory,'Apply same changes to hosted baseline');
 result=verify();
 assert.equal(result.status,0,result.stderr);
 assert.deepEqual(JSON.parse(result.stdout).files,['lib/release-number.ts','new-photo.tsx','profile.tsx']);
 console.log('Release verification passed: catches staged or unstaged omissions and mismatched release contents.');
}finally{fs.rmSync(scratch,{recursive:true,force:true});}
