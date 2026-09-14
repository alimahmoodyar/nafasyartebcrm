import os,json,tempfile,subprocess,time,urllib.request,urllib.error,urllib.parse,http.cookiejar,pathlib,uuid,concurrent.futures,sqlite3
ROOT=pathlib.Path(__file__).resolve().parents[1]; BACK=ROOT/'backend'; DOTNET=os.environ.get('DOTNET','dotnet'); PORT=15873; URL=f'http://localhost:{PORT}'; TMP=tempfile.TemporaryDirectory(); env={**os.environ,'DATA_DIR':TMP.name,'PUBLIC_ORIGIN':URL}; process=None; checks=0
class NoRedirect(urllib.request.HTTPRedirectHandler):
 def redirect_request(self,*args):return None
class Client:
 def __init__(self):self.jar=http.cookiejar.CookieJar();self.opener=urllib.request.build_opener(urllib.request.HTTPCookieProcessor(self.jar),NoRedirect())
 def req(self,path,body=None,form=False,method=None,status=200,raw=None,ctype=None):
  global checks
  data=raw if raw is not None else (urllib.parse.urlencode(body,doseq=True).encode() if form else json.dumps(body,ensure_ascii=False).encode()) if body is not None else None
  h={'Origin':URL};
  if data is not None:h['Content-Type']=ctype or ('application/x-www-form-urlencoded' if form else 'application/json')
  req=urllib.request.Request(URL+path,data=data,headers=h,method=method)
  try:r=self.opener.open(req)
  except urllib.error.HTTPError as e:r=e
  text=r.read().decode();assert r.code==status,(path,r.code,status,text[:600]);checks+=1
  try:return json.loads(text)
  except:return text
 def login(self,u,p,status=302):return self.req('/login',{'login':u,'password':p},True,status=status)
 def change(self,u,p,n):return self.req('/account/change',{'username':u,'currentPassword':p,'password':n,'confirmPassword':n},True,status=302)
