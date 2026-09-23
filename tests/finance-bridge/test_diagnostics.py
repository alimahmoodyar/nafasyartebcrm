import importlib.util, pathlib, subprocess, sys, unittest
from unittest.mock import patch
root=next(p for base in pathlib.Path(__file__).resolve().parents for p in (base,base/'desktop'/'finance-bridge') if (p/'diagnose.py').is_file())
sys.path.insert(0,str(root))
import diagnose as d

class DiagnosticsTests(unittest.TestCase):
    def test_timeout_does_not_prevent_other_backend(self):
        good=type('Result',(),{'returncode':0,'stdout':'{"backend":"win32","status":"ok","accepted":3}'})()
        with patch.object(d.subprocess,'run',side_effect=[subprocess.TimeoutExpired('probe',18),good]):
            report=d.collect()
        self.assertEqual(report['results'][0]['status'],'timeout')
        self.assertEqual(report['results'][1]['accepted'],3)
    def test_process_failure_never_exports_stderr(self):
        failed=type('Result',(),{'returncode':7,'stderr':'PRIVATE CUSTOMER PATH','stdout':'PRIVATE DATA'})()
        with patch.object(d.subprocess,'run',return_value=failed):result=d.run_probe('uia')
        self.assertEqual(result,{'backend':'uia','status':'process_failed','exitCode':7})

if __name__=='__main__':unittest.main()
