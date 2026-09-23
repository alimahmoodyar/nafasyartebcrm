@echo off
setlocal EnableExtensions DisableDelayedExpansion
cd /d "%~dp0"
set "NAFASYAR_CHECK_PYTHON="
if not exist "%~dp0diagnose.py" goto incomplete
if not exist "%~dp0bridge.py" goto incomplete
for %%V in (0.2.4 0.2.3 0.2.2 0.2.1 0.2.0) do if not defined NAFASYAR_CHECK_PYTHON if exist "%LOCALAPPDATA%\NafasyarBridge\%%V\.venv\Scripts\python.exe" set "NAFASYAR_CHECK_PYTHON=%LOCALAPPDATA%\NafasyarBridge\%%V\.venv\Scripts\python.exe"
if not defined NAFASYAR_CHECK_PYTHON goto not_found
echo Checking both window-reading methods. Allow about 40 seconds...
echo This does not install anything or change accounting data.
"%NAFASYAR_CHECK_PYTHON%" "%~dp0diagnose.py" --save
if errorlevel 1 goto failed
if not errorlevel 0 goto failed
echo Copy the report from Notepad and send it in the conversation.
pause
exit /b 0
:not_found
echo The existing Nafasyar Bridge Python environment was not found for this Windows user.
echo Send a photo of this message. Do not reinstall Python.
pause
exit /b 1
:incomplete
echo Extract ALL files from the ZIP to a new folder first, then run CHECK.cmd.
pause
exit /b 1
:failed
echo The check could not finish. Send a photo of the error above.
pause
exit /b 1
