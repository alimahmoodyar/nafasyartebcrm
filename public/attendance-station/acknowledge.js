// Cache only the audio chosen for this station's company, keyed by installation.
let audioContext,source,refreshing;
function prepare(){
 audioContext||=new AudioContext();
 if(audioContext.state!=='running')audioContext.resume().catch(()=>{});
}
function stop(){
 if(source){const previous=source;source=null;previous.onended=null;try{previous.stop()}catch{}previous.disconnect();}
}
const soundKey=(stationId,direction)=>'sound:'+stationId+':'+direction;
async function refreshDirection(installation,direction){
 const key=soundKey(installation.station.id,direction),old=await read('station',key);
 const headers={Authorization:'Bearer '+installation.token};
 if(old?.etag)headers['If-None-Match']=old.etag;
 const response=await fetch('/api/personnel/stations/audio/sound?kind='+direction,{headers,credentials:'omit',cache:'no-store'});
 if(response.status===304)return;
 if(response.status===204){
  if(old)await transaction(['station'],'readwrite',tx=>tx.objectStore('station').delete(key));
  return;
 }
 if(response.status!==200)throw new Error('دریافت فایل صدا ممکن نشد.');
 const etag=response.headers.get('etag'),blob=await response.blob();
 if(!blob.size||!blob.type.toLowerCase().startsWith('audio/'))throw new Error('فایل صدا معتبر نیست.');
 await transaction(['station'],'readwrite',tx=>tx.objectStore('station').put({etag,blob},key));
}
async function refresh(installation){
 if(refreshing)return refreshing;
 refreshing=Promise.allSettled(['in','out'].map(direction=>refreshDirection(installation,direction))).finally(()=>{refreshing=null});
 return refreshing;
}
async function announce(stationId,direction){
 const cached=await read('station',soundKey(stationId,direction));
 if(!cached||document.hidden)return;
 if(!audioContext||audioContext.state!=='running')throw new Error('پخش صدا در دسترس نیست.');
 const buffer=await audioContext.decodeAudioData(await cached.blob.arrayBuffer());
 if(document.hidden)return;stop();const player=audioContext.createBufferSource();
 player.buffer=buffer;player.connect(audioContext.destination);source=player;
 player.onended=()=>{player.disconnect();if(source===player)source=null;};
 player.start();
}
window.stationVoice={prepare,stop,announce,refresh};
