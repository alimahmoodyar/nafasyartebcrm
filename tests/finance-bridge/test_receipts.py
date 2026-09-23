import contextlib, importlib.util, io, pathlib, sys, tempfile, unittest
from unittest.mock import patch
root=next(p.parent for parent in pathlib.Path(__file__).resolve().parents for p in (parent/'check_python.py',parent/'desktop'/'finance-bridge'/'check_python.py') if p.is_file())
sys.path.insert(0,str(root))
import check_python as probe
import install as installer
class ReceiptTests(unittest.TestCase):
    def setUp(self):
        self.tmp=tempfile.TemporaryDirectory();self.addCleanup(self.tmp.cleanup)
        self.path=pathlib.Path(self.tmp.name)/'test.receipt'
    def test_failed_probe_removes_old_receipt(self):
        self.path.write_text('NAFASYAR_PYTHON_READY_V1\n')
        with patch.object(probe,'check',return_value=(2,'missing runtime')),contextlib.redirect_stdout(io.StringIO()):
            self.assertEqual(probe.main(self.path),2)
        self.assertFalse(self.path.exists())
    def test_successful_probe_writes_positive_receipt(self):
        with patch.object(probe,'check',return_value=(0,'ready')),contextlib.redirect_stdout(io.StringIO()):
            self.assertEqual(probe.main(self.path),0)
        self.assertEqual(self.path.read_text(),'NAFASYAR_PYTHON_READY_V1\n')
    def test_failed_install_never_acknowledges_completion(self):
        self.path.write_text('NAFASYAR_INSTALL_OK_V1\n')
        with patch.object(installer,'__file__',str(pathlib.Path(self.tmp.name)/'install.py')),patch.object(installer,'install',side_effect=RuntimeError('startup failed')),contextlib.redirect_stdout(io.StringIO()),contextlib.redirect_stderr(io.StringIO()):
            self.assertEqual(installer.main(self.path),1)
        self.assertFalse(self.path.exists())
    def test_install_acknowledges_only_after_success(self):
        def successful_install(source):self.assertFalse(self.path.exists())
        with patch.object(installer,'__file__',str(pathlib.Path(self.tmp.name)/'install.py')),patch.object(installer,'install',side_effect=successful_install),contextlib.redirect_stdout(io.StringIO()):
            self.assertEqual(installer.main(self.path),0)
        self.assertEqual(self.path.read_text(),'NAFASYAR_INSTALL_OK_V1\n')
if __name__=='__main__':unittest.main()
