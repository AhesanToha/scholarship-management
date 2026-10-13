@echo off
cd /d "%~dp0"
if not exist "node_modules\esbuild" goto install
if not exist "node_modules\jsqr" goto install
goto run
:install
call npm.cmd install
if errorlevel 1 (
  echo Dependency installation failed. Check the error above.
  pause
  exit /b 1
)
:run
call npm.cmd start
pause
