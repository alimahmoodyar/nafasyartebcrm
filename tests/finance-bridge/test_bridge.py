import importlib.util, pathlib, unittest, sys, types, threading, http.client, json, time
from unittest.mock import patch
path=next(p for root in pathlib.Path(__file__).resolve().parents for p in (root/'bridge.py',root/'desktop'/'finance-bridge'/'bridge.py') if p.is_file())
spec=importlib.util.spec_from_file_location('bridge',path);b=importlib.util.module_from_spec(spec);spec.loader.exec_module(b)
class Control:
    handle=77
    def __init__(self,name='Report',password=False,children=()):
        self.element_info=types.SimpleNamespace(name=name,automation_id='id',control_type='Edit',class_name='Edit',element=types.SimpleNamespace(CurrentIsPassword=password))
        self.nodes=list(children);self.captures=0
    def process_id(self):return 42
    def window_text(self):return self.element_info.name
    def is_visible(self):return True
    def children(self):return self.nodes
    def get_value(self):return self.element_info.name
    def capture_as_image(self):
        self.captures+=1
        return types.SimpleNamespace(thumbnail=lambda size:None,save=lambda out,format:out.write(b'png'))
    def wrapper_object(self):return self
class BridgeTests(unittest.TestCase):
    def setUp(self):
        self.window=Control(children=[Control('secret password',True),Control('Amount 120')]);self.started=100
        desktop=types.SimpleNamespace(windows=lambda **kw:[self.window],window=lambda **kw:self.window)
        proc=types.SimpleNamespace(create_time=lambda:self.started,exe=lambda:'Accounting.exe',name=lambda:'Accounting.exe')
        self.mods=patch.dict(sys.modules,{'psutil':types.SimpleNamespace(Process=lambda pid:proc),'pywinauto':types.SimpleNamespace(Desktop=lambda **kw:desktop)})
        self.mods.start();self.session=b.Session()
    def tearDown(self):self.mods.stop()
    def select(self):return self.session.dispatch('/windows',{})['windows'][0]['id']
    def test_read_only_endpoints(self):
        self.assertTrue(self.session.dispatch('/health',{})['readOnly'])
        for path in ('/fill','/prepare','/click','/exec','/save','/post'):
            with self.assertRaises(ValueError):self.session.dispatch(path,{})
    def test_only_selected_window_and_password_filter(self):
        with self.assertRaises(ValueError):self.session.dispatch('/inspect',{'id':'77'})
        result=self.session.dispatch('/inspect',{'id':self.select()})
        self.assertEqual([x['text'] for x in result['controls']],['Report','Amount 120'])
        self.assertIsNone(result['image']);self.assertEqual(self.window.captures,0)
    def test_screenshot_requires_explicit_boolean(self):
        ident=self.select()
        self.session.dispatch('/inspect',{'id':ident,'screenshot':'true'})
        self.assertEqual(self.window.captures,0)
        self.assertTrue(self.session.dispatch('/inspect',{'id':ident,'screenshot':True})['image'])
        self.assertEqual(self.window.captures,1)
    def test_stale_process_mode_and_selection_rejected(self):
        ident=self.select();self.started=200
        with self.assertRaises(ValueError):self.session.dispatch('/inspect',{'id':ident})
        ident=self.select()
        with self.assertRaises(ValueError):self.session.dispatch('/inspect',{'id':ident,'backend':'win32'})
        self.session.windows[ident]['time']-=601
        with self.assertRaises(ValueError):self.session.dispatch('/inspect',{'id':ident})
    def test_expired_session(self):
        self.session.created-=8*3600+1
        with self.assertRaises(ValueError):self.session.dispatch('/health',{})
    def test_large_tree_is_bounded(self):
        self.window.nodes=[Control(str(i)) for i in range(1000)]
        result=self.session.dispatch('/inspect',{'id':self.select()})
        self.assertLessEqual(len(result['controls']),600);self.assertTrue(result['truncated'])
class HttpTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.session=b.Session();cls.server=b.HTTPServer(('127.0.0.1',0),b.Handler);cls.server.session=cls.session
        cls.worker=threading.Thread(target=cls.server.serve_forever,daemon=True);cls.worker.start()
    @classmethod
    def tearDownClass(cls):cls.server.shutdown();cls.server.server_close();cls.worker.join()
    def call(self,path='/health',headers=None,body=b'{}',method='POST'):
        base={'Origin':b.ORIGIN,'Host':'127.0.0.1:8765','X-Nafasyar-Token':self.session.token,'Content-Type':'application/json'}
        if headers:base.update(headers)
        conn=http.client.HTTPConnection('127.0.0.1',self.server.server_port,timeout=3)
        conn.request(method,path,body,base);res=conn.getresponse();data=res.read();status=res.status;response_headers=dict(res.getheaders());conn.close();return status,data,response_headers
    def test_auth_origin_and_host(self):
        self.assertEqual(self.call()[0],200)
        self.assertEqual(self.call(headers={'X-Nafasyar-Token':'bad'})[0],401)
        for headers in ({'Origin':'https://other.example'},{'Host':'evil.example'}):self.assertEqual(self.call(headers=headers)[0],403)
    def test_size_and_type(self):
        self.assertEqual(self.call(body=b'x'*17000)[0],400)
        self.assertEqual(self.call(headers={'Content-Type':'text/plain'})[0],400)
        self.assertEqual(self.call(body=b'[]')[0],400)
    def test_cors_and_mutations(self):
        status,_,headers=self.call(method='OPTIONS',body=None)
        self.assertEqual(status,204);self.assertEqual(headers['Access-Control-Allow-Origin'],b.ORIGIN)
        self.assertEqual(self.call('/fill')[0],400)
        self.assertNotIn('Access-Control-Allow-Origin',self.call(headers={'Origin':'https://other.example'})[2])
if __name__=='__main__':unittest.main()
