@echo off
echo Starting Ionic Development Server with ngrok tunnel...

echo.
echo Step 1: Starting Ionic serve in background...
start /B ionic serve

echo.
echo Waiting 10 seconds for Ionic server to start...
timeout /t 10 /nobreak > nul

echo.
echo Step 2: Starting ngrok tunnel...
.\ngrok.exe start --config .\ngrok.yml ionic-dev

pause