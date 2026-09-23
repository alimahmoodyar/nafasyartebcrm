@echo off
setlocal EnableExtensions DisableDelayedExpansion
cd /d "%~dp0"
set "NAFASYAR_INSTALL_LOG=%~dp0INSTALL-LOG.txt"
set "NAFASYAR_PYTHON="
set "NAFASYAR_SELECTOR="
> "%NAFASYAR_INSTALL_LOG%" echo Nafasyar Bridge 0.2.2 installation diagnostics
if errorlevel 1 goto log_failed
if not exist "%~dp0check_python.py" goto incomplete
if not exist "%~dp0install.py" goto incomplete
if not exist "%~dp0startup_check.py" goto incomplete
if not exist "%~dp0create_shortcuts.py" goto incomplete
if not exist "%~dp0run_bridge.py" goto incomplete

echo Looking for Python 3.11 or 3.12. Please wait...
if not "%~1"=="" call :try_executable "%~1"
if defined NAFASYAR_PYTHON goto install
call :try_launcher -3.12
call :try_launcher -3.11
if defined NAFASYAR_PYTHON goto install

for %%V in (312 311) do call :try_executable "%LOCALAPPDATA%\Programs\Python\Python%%V\python.exe"
for %%V in (312 311) do call :try_executable "%ProgramFiles%\Python%%V\python.exe"
for %%V in (312 311) do call :try_executable "%ProgramFiles(x86)%\Python%%V\python.exe"
for %%V in (312 311) do call :try_executable "%SystemDrive%\Python%%V\python.exe"
for /d %%D in ("%LOCALAPPDATA%\Python\pythoncore-3.12*" "%LOCALAPPDATA%\Python\pythoncore-3.11*") do call :try_executable "%%~D\python.exe"
if defined NAFASYAR_PYTHON goto install

rem Read Python registration only. Never change the registry or system PATH.
for %%R in (HKCU HKLM) do for %%Z in (32 64) do for /f "tokens=1,2,*" %%A in ('reg query "%%R\Software\Python\PythonCore" /s /v ExecutablePath /reg:%%Z 2^>nul') do if /i "%%A"=="ExecutablePath" if /i "%%B"=="REG_SZ" call :try_executable "%%C"
if defined NAFASYAR_PYTHON goto install
for %%N in (python.exe python3.exe python3.12.exe python3.11.exe) do for /f "delims=" %%P in ('where %%N 2^>nul') do call :try_path_executable "%%P"
if defined NAFASYAR_PYTHON goto install

echo.
echo No compatible Python installation was detected. Details:
type "%NAFASYAR_INSTALL_LOG%"
echo.
echo Open README-fa.html for exact Python download links and instructions.
echo Send INSTALL-LOG.txt if you need help. Do not send accounting files.
start "" "%~dp0README-fa.html"
pause
exit /b 1

:try_launcher
if defined NAFASYAR_PYTHON exit /b 0
>> "%NAFASYAR_INSTALL_LOG%" echo Checking py %~1
py %~1 "%~dp0check_python.py" >> "%NAFASYAR_INSTALL_LOG%" 2>&1
if errorlevel 1 exit /b 0
set "NAFASYAR_PYTHON=py"
set "NAFASYAR_SELECTOR=%~1"
exit /b 0

:try_path_executable
rem Skip Microsoft Store aliases which can open a store instead of Python.
echo "%~1" | findstr /i /l /c:"\Microsoft\WindowsApps\" >nul
if not errorlevel 1 exit /b 0
goto try_executable

:try_executable
if defined NAFASYAR_PYTHON exit /b 0
if not exist "%~1" exit /b 0
>> "%NAFASYAR_INSTALL_LOG%" echo Checking "%~1"
"%~1" "%~dp0check_python.py" >> "%NAFASYAR_INSTALL_LOG%" 2>&1
if errorlevel 1 exit /b 0
set "NAFASYAR_PYTHON=%~1"
set "NAFASYAR_SELECTOR="
exit /b 0

:install
echo Compatible Python found. Installing Nafasyar Bridge...
"%NAFASYAR_PYTHON%" %NAFASYAR_SELECTOR% "%~dp0install.py"
if errorlevel 1 goto install_failed
echo.
echo Installation completed and the program window was confirmed.
 echo The application folder is also open; START.cmd runs the program.
pause
exit /b 0

:install_failed
echo.
echo Installation did not complete. Send INSTALL-LOG.txt for help.
echo Do not disable antivirus or Windows security.
pause
exit /b 1

:incomplete
echo Extract ALL files from the ZIP into a new folder, then run INSTALL.cmd there.
pause
exit /b 1

:log_failed
echo This folder cannot be written. Extract the ZIP to a folder under Downloads.
pause
exit /b 1
