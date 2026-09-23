import importlib.util, json, pathlib, sys, tempfile, types, unittest
from unittest.mock import patch
root=next(p.parent for parent in pathlib.Path(__file__).resolve().parents for p in (parent/'startup_check.py',parent/'desktop'/'finance-bridge'/'startup_check.py') if p.is_file())
spec=importlib.util.spec_from_file_location('startup_check',root/'startup_check.py');startup=importlib.util.module_from_spec(spec);spec.loader.exec_module(startup)
spec=importlib.util.spec_from_file_location('run_bridge',root/'run_bridge.py');entry=importlib.util.module_from_spec(spec);spec.loader.exec_module(entry)
class StartupTests(unittest.TestCase):
    def setUp(self):
        self.tmp=tempfile.TemporaryDirectory();self.addCleanup(self.tmp.cleanup);self.path=pathlib.Path(self.tmp.name)/'startup-test.json'
    def test_exit_zero_without_window_is_failure(self):
        child=types.SimpleNamespace(pid=42,poll=lambda:0)
        with self.assertRaisesRegex(RuntimeError,'exited before'):startup.wait_for_window(child,self.path,timeout=0.1)
    def test_exit_nonzero_is_failure(self):
        child=types.SimpleNamespace(pid=42,poll=lambda:1)
        with self.assertRaisesRegex(RuntimeError,'exit 1'):startup.wait_for_window(child,self.path,timeout=0.1)
    def test_process_alive_without_window_is_not_success(self):
        child=types.SimpleNamespace(pid=42,poll=lambda:None)
        with self.assertRaisesRegex(RuntimeError,'not confirmed'):startup.wait_for_window(child,self.path,timeout=0.06)
    def test_confirmed_visible_window_succeeds(self):
        child=types.SimpleNamespace(pid=42,poll=lambda:None)
        entry.write_status(self.path,{'status':'window-visible','pid':42,'version':'0.2.2'})
        self.assertEqual(startup.wait_for_window(child,self.path,timeout=0.1)['version'],'0.2.2')
        self.assertFalse(self.path.with_suffix('.tmp').exists())
    def test_other_process_marker_is_rejected(self):
        child=types.SimpleNamespace(pid=42,poll=lambda:None)
        entry.write_status(self.path,{'status':'window-visible','pid':99})
        with self.assertRaisesRegex(RuntimeError,'not confirmed'):startup.wait_for_window(child,self.path,timeout=0.06)
    def test_gui_import_error_is_reported(self):
        child=types.SimpleNamespace(pid=42,poll=lambda:None)
        entry.write_status(self.path,{'status':'error','pid':42,'message':'Tcl library unavailable'})
        with self.assertRaisesRegex(RuntimeError,'Tcl library unavailable'):startup.wait_for_window(child,self.path,timeout=0.1)
    def test_actual_entrypoint_captures_launcher_exception(self):
        def launch(**kwargs):raise RuntimeError('simulated GUI startup failure')
        fake=types.SimpleNamespace(main=launch)
        with patch.object(entry,'__file__',str(pathlib.Path(self.tmp.name)/'run_bridge.py')),patch.object(sys,'argv',['run_bridge.py','--ready-file',str(self.path)]),patch.dict(sys.modules,{'launcher':fake,'bridge':types.SimpleNamespace(VERSION='0.2.2')}):
            self.assertEqual(entry.main(),1)
        self.assertEqual(json.loads(self.path.read_text())['status'],'error')
        self.assertIn('simulated GUI startup failure',(pathlib.Path(self.tmp.name)/'START-LOG.txt').read_text())
if __name__=='__main__':unittest.main()
