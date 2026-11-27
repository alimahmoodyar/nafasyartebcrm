// Browser integration test with two supplied public sample portraits, in a fresh Chrome profile.
const fs=require('node:fs'), os=require('node:os'),path=require('node:path');
const {spawn}=require('node:child_process'),{pathToFileURL}=require('node:url');
const pause=ms=>new Promise(r=>setTimeout(r,ms));
const profile=fs.mkdtempSync(path.join(os.tmpdir(),'hn-face-qa-'));
const root=path.resolve(process.argv[2]),sent=new Map();let deny=false,failSync=true,links=0;let base,audioVersion=1;const audioRequests=[];
function wav(frequency){
 const n=16000,buf=Buffer.alloc(44+n*2);
 buf.write('RIFF');buf.writeUInt32LE(buf.length-8,4);buf.write('WAVEfmt ',8);buf.writeUInt32LE(16,16);
 buf.writeUInt16LE(1,20);buf.writeUInt16LE(1,22);buf.writeUInt32LE(8000,24);buf.writeUInt32LE(16000,28);buf.writeUInt16LE(2,32);buf.writeUInt16LE(16,34);buf.write('data',36);buf.writeUInt32LE(n*2,40);
 for(let i=0;i<n;i++)buf.writeInt16LE(Math.round(2000*Math.sin(2*Math.PI*frequency*i/8000)),44+2*i);return buf;
}
const server=require('node:http').createServer(async(req,res)=>{
 const url=new URL(req.url,'http://localhost'),route=url.pathname;
 if(route.startsWith('/api/personnel/stations/')){
  let raw='';for await(const chunk of req)raw+=chunk;const body=raw?JSON.parse(raw):{};res.setHeader('Content-Type','application/json');
  if(route.endsWith('/audio/sound')){
   if(req.headers.authorization!=='Bearer station-test'){res.statusCode=401;return res.end('{}')}
   if(url.searchParams.get('kind')==='out'||!audioVersion){res.statusCode=204;return res.end()}
   const etag='"voice-'+audioVersion+'"';audioRequests.push({etag,request:req.headers['if-none-match']||''});
   res.setHeader('ETag',etag);if(req.headers['if-none-match']===etag){res.statusCode=304;return res.end()}
   res.setHeader('Content-Type','audio/wav');return res.end(wav(200+audioVersion*100));
  }
  if(route.endsWith('/link')){links++;return res.end(JSON.stringify({token:'station-test',station:{id:'s1',name:'ایستگاه یک',location:'کارخانه',mode:'both'}}))}
  if(route.endsWith('/roster')){if(deny){res.statusCode=403;return res.end('{}')}if(req.method==='POST')return res.end(JSON.stringify({enrolled:body.memberId==='Alice'}));return res.end(JSON.stringify(url.searchParams.has('after')?{people:[{id:'Alice',name:'Sample A'}],next:null}:{people:[{id:'Bob',name:'Sample B'}],next:'n'}))}
  if(failSync){res.statusCode=503;return res.end('{}')}
  if(req.headers.authorization!=='Bearer station-test')throw Error('bearer');sent.set(body.id,body);return res.end(JSON.stringify({saved:true,id:body.id}));
 }
 const f=path.join(root,decodeURIComponent(route));if(!fs.existsSync(f)||!fs.statSync(f).isFile()){res.statusCode=404;return res.end('missing')}
 res.setHeader('Content-Type',({'.js':'application/javascript','.html':'text/html','.css':'text/css','.json':'application/json','.webmanifest':'application/manifest+json','.png':'image/png'})[path.extname(f)]||'application/octet-stream');fs.createReadStream(f).pipe(res);
});
const chrome=spawn('C:/Program Files/Google/Chrome/Application/chrome.exe',['--headless','--disable-background-networking','--disable-gpu','--remote-debugging-port=0','--user-data-dir='+profile,'about:blank'],{stdio:'ignore',windowsHide:true});
let ws;
(async()=>{
 await new Promise(r=>server.listen(0,'127.0.0.1',r));base='http://127.0.0.1:'+server.address().port;
 const file=path.join(profile,'DevToolsActivePort');
 for(let i=0;i<150&&!fs.existsSync(file);i++)await pause(80);
 const port=fs.readFileSync(file,'utf8').split('\n')[0],tabs=await(await fetch('http://127.0.0.1:'+port+'/json')).json();
 ws=new WebSocket(tabs.find(t=>t.type==='page').webSocketDebuggerUrl);await new Promise(r=>ws.onopen=r);
 let n=0;const calls=new Map();
 ws.onmessage=e=>{const m=JSON.parse(e.data);if(m.id){calls.get(m.id)?.(m);calls.delete(m.id)}};
 const cmd=(method,params)=>new Promise(r=>{calls.set(++n,r);ws.send(JSON.stringify({id:n,method,params}))});
 const ev=async expression=>{const m=await cmd('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true,userGesture:true});if(m.result.exceptionDetails)throw Error(m.result.exceptionDetails.exception?.description||m.result.exceptionDetails.text);return m.result.result.value};
 const wait=async q=>{for(let i=0;i<150;i++){if(await ev(q))return;await pause(200)}throw Error(q+' : '+await ev("document.querySelector('#message')?.textContent"))};
 await cmd('Page.navigate',{url:base+'/attendance-station/index.html#ticket=setup'});
 await wait("document.querySelector('#message')?.textContent.includes('آماده ثبت')");
 const setup="window.id=n=>document.getElementById(n);window.c=document.createElement('canvas');c.width=640;c.height=480;window.ctx=c.getContext('2d');navigator.mediaDevices.getUserMedia=async()=>{const s=c.captureStream(10);const track=s.getVideoTracks()[0];window.pulse=setInterval(()=>{if(track.readyState==='ended')clearInterval(window.pulse);else ctx.fillRect(0,0,1,1)},90);return s};";
 await ev(setup);
 await ev(`window.played=[]; const originalStart=AudioBufferSourceNode.prototype.start;
 AudioBufferSourceNode.prototype.start=function(...args){if(this.buffer)played.push({seconds:this.buffer.duration,audible:this.buffer.getChannelData(0).some(x=>Math.abs(x)>.02)});return originalStart.apply(this,args)};`);
 const [one,two]=process.argv.slice(3).map(f=>fs.readFileSync(f).toString('base64'));
 const loadImg=async(data,type,crop)=>{await ev("(async()=>{const im=new Image();im.src='data:image/"+type+";base64,"+data+"';await im.decode();ctx.fillStyle='#333';ctx.fillRect(0,0,640,480);ctx.drawImage(im,"+crop+",70,0,500,480)})()")};
 const enroll=async name=>{
   await ev("id('enroll-tab').click()");await wait("!id('enroll').hidden");
   await ev("id('name').value="+JSON.stringify(name)+";id('name').dispatchEvent(new Event('change'));id('consent').click();id('capture').click()");
   await wait("!id('capture').disabled&&id('live').videoWidth>0");
   for(let i=1;i<=3;i++){await ev("id('capture').click()");await wait("id('previews').children.length==="+i+"&&!id('capture').disabled")}
   await ev("id('capture').click()");await wait("!id('station').hidden");
 };
 const punch=async dir=>{await ev("id('"+dir+"').click()");await wait("!id('in').disabled")};

 const check=(ok,reason)=>{if(!ok)throw Error(reason);console.log('PASS '+reason)};
 check(await ev("!location.hash")&&links===1,'single-use ticket removed from address');
 await loadImg(one,'png','95,8,275,265');await enroll('Alice');await punch('in');
 check(await ev("queueCount()")===1,'recognized roster employee, local pending event');
 await wait("played.length===1");check(await ev("played[0].audible"),'selected recorded audio played after durable punch');
 await ev("stationVoice.refresh(installation)");check(audioRequests.some(r=>r.request===r.etag),'unchanged pushed recording reused through 304');
 await ev("stationVoice.announce('s1','out')");check(await ev("played.length===1"),'no fallback sound when direction has no recording');
 audioVersion=2;await ev("stationVoice.refresh(installation)");check(await ev("read('station','sound:s1:in').then(x=>x.etag)")==='"voice-2"','replacement written to local cache');
 await punch('in');check(await ev("queueCount()")===1,'duplicate nearby detection suppressed');
 await loadImg(two,'jpeg','0,0,512,550');await punch('out');
 check(await ev("queueCount()")===1&&await ev("id('message').classList.contains('error')"),'unregistered person rejected');
 await wait("document.getElementById('offline').textContent.includes('آماده است')&&!!navigator.serviceWorker.controller");
 check(await ev("(async()=>{const r=await fetch('./speech/fa-0.42.tar.gz');return (await r.blob()).size>50000000})()"),'full local bundled wake model available');
 await cmd('Network.enable',{});
 await cmd('Network.emulateNetworkConditions',{offline:true,latency:0,downloadThroughput:0,uploadThroughput:0});
 await cmd('Page.reload',{});await wait("document.querySelector('#message')?.textContent.includes('آماده ثبت')");
 check(await ev("queueCount()")===1&&links===1,'relaunch preserved connection and queue');
 await ev("window.offlinePlays=0;const originalPlay=AudioBufferSourceNode.prototype.start;AudioBufferSourceNode.prototype.start=function(...args){if(this.buffer)offlinePlays++;return originalPlay.apply(this,args)};stationVoice.prepare();stationVoice.announce('s1','in')");
 check(await ev('offlinePlays')===1,'cached recorded sound plays offline after cold relaunch');
 check(await ev("!navigator.onLine"),'cold offline reopening of the installed shell and recognition models');
 await cmd('Network.emulateNetworkConditions',{offline:false,latency:0,downloadThroughput:-1,uploadThroughput:-1});
 audioVersion=0;await ev("stationVoice.refresh(installation)");await ev("stationVoice.refresh(installation)");check(await ev("read('station','sound:s1:in')")==null,'deleted recording removed locally on reconnect');
 await ev("stationVoice.announce('s1','in')");check(await ev("offlinePlays")===1,'visual-only confirmation after removal');
 deny=true;await ev("document.getElementById('enroll-tab').click()");await wait("document.getElementById('message').classList.contains('error')");check(await ev("document.getElementById('enroll').hidden"),'HR gate blocks enrollment');
 failSync=false;await ev('syncQueue()');check(sent.size===1&&await ev('queueCount()')===0,'queued event acknowledged after reconnect');
 check([...sent.values()][0].memberId==='Alice'&&[...sent.values()][0].direction==='in','correct personnel ID and direction');
 await ev('syncQueue()');check(sent.size===1,'retry does not duplicate');
})().catch(e=>{console.error(e.stack);process.exitCode=1}).finally(()=>{ws?.close();chrome.kill();server.closeAllConnections();server.close()});
