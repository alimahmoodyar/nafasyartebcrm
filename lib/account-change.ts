export function notifyAccountChange(){if(typeof BroadcastChannel!=='undefined'){const c=new BroadcastChannel('nafasyar-account');c.postMessage('changed');c.close();}}
