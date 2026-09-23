"""Create and verify shortcuts in Windows' actual user Desktop and Programs folders."""
from pathlib import Path
import os
import sys
from win32com.client import Dispatch

def main():
    target=Path(sys.argv[1]).resolve()
    executable=target/'.venv'/'Scripts'/'pythonw.exe'
    if not executable.is_file():executable=target/'.venv'/'Scripts'/'python.exe'
    if not executable.is_file() or not (target/'run_bridge.py').is_file():
        raise RuntimeError('Installed launcher files are missing.')
    shell=Dispatch('WScript.Shell')
    for name in ('Desktop','Programs'):
        folder=Path(shell.SpecialFolders(name))
        if not str(folder) or not folder.is_dir():raise RuntimeError('Windows '+name+' folder was not found.')
        path=folder/'Nafasyar Bridge.lnk'
        shortcut=shell.CreateShortcut(str(path))
        shortcut.TargetPath=str(executable)
        shortcut.Arguments='"'+str(target/'run_bridge.py')+'"'
        shortcut.WorkingDirectory=str(target)
        shortcut.Description='Nafasyar Windows Bridge'
        shortcut.Save()
        saved=shell.CreateShortcut(str(path))
        if not path.is_file() or os.path.normcase(saved.TargetPath)!=os.path.normcase(str(executable)) or saved.Arguments!=shortcut.Arguments:
            raise RuntimeError('Shortcut verification failed: '+str(path))
        print('Verified '+name+' shortcut: '+str(path))

if __name__=='__main__':main()
