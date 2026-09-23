"""Per-user installer with a local diagnostic log; never writes accounting data."""
import os, pathlib, shutil, subprocess, sys, traceback, venv, uuid
from check_python import check
from startup_check import wait_for_window
VERSION='0.2.2'

class Tee:
    def __init__(self, stream, log):self.stream=stream;self.log=log
    def write(self, text):
        self.log.write(text);self.log.flush()
        try:self.stream.write(text);self.stream.flush()
        except UnicodeEncodeError:
            safe=text.encode(self.stream.encoding or 'ascii',errors='replace').decode(self.stream.encoding or 'ascii')
            self.stream.write(safe);self.stream.flush()
        return len(text)
    def flush(self):self.stream.flush();self.log.flush()

def run_checked(args):
    with subprocess.Popen(args,stdout=subprocess.PIPE,stderr=subprocess.STDOUT,text=True,encoding='utf-8',errors='replace',env={**os.environ,'PYTHONIOENCODING':'utf-8'}) as process:
        for line in process.stdout:print(line,end='')
        if process.wait():raise RuntimeError('Installation command failed with exit code '+str(process.returncode))

def install(source):
    if sys.platform!='win32':raise RuntimeError('Windows is required.')
    code,message=check(sys.version_info)
    if code:raise RuntimeError(message)
    base=pathlib.Path(os.environ['LOCALAPPDATA'])/'NafasyarBridge'
    target=base/VERSION;target.mkdir(parents=True,exist_ok=True)
    for name in ('bridge.py','launcher.py','run_bridge.py','requirements.txt','START.cmd','README-fa.html','release.json'):
        if source/name!=target/name:shutil.copy2(source/name,target/name)
    print('Using Python: '+sys.executable)
    print('Creating isolated environment ...')
    venv.EnvBuilder(with_pip=True).create(target/'.venv')
    python=target/'.venv'/'Scripts'/'python.exe'
    run_checked([str(python),'-m','pip','install','--disable-pip-version-check','--index-url','https://pypi.org/simple','-r',str(target/'requirements.txt')])
    run_checked([str(python),'-c','import psutil, pywinauto, PIL, tkinter; print("Dependencies OK")'])
    run_checked([str(python),str(source/'create_shortcuts.py'),str(target)])
    print('Application folder: '+str(target))
    try:os.startfile(str(target))
    except OSError as exc:print('Could not open the application folder: '+str(exc))
    ready=target/('startup-'+uuid.uuid4().hex+'.json')
    startup_log=target/'START-LOG.txt'
    with startup_log.open('a',encoding='utf-8') as output:
        process=subprocess.Popen([str(python),str(target/'run_bridge.py'),'--ready-file',str(ready)],cwd=str(target),stdout=output,stderr=output)
    try:
        result=wait_for_window(process,ready)
        print('Bridge window confirmed. Version '+result['version'])
        print('Installation completed. Shortcuts were verified in Desktop and Start Menu.')
        print('You can also run START.cmd in the application folder, or OPEN.cmd in the extracted package.')
    except Exception:
        print('Program startup failed. Diagnostic file: '+str(startup_log))
        if startup_log.exists():print(startup_log.read_text(encoding='utf-8',errors='replace')[-12000:])
        raise
    finally:
        for marker in (ready,ready.with_suffix('.tmp')):
            try:marker.unlink(missing_ok=True)
            except OSError:pass

def main():
    source=pathlib.Path(__file__).resolve().parent
    stdout,stderr=sys.stdout,sys.stderr
    with (source/'INSTALL-LOG.txt').open('a',encoding='utf-8') as log:
        sys.stdout,sys.stderr=Tee(stdout,log),Tee(stderr,log)
        try:install(source);return 0
        except Exception:
            traceback.print_exc()
            print('Installation did not finish successfully. Send INSTALL-LOG.txt for diagnosis.')
            folder=pathlib.Path(os.environ.get('LOCALAPPDATA',''))/'NafasyarBridge'/VERSION
            if sys.platform=='win32' and folder.is_dir():
                try:os.startfile(str(folder))
                except OSError:pass
            return 1
        finally:sys.stdout,sys.stderr=stdout,stderr

if __name__=='__main__':raise SystemExit(main())
