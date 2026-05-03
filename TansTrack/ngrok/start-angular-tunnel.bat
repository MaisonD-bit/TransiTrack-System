@echo off
echo Starting Angular Development Server with ngrok tunnel...

echo.
echo Step 1: Starting Angular serve in background...
start /B ng serve

echo.
echo Waiting 15 seconds for Angular server to start...
timeout /t 15 /nobreak > nul

echo.
echo Step 2: Starting ngrok tunnel...
.\ngrok.exe start --config .\ngrok.yml angular-dev

pause