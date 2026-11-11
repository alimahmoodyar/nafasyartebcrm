import {execFileSync} from 'node:child_process';

// Compare every tracked path, file mode and Git blob; no network or credentials.
const [leftRepo,leftRef,rightRepo,rightRef,...extra]=process.argv.slice(2);
if(!leftRepo||!leftRef||!rightRepo||!rightRef||extra.length){
 console.error('Usage: node scripts/compare-source-trees.mjs LEFT_REPO LEFT_REF RIGHT_REPO RIGHT_REF');
 process.exit(2);
}
function git(repo,args){return execFileSync('git',['-C',repo,...args],{encoding:'utf8',maxBuffer:32*1024*1024});}
function read(repo,ref){
 const commit=git(repo,['rev-parse','--verify',ref+'^{commit}']).trim();
 const tree=git(repo,['rev-parse',commit+'^{tree}']).trim();
 const files=new Map(git(repo,['ls-tree','-rz','--full-tree',commit]).split('\0').filter(Boolean).map(entry=>{
  const tab=entry.indexOf('\t');return [entry.slice(tab+1),entry.slice(0,tab)];
 }));
 return {commit,tree,files};
}
try{
 const left=read(leftRepo,leftRef),right=read(rightRepo,rightRef);
 const paths=[...new Set([...left.files.keys(),...right.files.keys()])].sort();
 const differences=paths.filter(file=>left.files.get(file)!==right.files.get(file)).map(file=>({
  file,status:!left.files.has(file)?'right-only':!right.files.has(file)?'left-only':'changed',
  left:left.files.get(file)||null,right:right.files.get(file)||null,
 }));
 const equal=differences.length===0&&left.tree===right.tree;
 console.log(JSON.stringify({equal,comparedFiles:paths.length,left:{commit:left.commit,tree:left.tree,files:left.files.size},right:{commit:right.commit,tree:right.tree,files:right.files.size},differences},null,2));
 process.exitCode=equal?0:1;
}catch(error){console.error(error.message);process.exitCode=2;}