def start():
 global process
 process=subprocess.Popen([DOTNET,str(BACK/'bin/Release/net8.0/Nafasyar.Api.dll'),'--urls',URL],cwd=BACK,env=env,stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
 for _ in range(100):
  try:urllib.request.urlopen(URL+'/login');return
  except:time.sleep(.1)
 raise Exception('Server did not start')
def stop():
 if process:process.terminate();process.wait(timeout=10)
try:
 start(); a=Client(); seed=json.loads((BACK/'bootstrap-admin.json').read_text()); a.req('/api/session',status=401);a.login(seed['username'],seed['password']);a.req('/api/session',status=403);a.req('/account');a.req('/account/create',{},True,status=403)
 a.change('owner',seed['password'],'Owner-testing-2026!');a.req('/api/session',status=401);a.login('admin',seed['password'],401);a.login('owner','Owner-testing-2026!');assert a.req('/api/session')['isAdmin'];a.req('/');a.req('/brand/nafasyar-logo.png',status=200) if False else None
 staff={'email':'staff@example.com','name':'همکار تولید','unit':'تولید','username':'staff','password':'Staff-first-2026!','read':['product','device'],'write':[]}
 a.req('/account/create',staff,True,status=302);a.req('/account/create',{**staff,'email':'other@example.com'},True,status=409)
 s=Client();s.login('staff',staff['password']);s.req('/api/records',status=403);s.change('staff',staff['password'],'Staff-second-2026!');s.login('staff','Staff-second-2026!');assert not s.req('/api/session')['isAdmin'];s.req('/api/users',status=403);s.req('/account/create',staff,True,status=403);s.req('/account/reset',staff,True,status=403)
 s.req('/account/change',{'username':'staff','currentPassword':'Wrong-password!','password':'New-password-2026!','confirmPassword':'New-password-2026!'},True,status=403)
 def record(k,d,c=a,status=201):return c.req('/api/records',{'kind':k,'data':d},status=status)
 product=record('product',{'code':'OX','name':'اکسیژن','group':'تنفسی','model':'M1','warrantyMonths':'24','status':'فعال'})['record'];record('product',product['data'],s,403);record('product',product['data'],status=409)
 request={'requestId':str(uuid.uuid4()),'productId':product['id'],'count':3};run=a.req('/api/serials',request);assert a.req('/api/serials',request)['replayed'];detail=a.req('/api/serials?id='+request['requestId']);assert len(detail['serials'])==3;a.req('/api/serials/print?id='+request['requestId']);
 with concurrent.futures.ThreadPoolExecutor(2) as pool:list(pool.map(lambda _:a.req('/api/serials',{**request,'requestId':str(uuid.uuid4())}),range(2)))
 device=record('device',{'code':detail['serials'][0]['serial'],'product':product['id'],'design':'1','date':'2026-09-14'})['record'];assert device['data']['model']=='M1'
 batch=record('batch',{'code':'B1','part':'قطعه','supplier':'تامین','date':'2026-09-14','quantity':'10','unit':'عدد','status':'قرنطینه'})['record'];event={'device':device['id'],'stage':'مصرف قطعه','date':'2026-09-14','operator':'آزمون','batch':batch['id'],'quantity':'1'};record('event',event,status=400)
 updated={**batch['data'],'status':'تأیید'};a.req('/api/records',{'id':batch['id'],'previous':json.dumps(batch['data'],ensure_ascii=False),'data':updated},method='PATCH');a.req('/api/records',{'id':batch['id'],'previous':json.dumps(batch['data']),'data':updated},method='PATCH',status=409);record('event',event)
 assert all(x['kind'] in ['product','device'] for x in s.req('/api/records')['records'])
 distribution={'serial':device['data']['code'],'dealerName':'نماینده','customerName':'مشتری'};payload={'mode':'preview','rows':[{'row':2,'data':distribution}]};assert a.req('/api/distribution',payload)['preview'][0]['status']=='new';a.req('/api/distribution',{**payload,'mode':'import'});assert a.req('/api/distribution',{**payload,'mode':'preview'})['preview'][0]['status']=='same';assert a.req('/api/distribution?device='+urllib.parse.quote(device['id']))['warrantyActivatedAt'] is None
 fw=a.req('/api/firmware',{'name':'کنترل','version':'1','board':'A'},status=201)['record'];a.req('/api/firmware',{'name':'کنترل','version':'1','board':'A'},status=409)
 hexdata=':0100000001FE\n:00000001FF\n';boundary='BOUNDARY123';raw=(f'--{boundary}\r\nContent-Disposition: form-data; name="file"; filename="test.hex"\r\nContent-Type: application/octet-stream\r\n\r\n'+hexdata+f'\r\n--{boundary}--\r\n').encode();path='/api/firmware/files?version='+urllib.parse.quote(fw['id']);a.req(path,raw=raw,ctype='multipart/form-data; boundary='+boundary,method='POST',status=201);assert a.req(path)==hexdata;a.req(path,raw=raw,ctype='multipart/form-data; boundary='+boundary,method='POST',status=409)
 a.req('/account/reset',{'email':staff['email'],'username':'worker','password':'Reset-first-2026!'},True,status=302);s.req('/api/session',status=401);s.login('staff','Staff-second-2026!',401);s.login('worker','Reset-first-2026!');s.req('/api/session',status=403)
 member=a.req('/api/users')['members'][0];a.req('/account/permissions',{'id':member['id'],'revision':member['revision'],'email':member['email'],'name':member['name'],'unit':member['unit'],'status':'disabled','read':['product','device']},True,status=302);s.req('/account',status=401);s.login('worker','Reset-first-2026!',401)
 stop();start();assert a.req('/api/session')['isAdmin'];assert len(a.req('/api/records')['records'])==6
 stop();process=None
 db=sqlite3.connect(pathlib.Path(TMP.name)/'nafasyar.sqlite');assert db.execute('pragma integrity_check').fetchone()[0]=='ok';assert db.execute('select count(distinct serial) from serial_reservations').fetchone()[0]==9
 assert not db.execute("select count(*) from app_members where email='other@example.com'").fetchone()[0]
 print(f'PASS: {checks} HTTP assertions; auth, forced change, permissions, revocation, records, serial concurrency, distribution, HEX, restart and database integrity.')
finally:stop();TMP.cleanup()
