(() => {
  const sender=window.opener;
  if(!sender)return;
  function receive(event){
    if(event.origin!==document.body.dataset.sender || event.source!==sender || event.data?.type!=='hamnafas.receipt' || typeof event.data.text!=='string' || !event.data.text.trim() || event.data.text.length>100000)return;
    window.removeEventListener('message',receive);
    window.opener=null;
    document.querySelector('#receipt').textContent=event.data.text+'\n\nاینجانب دریافت مواد فوق به امانت را تأیید می‌کنم.\nنام و سمت: ……………    تاریخ: ……………    امضا و مهر: ……………';
    document.querySelector('button').hidden=false;
  }
  window.addEventListener('message',receive);
  // The ready event contains no data. The receipt travels only to the company origin.
  sender.postMessage({type:'hamnafas.receipt.ready'},document.body.dataset.sender);
})();
