import {mkdirSync,copyFileSync,readFileSync} from 'node:fs';
const manifest=JSON.parse(readFileSync('.openai/hosting.json','utf8'));
if(!manifest.project_id||manifest.d1||manifest.r2)throw Error('Cargo gateway must not own company storage');
mkdirSync('dist/server',{recursive:true});mkdirSync('dist/.openai',{recursive:true});
copyFileSync('worker/index.js','dist/server/index.js');copyFileSync('.openai/hosting.json','dist/.openai/hosting.json');
console.log('Cargo gateway built; no database or financial routes.');
