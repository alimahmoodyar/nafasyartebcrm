import {build} from 'vite';
import {mkdirSync,copyFileSync,readFileSync,writeFileSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../',import.meta.url));
const out=path.resolve(process.argv[2]);
const result=await build({root,configFile:false,define:{"process.env.NODE_ENV":JSON.stringify("production")},resolve:{alias:{'@':root}},oxc:{jsx:{runtime:'automatic'}},build:{write:false,minify:true,lib:{entry:path.join(root,'survey-site/public-survey.tsx'),name:'HospitalSurvey',formats:['iife']}}});
const script=(Array.isArray(result)?result[0]:result).output.find(item=>item.type==='chunk').code;
mkdirSync(path.join(out,'worker'),{recursive:true});
const workerSource=readFileSync(path.join(root,'survey-site/worker.js'),'utf8');
const worker=await build({root,configFile:false,resolve:{alias:{'@':root}},plugins:[{
 name:'hospital-survey-browser-source',
 resolveId(id){if(id==='./browser-source.js')return '\0hospital-survey-browser-source';},
 load(id){if(id==='\0hospital-survey-browser-source')return 'export default '+JSON.stringify(script)+';';},
}],build:{write:false,minify:true,lib:{entry:path.join(root,'survey-site/worker.js'),formats:['es']}}});
if(!workerSource.includes("import browserScript"))throw Error('Browser asset import missing');
const workerCode=(Array.isArray(worker)?worker[0]:worker).output.find(item=>item.type==='chunk').code;
writeFileSync(path.join(out,'worker/index.js'),workerCode);
mkdirSync(path.join(out,'drizzle'),{recursive:true});
copyFileSync(path.join(root,'survey-site/migration.sql'),path.join(out,'drizzle/0000_survey.sql'));
