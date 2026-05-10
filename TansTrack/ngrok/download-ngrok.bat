@echo off
echo Downloading ngrok for Windows...

echo.
echo Creating download directory...
if not exist ".\download" mkdir ".\download"

echo.
echo Downloading ngrok.exe...
powershell -Command "& {Invoke-WebRequest -Uri 'https://bin.equinox.io/c/bNyj1mQVY4c/ngrok-v3-stable-windows-amd64.zip' -OutFile '.\download\ngrok.zip'}"

echo.
echo Extracting ngrok.exe...
powershell -Command "& {Expand-Archive -Path '.\download\ngrok.zip' -DestinationPath '.\' -Force}"

echo.
echo Cleaning up...
del ".\download\ngrok.zip"
rmdir ".\download"

echo.
echo ngrok.exe has been downloaded to this folder!
echo.
echo Next steps:
echo 1. Get your auth token from https://dashboard.ngrok.com/get-started/your-authtoken
echo 2. Run: ngrok.exe config add-authtoken YOUR_TOKEN
echo 3. Edit ngrok.yml and replace YOUR_AUTH_TOKEN with your actual token
echo.

pause