"""Logged entry point; GUI import/startup failures must not disappear silently."""
import json
import os
from pathlib import Path
import sys
import traceback
from datetime import datetime

def write_status(path,status):
    if path is None:return
    temporary=path.with_suffix('.tmp')
    temporary.write_text(json.dumps(status,ensure_ascii=False),encoding='utf-8')
    temporary.replace(path)

def main():
    folder=Path(__file__).resolve().parent
    ready=None
    if len(sys.argv)==3 and sys.argv[1]=='--ready-file':
        candidate=Path(sys.argv[2]).resolve()
        if candidate.parent!=folder or not candidate.name.startswith('startup-') or candidate.suffix!='.json':
            raise ValueError('Invalid startup status path.')
        ready=candidate
    log_path=folder/'START-LOG.txt'
    original_out,original_err=sys.stdout,sys.stderr
    try:
        with log_path.open('a',encoding='utf-8',buffering=1) as log:
            sys.stdout=sys.stderr=log
            print('\n--- Bridge startup '+datetime.now().isoformat()+' ---')
            print('Interpreter: '+sys.executable)
            try:
                from launcher import main as launch
                from bridge import VERSION
                def confirmed():
                    print('Window created and visible. Version '+VERSION)
                    write_status(ready,{'status':'window-visible','pid':os.getpid(),'version':VERSION})
                launch(on_ready=confirmed)
                return 0
            except BaseException as exc:
                traceback.print_exc()
                try:write_status(ready,{'status':'error','pid':os.getpid(),'message':str(exc)[:500]})
                except Exception:traceback.print_exc()
                raise
            finally:sys.stdout,sys.stderr=original_out,original_err
    except BaseException as exc:
        message='Nafasyar Bridge could not open.\n\n'+str(exc)+'\n\nDiagnostic file:\n'+str(log_path)
        if sys.platform=='win32':
            try:
                import ctypes
                ctypes.windll.user32.MessageBoxW(None,message,'Nafasyar Bridge - startup error',0x10)
            except Exception:pass
        if original_err is not None:
            try:print(message,file=original_err)
            except Exception:pass
        return 1

if __name__=='__main__':raise SystemExit(main())
