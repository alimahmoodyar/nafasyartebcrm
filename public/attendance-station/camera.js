  function stopCamera(){
    if(stream)for(const t of stream.getTracks())t.stop();
    stream=null;video.srcObject=null;video.hidden=true;el('guide').hidden=true;el('off').hidden=false;
  }
  function cancel(){job++;busy=false;stopCamera();draw()}
  function discard(){samples=[];el('previews').replaceChildren()}
  function assertCurrent(ticket){if(ticket!==job)throw new DOMException('cancelled','AbortError')}
  async function camera(ticket){
    if(!stream){
      if(!navigator.mediaDevices?.getUserMedia)fail('این صفحه را مستقیماً در Chrome روی همین سیستم باز کنید.');
      const granted=await navigator.mediaDevices.getUserMedia({audio:false,video:{width:{ideal:640},height:{ideal:480},facingMode:{ideal:'user'}}});
      if(ticket!==job){granted.getTracks().forEach(t=>t.stop());assertCurrent(ticket)}
      stream=granted;video.srcObject=stream;video.hidden=false;el('off').hidden=true;el('guide').hidden=false;
      stream.getVideoTracks()[0].onended=()=>{cancel();say('اتصال وب‌کم قطع شد. دوباره تلاش کنید.',true)};
      await video.play();
    }
    for(let i=0;i<90&&video.readyState<2;i++){await pause(50);assertCurrent(ticket)}
    assertCurrent(ticket);if(!video.videoWidth||video.readyState<2)fail('تصویر آماده نیست. دوباره تلاش کنید.');
  }
  function frame(){
    const image=document.createElement('canvas');image.width=Math.min(640,video.videoWidth);image.height=Math.round(image.width*video.videoHeight/video.videoWidth);
    image.getContext('2d').drawImage(video,0,0,image.width,image.height);return image;
  }
  async function describe(canvas){
    const faces=await faceapi.detectAllFaces(canvas,new faceapi.TinyFaceDetectorOptions({inputSize:416,scoreThreshold:.42})).withFaceLandmarks(true).withFaceDescriptors();
    if(!faces.length)fail('چهره پیدا نشد. روبه نور و نزدیک‌تر به دوربین بایست و دوباره بزن.');
    if(faces.length!==1)fail('چند چهره در تصویر است. فقط یک نفر مقابل دوربین بایستد.');
    const f=faces[0];if(f.detection.box.width<canvas.width*.14)fail('کمی به دوربین نزدیک‌تر شو و دوباره امتحان کن.');
    if(f.descriptor.length!==128||!f.descriptor.every(Number.isFinite))fail('کیفیت تصویر برای تشخیص کافی نیست.');
    return Array.from(f.descriptor);
  }
  const distance=(a,b)=>Math.sqrt(a.reduce((sum,x,i)=>sum+(x-b[i])**2,0));
  // Require agreement with at least two enrollment samples and separation from the runner-up.
  const score=(vector,p)=>p.vectors.map(v=>distance(vector,v)).sort((a,b)=>a-b)[1];
  function identify(vector,people){
    const ranked=people.map(p=>({id:p.id,d:score(vector,p)})).sort((a,b)=>a.d-b.d);
    if(!ranked.length||ranked[0].d>.48||(ranked[1]&&ranked[1].d-ranked[0].d<.07))fail('تطبیق مطمئن نبود. ترددی ثبت نشد. روبه دوربین دوباره تلاش کن.');
    return ranked[0].id;
  }
