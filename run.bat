@echo off
title College Website Server
cd /d "%~dp0"

echo =======================================================
echo     Starting College Website & Admin Portal...
echo =======================================================
echo.
echo Website Link:      http://localhost:5000
echo Admin Portal Link: http://localhost:5000/admin/login.html
echo.
echo Opening links in your default browser...
echo.

:: Automatically open the website and admin portal in browser after 2 seconds
start "" cmd /c "timeout /t 2 /nobreak >nul && start http://localhost:5000 && start http://localhost:5000/admin/login.html"

:: Start the Express Node.js server
node server.js

pause
