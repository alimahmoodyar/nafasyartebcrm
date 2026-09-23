"""Check interpreter compatibility before the installer copies any files."""
import importlib
import sys
import argparse
from pathlib import Path

SUPPORTED = ((3, 11), (3, 12))

def check(version, loader=importlib.import_module):
    if tuple(version[:2]) not in SUPPORTED:
        return 2, 'Unsupported version. This bridge requires Python 3.11 or 3.12. Installing only Python Install Manager or another version is not enough.'
    try:
        tk = loader('tkinter')
        tk.Tcl()
    except Exception as exc:
        return 3, 'Tcl/Tk is unavailable. Modify/repair this Python installation and enable Tcl/Tk: ' + str(exc)
    try:
        loader('venv')
        loader('ensurepip')
    except Exception as exc:
        return 4, 'Python is missing venv or pip installation support. Use the full Windows installer: ' + str(exc)
    return 0, 'Compatible interpreter with Tcl/Tk and venv found.'

def main(receipt=None):
    if receipt:Path(receipt).unlink(missing_ok=True)
    print('Python version: ' + sys.version.split()[0])
    print('Interpreter: ' + sys.executable)
    code, message = check(sys.version_info)
    print(message)
    if code==0 and receipt:Path(receipt).write_text('NAFASYAR_PYTHON_READY_V1\n',encoding='ascii')
    return code

if __name__ == '__main__':
    parser=argparse.ArgumentParser();parser.add_argument('--receipt')
    raise SystemExit(main(parser.parse_args().receipt))
