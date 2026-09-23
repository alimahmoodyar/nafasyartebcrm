@echo off
setlocal EnableExtensions DisableDelayedExpansion
cd /d "%~dp0"
set "NAFASYAR_INSTALL_LOG=%~dp0INSTALL-LOG.txt"
set "NAFASYAR_PYTHON="
set "NAFASYAR_SELECTOR="
set "NAFASYAR_PROBE=%~dp0runtime-%RANDOM%-%RANDOM%.receipt"
set "NAFASYAR_COMPLETE=%~dp0install-%RANDOM%-%RANDOM%.receipt"
> "%NAFASYAR_INSTALL_LOG%" echo Nafasyar Bridge 0.2.4 installation diagnostics
if errorlevel 1 goto log_failed
if not exist "%~dp0check_python.py" goto incomplete
if not exist "%~dp0install.py" goto incomplete
if not exist "%~dp0startup_check.py" goto incomplete
if not exist "%~dp0create_shortcuts.py" goto incomplete
if not exist "%~dp0run_bridge.py" goto incomplete
if not exist "%~dp0diagnose.py" goto incomplete

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
echo If py reports No runtime installed, run: py install 3.12
echo Then run INSTALL.cmd again.
echo Open README-fa.html for instructions.
echo Send INSTALL-LOG.txt if you need help. Do not send accounting files.
start "" "%~dp0README-fa.html"
pause
exit /b 1

:try_launcher
if defined NAFASYAR_PYTHON exit /b 0
>> "%NAFASYAR_INSTALL_LOG%" echo Checking py %~1
if exist "%NAFASYAR_PROBE%" del /q "%NAFASYAR_PROBE%"
if exist "%NAFASYAR_PROBE%" exit /b 0
py %~1 "%~dp0check_python.py" --receipt "%NAFASYAR_PROBE%" >> "%NAFASYAR_INSTALL_LOG%" 2>&1
if errorlevel 1 exit /b 0
if not errorlevel 0 exit /b 0
if not exist "%NAFASYAR_PROBE%" exit /b 0
findstr /x /l /c:"NAFASYAR_PYTHON_READY_V1" "%NAFASYAR_PROBE%" >nul
if errorlevel 1 exit /b 0
if not errorlevel 0 exit /b 0
del /q "%NAFASYAR_PROBE%"
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
if exist "%NAFASYAR_PROBE%" del /q "%NAFASYAR_PROBE%"
if exist "%NAFASYAR_PROBE%" exit /b 0
"%~1" "%~dp0check_python.py" --receipt "%NAFASYAR_PROBE%" >> "%NAFASYAR_INSTALL_LOG%" 2>&1
if errorlevel 1 exit /b 0
if not errorlevel 0 exit /b 0
if not exist "%NAFASYAR_PROBE%" exit /b 0
findstr /x /l /c:"NAFASYAR_PYTHON_READY_V1" "%NAFASYAR_PROBE%" >nul
if errorlevel 1 exit /b 0
if not errorlevel 0 exit /b 0
del /q "%NAFASYAR_PROBE%"
set "NAFASYAR_PYTHON=%~1"
set "NAFASYAR_SELECTOR="
exit /b 0

:install
echo Compatible Python found. Installing Nafasyar Bridge...
if exist "%NAFASYAR_COMPLETE%" del /q "%NAFASYAR_COMPLETE%"
if exist "%NAFASYAR_COMPLETE%" goto install_failed
"%NAFASYAR_PYTHON%" %NAFASYAR_SELECTOR% "%~dp0install.py" --receipt "%NAFASYAR_COMPLETE%"
if errorlevel 1 goto install_failed
if not errorlevel 0 goto install_failed
if not exist "%NAFASYAR_COMPLETE%" goto install_failed
findstr /x /l /c:"NAFASYAR_INSTALL_OK_V1" "%NAFASYAR_COMPLETE%" >nul
if errorlevel 1 goto install_failed
if not errorlevel 0 goto install_failed
del /q "%NAFASYAR_COMPLETE%"
echo Use OPEN.cmd to open the installed program again.
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
