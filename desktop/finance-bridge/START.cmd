@echo off
setlocal EnableExtensions DisableDelayedExpansion
cd /d "%~dp0"
if not exist "%~dp0.venv\Scripts\python.exe" goto missing
if not exist "%~dp0run_bridge.py" goto missing
echo Starting Nafasyar Bridge...
echo If the window cannot open, details will be saved in START-LOG.txt.
"%~dp0.venv\Scripts\python.exe" "%~dp0run_bridge.py"
if errorlevel 1 goto failed
exit /b 0
:missing
echo Installed files were not found. Run INSTALL.cmd from the extracted package.
pause
exit /b 1
:failed
echo.
echo The bridge did not run successfully. Send this file for diagnosis:
echo "%~dp0START-LOG.txt"
pause
exit /b 1
