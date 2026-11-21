import {spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {existsSync,mkdirSync,mkdtempSync,readFileSync,rmSync,writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';

// Pinned official npm distribution, copied into static output at build time.
const version='6.5.438';
const destination=fileURLToPath(new URL('../public/label-pdf/pdfjs-'+version+'/',import.meta.url));
const assets=[
 ['LICENSE','package/LICENSE','0d542e0c8804e39aa7f37eb00da5a762149dc682d7829451287e11b938e94594'],
 ['pdf.min.mjs','package/build/pdf.min.mjs','3a88402882cfa3e7e72c2c9b5149f52f0f88baf1c5b62aa11a41abdbc2072440'],
 ['pdf.worker.min.mjs','package/build/pdf.worker.min.mjs','1e64c8240e54735ec5913b37acd5134747799cb8c6bb3777c70adbc01232d2aa'],
];
const hash=(bytes,algorithm='sha256',encoding='hex')=>createHash(algorithm).update(bytes).digest(encoding);
const ready=assets.every(([file,,checksum])=>{
 const path=join(destination,file);
 return existsSync(path)&&hash(readFileSync(path))===checksum;
});

if(!ready){
 const temporary=mkdtempSync(join(tmpdir(),'nafasyar-pdfjs-'));
 try{
  const archive=join(temporary,'pdfjs.tgz');
  const url='https://registry.npmjs.org/pdfjs-dist/-/pdfjs-dist-'+version+'.tgz';
  const download=spawnSync('curl',['--fail','--silent','--show-error','--retry','3','--retry-all-errors',
   '--max-time','45','--output',archive,url],{stdio:'inherit',windowsHide:true});
  if(download.status!==0)throw Error('Cannot fetch the pinned PDF.js package', {cause:download.error});
  if(hash(readFileSync(archive),'sha512','base64')!=='vg8Pw1x+AFKy4AMDvhuWl5cOYV8d698UoEANoFFhc79hqXDnZQqnOXoxw3HG907WHOg1JYOvLhP756boddFxpA=='){
   throw Error('PDF.js package integrity mismatch');
  }
  mkdirSync(destination,{recursive:true});
  for(const [file,entry,checksum] of assets){
   const extract=spawnSync('tar',['-xOf',archive,entry],{maxBuffer:4000000,windowsHide:true});
   if(extract.status!==0||hash(extract.stdout)!==checksum)throw Error('Cannot verify PDF.js asset '+file);
   writeFileSync(join(destination,file),extract.stdout);
  }
 }finally{rmSync(temporary,{recursive:true,force:true});}
}
