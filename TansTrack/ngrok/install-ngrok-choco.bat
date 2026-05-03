@echo off
echo Installing ngrok using Chocolatey...

echo.
echo Checking if Chocolatey is installed...
choco --version >nul 2>&1
if errorlevel 1 (
    echo Chocolatey is not installed. 
    echo Please install it from https://chocolatey.org/install
    echo Or use the download-ngrok.bat script instead.
    pause
    exit /b 1
)

echo.
echo Installing ngrok...
choco install ngrok -y

echo.
echo ngrok installed! You can now use 'ngrok' command from anywhere.
echo.
echo Next steps:
echo 1. Get your auth token from https://dashboard.ngrok.com/get-started/your-authtoken  
echo 2. Run: ngrok config add-authtoken YOUR_TOKEN
echo 3. Edit ngrok.yml and replace YOUR_AUTH_TOKEN with your actual token
echo.

pause