"""Nafasyar Windows Bridge 0.2.0. Derived from Hesabyar 0.1.0 discovery.
Read-only UI inspection. No clicks, focus changes, keystrokes or posting endpoints.
"""
from http.server import BaseHTTPRequestHandler, HTTPServer
from datetime import datetime, timezone
import base64, hashlib, hmac, io, itertools, json, os, secrets, sys, time

VERSION='0.2.0'
ORIGIN='https://nafasyar-trace.dr-aliebrahimi1368.chatgpt.site'
PORT=8765

class Session:
    def __init__(self):
        self.token=secrets.token_urlsafe(32)
        self.windows={}
        self.created=time.time()
    def check(self):
        if time.time()-self.created>8*3600:
            raise ValueError('Session expired. Stop and start the bridge again.')
    def dispatch(self,path,body):
        self.check()
        if not isinstance(body,dict): raise ValueError('Expected an object.')
        if path=='/health':return {'ok':True,'version':VERSION,'readOnly':True,'canPost':False,'capabilities':['windows','inspect']}
        if path not in ('/windows','/inspect'):raise ValueError('This version only supports reading windows. Operation denied.')
        import psutil
        from pywinauto import Desktop
        backend=body.get('backend','uia')
        if backend not in ('uia','win32'):raise ValueError('Unknown inspection mode.')
        if path=='/windows':
            self.windows.clear();result=[]
            for w in Desktop(backend=backend).windows(visible_only=True):
                try:
                    pid=w.process_id();title=w.window_text()
                    if not title or pid==os.getpid():continue
                    proc=psutil.Process(pid);key=secrets.token_urlsafe(16)
                    self.windows[key]={'handle':w.handle,'pid':pid,'started':proc.create_time(),'exe':proc.exe(),'backend':backend,'time':time.time()}
                    result.append({'id':key,'title':title[:240],'exe':proc.name()})
                    if len(result)>=100:break
                except Exception:continue
            return {'windows':result}
        selected=self.windows.get(body.get('id'))
        if not selected or time.time()-selected['time']>600:raise ValueError('Select the window again. Window list expired.')
        if backend!=selected['backend']:raise ValueError('Inspection mode changed. Select the window again.')
        proc=psutil.Process(selected['pid'])
        if proc.create_time()!=selected['started'] or proc.exe()!=selected['exe']:raise ValueError('Application changed. Select the window again.')
        w=Desktop(backend=backend).window(handle=selected['handle']).wrapper_object()
        if w.process_id()!=selected['pid'] or not w.is_visible():raise ValueError('Window unavailable. Select it again.')
        controls=[];skipped=0;seen=0
        # Limit traversal of the visible UI. This is NOT a complete accounting export.
        pending=[w];truncated=False
        while pending:
            control=pending.pop(0);seen+=1
            if seen>600:truncated=True;break
            try:
                if not control.is_visible():continue
                if backend=='uia' and control.element_info.element.CurrentIsPassword:continue
                if backend=='win32' and control.friendly_class_name()=='Edit' and control.style() & 0x20:continue
                info=control.element_info
                item={'name':(info.name or '')[:500],'automationId':str(getattr(info,'automation_id','') or '')[:200],'type':str(getattr(info,'control_type','') or control.friendly_class_name()),'className':str(info.class_name or '')[:200]}
                try:item['text']=str(control.window_text())[:2000]
                except Exception:item['text']=''
                if item['type']=='Edit':
                    try:item['text']=str(control.get_value())[:2000]
                    except Exception:pass
                controls.append(item)
                children=control.children();capacity=max(0,601-seen-len(pending))
                if len(children)>capacity:truncated=True
                pending.extend(children[:capacity])
            except Exception:skipped+=1
        image=None
        if body.get('screenshot') is True:
            try:
                pic=w.capture_as_image();pic.thumbnail((1600,1000));out=io.BytesIO();pic.save(out,format='PNG');image='data:image/png;base64,'+base64.b64encode(out.getvalue()).decode('ascii')
            except Exception:pass
        return {'version':VERSION,'capturedAt':datetime.now(timezone.utc).isoformat(),'title':w.window_text()[:240],'exe':proc.name(),'backend':backend,'controls':controls,'image':image,'truncated':truncated,'skipped':skipped,'scope':'visible-window-only','readOnly':True}

class BridgeServer(HTTPServer):
    def __init__(self,session):
        self.session=session
        super().__init__(('127.0.0.1',PORT),Handler)
    def get_request(self):
        sock,addr=super().get_request();sock.settimeout(10);return sock,addr

class Handler(BaseHTTPRequestHandler):
    def log_message(self,*args):pass
    def allowed_origin(self):return self.headers.get('Origin')==ORIGIN
    def allowed_host(self):return self.headers.get('Host') in ('127.0.0.1:'+str(PORT),'localhost:'+str(PORT))
    def reply(self,status,value):
        raw=json.dumps(value,ensure_ascii=False).encode('utf-8');self.send_response(status)
        self.send_header('Content-Type','application/json; charset=utf-8');self.send_header('Cache-Control','no-store');self.send_header('X-Content-Type-Options','nosniff')
        if self.allowed_origin():self.send_header('Access-Control-Allow-Origin',ORIGIN);self.send_header('Vary','Origin')
        self.send_header('Content-Length',str(len(raw)));self.end_headers();self.wfile.write(raw)
    def do_OPTIONS(self):
        if not self.allowed_host() or not self.allowed_origin():return self.reply(403,{'error':'Origin or host denied.'})
        self.send_response(204);self.send_header('Access-Control-Allow-Origin',ORIGIN);self.send_header('Access-Control-Allow-Methods','POST, OPTIONS');self.send_header('Access-Control-Allow-Headers','Content-Type, X-Nafasyar-Token');self.send_header('Access-Control-Allow-Private-Network','true');self.send_header('Vary','Origin');self.end_headers()
    def do_POST(self):
        if not self.allowed_host() or not self.allowed_origin():return self.reply(403,{'error':'Origin or host denied.'})
        try:valid=hmac.compare_digest(self.headers.get('X-Nafasyar-Token','').encode(),self.server.session.token.encode())
        except Exception:valid=False
        if not valid:return self.reply(401,{'error':'Invalid connection code.'})
        try:
            size=int(self.headers.get('Content-Length','0'))
            if size<1 or size>16384:raise ValueError('Invalid request size.')
            if self.headers.get('Content-Type','').split(';')[0]!='application/json':raise ValueError('JSON required.')
            self.reply(200,self.server.session.dispatch(self.path,json.loads(self.rfile.read(size))))
        except Exception as exc:self.reply(400,{'error':str(exc)[:300]})
