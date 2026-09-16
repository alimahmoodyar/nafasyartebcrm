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
 start();a=Client();a.login('admin','Nafasyar12345');a.req('/api/session',status=403);a.change('owner','Nafasyar12345','Owner-test-2026!');a.login('owner','Owner-test-2026!')
 def record(k,d):return a.req('/api/records',{'kind':k,'data':d},status=201)['record']
 product=record('product',{'code':'QC','name':'کنترل','group':'تنفسی','model':'M','warrantyMonths':'24','status':'فعال'});device=record('device',{'code':'QC-01','product':product['id'],'design':'1','date':'2026-09-14'});batch=record('batch',{'code':'B1','part':'قطعه','supplier':'تامین','date':'2026-09-14','quantity':'10','unit':'عدد','status':'تأیید','notes':'تفاوت با بچ قبلی'})
 fields=[{'key':'purity','label':'خلوص','type':'number','unit':'%','min':'90','max':'96','required':True},{'key':'appearance','label':'ظاهر','type':'result','unit':'','min':'','max':'','required':True}]
 body={'productId':product['id'],'title':'کنترل نهایی','fields':fields,'previousVersion':0};template=a.req('/api/quality/templates',body,status=201)['template'];a.req('/api/quality/templates',body,status=409)
 newer=a.req('/api/quality/templates',{**body,'previousVersion':1,'fields':[{**fields[0],'min':'93'},fields[1]]},status=201)['template'];assert newer['version']==2
 assert len(a.req('/api/quality/templates?device='+device['id'])['templates'])==2
 report={'deviceId':device['id'],'templateId':template['id'],'values':{'purity':'۹۲','appearance':'pass'},'verdict':'pass','notes':'اولیه','requestId':str(uuid.uuid4())}
 a.req('/api/quality/reports',{**report,'templateId':newer['id']},status=400);a.req('/api/quality/reports',{**report,'values':{'purity':'87','appearance':'pass'}},status=400);a.req('/api/quality/reports',{**report,'values':{}},status=400)
 r=a.req('/api/quality/reports',report,status=201)['report'];assert r['values']['purity']=='92';assert r['template']['version']==1
 a.req('/api/quality/reports',report,status=201);assert len(a.req('/api/quality/reports?device='+device['id'])['reports'])==1
 boundary='TESTBOUND';raw=(f'--{boundary}\r\nContent-Disposition: form-data; name="file"; filename="test.html"\r\nContent-Type: text/html\r\n\r\n<html>QC</html>\r\n--{boundary}--\r\n').encode()
 files=[]
 for endpoint,parentkey,parent in [('/api/batch-files','batch',batch['id']),('/api/quality/files','report',r['id'])]:
  url=endpoint+'?'+parentkey+'='+urllib.parse.quote(parent);uid=str(uuid.uuid4());up=url+'&requestId='+uid
  a.req(up,raw=raw,ctype='multipart/form-data; boundary='+boundary,method='POST',status=201);a.req(up,raw=raw,ctype='multipart/form-data; boundary='+boundary,method='POST',status=201)
  result=a.req(url)['files'];assert len(result)==1;assert 'object_key' not in result[0];assert a.req(url+'&id='+uid)=='<html>QC</html>';files.append((url,up,uid))
 staff={'email':'reader@example.com','name':'همکار','unit':'کنترل','username':'reader','password':'Reader-first-2026!','read':['device','event','batch']};a.req('/account/create',staff,True,status=302);s=Client();s.login('reader',staff['password']);s.change('reader',staff['password'],'Reader-second-2026!');s.login('reader','Reader-second-2026!');s.req('/api/quality/reports?device='+device['id']);s.req('/api/quality/reports',report,status=403)
 for url,up,uid in files:s.req(url);s.req(up,raw=raw,ctype='multipart/form-data; boundary='+boundary,method='POST',status=403)
 stop();process=None
 backup=TMP.name+'-backup';p=subprocess.run([DOTNET,str(BACK/'bin/Release/net8.0/Nafasyar.Api.dll'),'--backup',backup],cwd=BACK,env=env,capture_output=True,text=True);assert p.returncode==0,p.stderr
 db=sqlite3.connect(pathlib.Path(backup)/'nafasyar.sqlite');assert db.execute('select count(*) from quality_reports').fetchone()[0]==1;assert db.execute('select count(*) from batch_files').fetchone()[0]==1;assert len(list((pathlib.Path(backup)/'objects').rglob('*test*')))==0;assert sum(x.is_file() for x in (pathlib.Path(backup)/'objects').rglob('*'))==2;db.close()
 p=subprocess.run([DOTNET,str(BACK/'bin/Release/net8.0/Nafasyar.Api.dll'),'--reset-admin'],cwd=BACK,env=env,capture_output=True,text=True);assert p.returncode==0,p.stderr
 start();a.login('admin','Nafasyar12345');a.req('/api/session',status=403);a.change('admin','Nafasyar12345','Final-owner-2026!');a.login('admin','Final-owner-2026!');assert len(a.req('/api/quality/reports?device='+device['id'])['reports'])==1;a.req('/api/users');assert len(a.req('/api/records')['records'])==4
 stop();process=None
 # Import the complete new schema and metadata into a separate target; transfer object bytes separately.
 db=sqlite3.connect(pathlib.Path(TMP.name)/'nafasyar.sqlite');db.row_factory=sqlite3.Row;tables=['app_identity','records','app_members','access_audit','firmware_files','serial_runs','serial_reservations','batch_files','quality_templates','quality_reports','quality_files'];dump={'format':'nafasyar-d1-export-v1','tables':{t:{'columns':[x[1] for x in db.execute('pragma table_info('+t+')')],'rows':[dict(x) for x in db.execute('select * from '+t)]} for t in tables}};db.close();dumpfile=pathlib.Path(TMP.name)/'full.json';dumpfile.write_text(json.dumps(dump));dest=TMP.name+'-import'
 p=subprocess.run([DOTNET,str(BACK/'bin/Release/net8.0/Nafasyar.Api.dll'),'--import',str(dumpfile)],cwd=BACK,env={**env,'DATA_DIR':dest},capture_output=True,text=True);assert p.returncode==0,p.stderr
 db=sqlite3.connect(pathlib.Path(dest)/'nafasyar.sqlite');assert db.execute('select count(*) from quality_reports').fetchone()[0]==1;assert db.execute('pragma foreign_key_check').fetchall()==[];db.close()
 import shutil;shutil.rmtree(dest);shutil.rmtree(backup)
 print(f'PASS: {checks} new-feature HTTP assertions; batch/QC files, template history, required/numeric checks, permissions, reset with data preserved, backup and full import.')
finally:stop();TMP.cleanup()
