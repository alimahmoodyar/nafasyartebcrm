"""Per-user installer; does not require elevation or alter accounting software."""
import os, pathlib, shutil, subprocess, sys, venv
VERSION='0.2.0'
if sys.platform!='win32':raise SystemExit('Windows is required.')
if sys.version_info[:2] not in ((3,11),(3,12)):raise SystemExit('Install Python 3.11 or 3.12 with Tcl/Tk first.')
source=pathlib.Path(__file__).resolve().parent
base=pathlib.Path(os.environ['LOCALAPPDATA'])/'NafasyarBridge'
target=base/VERSION;target.mkdir(parents=True,exist_ok=True)
for name in ('bridge.py','launcher.py','requirements.txt','START.cmd','README-fa.html','release.json'):
    if source/name!=target/name:shutil.copy2(source/name,target/name)
print('Creating isolated environment ...')
venv.EnvBuilder(with_pip=True).create(target/'.venv')
python=target/'.venv'/'Scripts'/'python.exe'
subprocess.run([str(python),'-m','pip','install','--disable-pip-version-check','--index-url','https://pypi.org/simple','-r',str(target/'requirements.txt')],check=True)
subprocess.run([str(python),'-c','import psutil, pywinauto, PIL, tkinter; print("Dependencies OK")'],check=True)
shortcut_code='''import os,sys
from win32com.client import Dispatch
from pathlib import Path
shell=Dispatch('WScript.Shell');target=Path(sys.argv[1]);folder=Path(shell.SpecialFolders('Desktop'))
shortcut=shell.CreateShortcut(str(folder/'Nafasyar Bridge.lnk'))
shortcut.TargetPath=str(target/'START.cmd');shortcut.WorkingDirectory=str(target);shortcut.Description='Nafasyar read-only Windows bridge';shortcut.Save()
'''
subprocess.run([str(python),'-c',shortcut_code,str(target)],check=True)
print('Installed. Use Nafasyar Bridge on your Desktop. Keep this folder: '+str(target))
subprocess.Popen([str(python),str(target/'launcher.py')],cwd=str(target))
