"""Bounded local discovery probes. Saved report contains no window titles or text."""
import json, os, pathlib, platform, subprocess, sys
from datetime import datetime, timezone
from bridge import VERSION, discover_windows, record_error

def probe(backend):
    initialized=False
    try:
        sys.coinit_flags=0
        import pythoncom
        pythoncom.CoInitializeEx(pythoncom.COINIT_MULTITHREADED);initialized=True
        return discover_windows(backend,{})['diagnostics']
    except Exception as exc:
        errors=[];record_error(errors,'probe_init',exc)
        return {'backend':backend,'status':'failed','errors':errors}
    finally:
        if initialized:pythoncom.CoUninitialize()

def run_probe(backend):
    python=pathlib.Path(sys.executable)
    if python.name.lower()=='pythonw.exe':python=python.with_name('python.exe')
    try:
        result=subprocess.run([str(python),str(pathlib.Path(__file__).resolve()),'--probe',backend],capture_output=True,text=True,encoding='utf-8',errors='replace',timeout=18,creationflags=getattr(subprocess,'CREATE_NO_WINDOW',0),env={**os.environ,'PYTHONIOENCODING':'utf-8'})
        if result.returncode:return {'backend':backend,'status':'process_failed','exitCode':result.returncode}
        return json.loads(result.stdout)
    except subprocess.TimeoutExpired:return {'backend':backend,'status':'timeout','timeoutSeconds':18}
    except Exception as exc:
        errors=[];record_error(errors,'probe_process',exc)
        return {'backend':backend,'status':'failed','errors':errors}

def collect():
    elevated=None
    if sys.platform=='win32':
        try:
            import ctypes
            elevated=bool(ctypes.windll.shell32.IsUserAnAdmin())
        except Exception:pass
    return {'bridgeVersion':VERSION,'capturedAt':datetime.now(timezone.utc).isoformat(),'python':platform.python_version(),'pythonBits':64 if sys.maxsize>2**32 else 32,'os':platform.system()+' '+platform.release(),'elevated':elevated,'scope':'window-discovery-only; no financial text, images, paths, titles or tokens','results':[run_probe(mode) for mode in ('uia','win32')]}

if __name__=='__main__':
    if len(sys.argv)==3 and sys.argv[1]=='--probe' and sys.argv[2] in ('uia','win32'):
        print(json.dumps(probe(sys.argv[2]),ensure_ascii=True))
    elif len(sys.argv)==2 and sys.argv[1]=='--save':
        report=collect();text=json.dumps(report,ensure_ascii=True,indent=2)
        path=pathlib.Path(__file__).resolve().parent/'DIAGNOSTICS.json'
        path.write_text(text,encoding='utf-8');print(text)
        if sys.platform=='win32':
            try:subprocess.Popen([str(pathlib.Path(os.environ['SystemRoot'])/'System32'/'notepad.exe'),str(path)])
            except OSError:print('Open DIAGNOSTICS.json in this extracted folder.')
    else:raise SystemExit('Use the diagnostics button in Nafasyar Bridge.')
