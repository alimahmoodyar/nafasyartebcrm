import importlib.util, pathlib, unittest, types
root=next(p.parent for parent in pathlib.Path(__file__).resolve().parents for p in (parent/'check_python.py',parent/'desktop'/'finance-bridge'/'check_python.py') if p.is_file())
spec=importlib.util.spec_from_file_location('check_python',root/'check_python.py');probe=importlib.util.module_from_spec(spec);spec.loader.exec_module(probe)
class RuntimeTests(unittest.TestCase):
    def test_wrong_version_explains_required_runtime_before_imports(self):
        def loader(name):raise AssertionError('Must not load Tk for unsupported interpreter')
        code,message=probe.check((3,14,0),loader)
        self.assertEqual(code,2);self.assertIn('3.11 or 3.12',message)
    def test_supported_interpreter_without_launcher_or_path(self):
        # Compatibility depends on interpreter capabilities, not py.exe or PATH.
        for version in ((3,11,9),(3,12,10)):
            code,_=probe.check(version,lambda name:types.SimpleNamespace(Tcl=lambda:object()))
            self.assertEqual(code,0)
    def test_missing_tk_has_repair_message(self):
        def loader(name):raise ModuleNotFoundError('tkinter')
        code,message=probe.check((3,12,10),loader)
        self.assertEqual(code,3);self.assertIn('Modify/repair',message)
    def test_incomplete_python_has_full_installer_message(self):
        def loader(name):
            if name=='tkinter':return types.SimpleNamespace(Tcl=lambda:object())
            raise ModuleNotFoundError(name)
        code,message=probe.check((3,12,10),loader)
        self.assertEqual(code,4);self.assertIn('full Windows installer',message)
    def test_tcl_load_error_is_reported(self):
        def bad_tcl():raise RuntimeError('Tcl DLL missing')
        code,message=probe.check((3,12,10),lambda name:types.SimpleNamespace(Tcl=bad_tcl))
        self.assertEqual(code,3);self.assertIn('Tcl DLL missing',message)
if __name__=='__main__':unittest.main()
