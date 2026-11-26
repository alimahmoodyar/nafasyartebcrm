import {execFileSync} from 'node:child_process';

const [version,sourceBase,hostedRepo,hostedBase,...extra]=process.argv.slice(2);
if(!/^\d+$/.test(version??'')||!sourceBase||!hostedRepo||!hostedBase||extra.length){
 console.error('Usage: node scripts/verify-release.mjs VERSION GITHUB_BASE HOSTED_CHECKOUT HOSTED_BASE');
 process.exit(2);
}

function git(repo,args){
 return execFileSync('git',['-C',repo,...args],{encoding:'utf8',maxBuffer:32*1024*1024});
}

function readRelease(repo,base){
 const pending=git(repo,['status','--porcelain=v1','--untracked-files=all']).trimEnd();
 if(pending)throw new Error('Release checkout contains uncommitted files ('+repo+'):\n'+pending);
 const head=git(repo,['rev-parse','HEAD']).trim();
 const baseline=git(repo,['rev-parse','--verify',base+'^{commit}']).trim();
 if(git(repo,['merge-base',baseline,head]).trim()!==baseline)throw new Error('Release base is not an ancestor of '+head);
 const displayed=git(repo,['show',head+':lib/release-number.ts']).match(/\breleaseNumber\s*=\s*(\d+)\b/)?.[1];
 if(displayed!==version)throw new Error('Expected release '+version+' in '+repo+', found '+(displayed??'no number'));
 const paths=git(repo,['diff','--no-renames','--name-only','-z',baseline,head]).split('\0').filter(Boolean);
 if(!paths.length)throw new Error('No release changes in '+repo);
 return {head,baseline,paths};
}

function changes(repo,release,file){
 return git(repo,['diff','--no-ext-diff','--no-textconv','--no-renames','--binary','--unified=0',release.baseline,release.head,'--',file])
  .split('\n').filter(line=>!line.startsWith('index ')&&!line.startsWith('@@ ')).join('\n');
}

try{
 const source=readRelease('.',sourceBase),hosted=readRelease(hostedRepo,hostedBase);
 const files=[...new Set([...source.paths,...hosted.paths])].sort();
 const unequal=files.filter(file=>changes('.',source,file)!==changes(hostedRepo,hosted,file));
 if(unequal.length)throw new Error('GitHub and hosted releases contain different changes:\n'+unequal.join('\n'));
 console.log(JSON.stringify({version,githubCommit:source.head,hostedCommit:hosted.head,files},null,2));
}catch(error){
 console.error(error.message);
 process.exitCode=1;
}
