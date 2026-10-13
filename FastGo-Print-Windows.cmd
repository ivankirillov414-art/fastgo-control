@echo off
setlocal
title FastGo Print
set "FASTGO_CHROME="
if exist "%ProgramFiles%\Google\Chrome\Application\chrome.exe" set "FASTGO_CHROME=%ProgramFiles%\Google\Chrome\Application\chrome.exe"
if not defined FASTGO_CHROME if exist "%ProgramFiles(x86)%\Google\Chrome\Application\chrome.exe" set "FASTGO_CHROME=%ProgramFiles(x86)%\Google\Chrome\Application\chrome.exe"
if not defined FASTGO_CHROME if exist "%LOCALAPPDATA%\Google\Chrome\Application\chrome.exe" set "FASTGO_CHROME=%LOCALAPPDATA%\Google\Chrome\Application\chrome.exe"
if not defined FASTGO_CHROME (
 echo Google Chrome was not found. Install Chrome, then run this file again.
 pause
 exit /b 1
)
echo 1 - First setup: sign in and select your printer using the test page.
echo 2 - Start FastGo without print confirmation.
echo Close the previous FastGo Print window before switching modes.
choice /c 12 /n /m "Select 1 or 2: "
if errorlevel 2 (
 start "" "%FASTGO_CHROME%" --user-data-dir="%LOCALAPPDATA%\FastGoPrintProfile" --disable-background-mode --kiosk-printing --app="https://ivankirillov414-art.github.io/fastgo-control/print-station.html?silent=1"
) else (
 start "" "%FASTGO_CHROME%" --user-data-dir="%LOCALAPPDATA%\FastGoPrintProfile" --disable-background-mode --app="https://ivankirillov414-art.github.io/fastgo-control/print-station.html?setup=1"
)
endlocal
