@echo off
setlocal
cd /d "%~dp0"
py -3.12 -c "import sys" >nul 2>&1
if not errorlevel 1 (
 py -3.12 install.py
 goto done
)
py -3.11 -c "import sys" >nul 2>&1
if not errorlevel 1 (
 py -3.11 install.py
 goto done
)
echo Python 3.11 or 3.12 with Tcl/Tk is required.
echo Install Python for this user, then run INSTALL.cmd again.
start "Python download" "https://www.python.org/downloads/release/python-31210/"
pause
exit /b 1
:done
if errorlevel 1 (
 echo Installation did not complete. Read the error above. Do not disable antivirus or Windows security.
 pause
 exit /b 1
)
echo Installation completed. A desktop shortcut was created.
pause
