@echo off
setlocal enabledelayedexpansion

:: Configuration
set "OUTPUT_DIR=.\client-metrics-nocdn"
set "INTERVAL=1"
:: 3.5 Hours approx
set "DURATION=14400"

if not exist "%OUTPUT_DIR%" mkdir "%OUTPUT_DIR%"
set "OUTPUT_FILE=%OUTPUT_DIR%\client-network-full.csv"

:: Header
echo timestamp,latency_ms,local_ip,connection_name > "%OUTPUT_FILE%"

echo Logging to %OUTPUT_FILE%
echo Interval: %INTERVAL%s, Duration: %DURATION%s

set /a COUNT=0
set /a MAX=%DURATION% / %INTERVAL%

:loop
if %COUNT% geq %MAX% goto :end

:: 1. Get Timestamp
set "TIMESTAMP=%date% %time%"

:: 2. Get local IP (Safe extraction)
set "LOCAL_IP=Unknown"
for /f "tokens=2 delims=:" %%a in ('ipconfig ^| findstr /i "IPv4" ^| findstr /v "192.168.137."') do (
    if "!LOCAL_IP!"=="Unknown" (
        set "temp_ip=%%a"
        set "LOCAL_IP=!temp_ip: =!"
    )
)

:: 3. Get active connection name (Improved parsing)
set "CONN_NAME=Unknown"
for /f "tokens=3,4*" %%a in ('netsh interface show interface ^| findstr "Connected"') do (
    if "!CONN_NAME!"=="Unknown" set "CONN_NAME=%%c"
)

:: 4. Measure latency (Reliable extraction using '=' and cleaning 'ms')
set "LATENCY=-1"
for /f "tokens=3 delims==" %%a in ('ping -n 1 -w 1000 audio-tests-gray.jayacode.tech ^| findstr /i "time="') do (
    for /f "tokens=1 delims=m " %%b in ("%%a") do (
        set "LATENCY=%%b"
    )
)

:: 5. Save to File
echo !TIMESTAMP!,!LATENCY!,!LOCAL_IP!,!CONN_NAME! >> "%OUTPUT_FILE%"

:: 6. Simple Progress Update (Removed the carriage return trick that causes hangs)
set /a COUNT+=1
set /a PERCENT=COUNT * 100 / MAX
echo [!PERCENT!%%] !COUNT!/!MAX! - Latency: !LATENCY!ms

:: Wait
timeout /t %INTERVAL% /nobreak >nul
goto :loop

:end
echo.
echo Complete. Results saved to: %OUTPUT_FILE%
pause
