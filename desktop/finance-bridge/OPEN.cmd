@echo off
setlocal EnableExtensions DisableDelayedExpansion
set "NAFASYAR_FOLDER=%LOCALAPPDATA%\NafasyarBridge\0.2.4"
if not exist "%NAFASYAR_FOLDER%\START.cmd" goto missing
call "%NAFASYAR_FOLDER%\START.cmd"
exit /b %errorlevel%
:missing
echo Nafasyar Bridge 0.2.4 is not installed for this Windows user.
echo Run INSTALL.cmd from this extracted package first.
pause
exit /b 1
