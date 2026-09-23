"""Per-user installer with a local diagnostic log; never writes accounting data."""
import os, pathlib, shutil, subprocess, sys, traceback, venv
from check_python import check
VERSION='0.2.1'

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
    for name in ('bridge.py','launcher.py','requirements.txt','START.cmd','README-fa.html','release.json'):
        if source/name!=target/name:shutil.copy2(source/name,target/name)
    print('Using Python: '+sys.executable)
    print('Creating isolated environment ...')
    venv.EnvBuilder(with_pip=True).create(target/'.venv')
    python=target/'.venv'/'Scripts'/'python.exe'
    run_checked([str(python),'-m','pip','install','--disable-pip-version-check','--index-url','https://pypi.org/simple','-r',str(target/'requirements.txt')])
    run_checked([str(python),'-c','import psutil, pywinauto, PIL, tkinter; print("Dependencies OK")'])
    shortcut_code='''import sys
from win32com.client import Dispatch
from pathlib import Path
shell=Dispatch('WScript.Shell');target=Path(sys.argv[1]);folder=Path(shell.SpecialFolders('Desktop'))
shortcut=shell.CreateShortcut(str(folder/'Nafasyar Bridge.lnk'))
shortcut.TargetPath=str(target/'START.cmd');shortcut.WorkingDirectory=str(target);shortcut.Description='Nafasyar read-only Windows bridge';shortcut.Save()
'''
    run_checked([str(python),'-c',shortcut_code,str(target)])
    print('Installed. Use Nafasyar Bridge on your Desktop. Keep this folder: '+str(target))
    subprocess.Popen([str(python),str(target/'launcher.py')],cwd=str(target))

def main():
    source=pathlib.Path(__file__).resolve().parent
    stdout,stderr=sys.stdout,sys.stderr
    with (source/'INSTALL-LOG.txt').open('a',encoding='utf-8') as log:
        sys.stdout,sys.stderr=Tee(stdout,log),Tee(stderr,log)
        try:install(source);return 0
        except Exception:
            traceback.print_exc()
            print('Installation failed. Send INSTALL-LOG.txt for diagnosis.')
            return 1
        finally:sys.stdout,sys.stderr=stdout,stderr

if __name__=='__main__':raise SystemExit(main())
