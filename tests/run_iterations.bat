@echo off
setlocal enabledelayedexpansion

echo ======================================================
echo Starting Audio Latency Research Suite (12 Total Runs)
echo ======================================================

:: Ensure results directory exists
if not exist results mkdir results

:: Initialize the counter
set ITERATION=1

:test_loop
if %ITERATION% GTR 3 goto :end_all

echo.
echo **************************************************
echo *** STARTING MAJOR ITERATION %ITERATION% OF 3 ***
echo **************************************************

:: --- CONFIG 1: Direct No-CDN ---
echo [%time%] Running: Direct No-CDN (Iteration %ITERATION%)
call k6 run -e TEST_CONFIG=noCdn --out csv=results/direct_nocdn_%ITERATION%.csv direct.js
echo Finished. Cooling down for 120s...
timeout /t 120 /nobreak > nul

:: --- CONFIG 2: Direct CDN ---
echo [%time%] Running: Direct CDN (Iteration %ITERATION%)
call k6 run -e TEST_CONFIG=cdn --out csv=results/direct_cdn_%ITERATION%.csv direct.js
echo Finished. Cooling down for 120s...
timeout /t 120 /nobreak > nul

:: --- CONFIG 3: HLS No-CDN ---
echo [%time%] Running: HLS No-CDN (Iteration %ITERATION%)
call k6 run -e TEST_CONFIG=noCdn --out csv=results/hls_nocdn_%ITERATION%.csv hls.js
echo Finished. Cooling down for 120s...
timeout /t 120 /nobreak > nul

:: --- CONFIG 4: HLS CDN ---
echo [%time%] Running: HLS CDN (Iteration %ITERATION%)
call k6 run -e TEST_CONFIG=cdn --out csv=results/hls_cdn_%ITERATION%.csv hls.js

:: Increment counter
set /a ITERATION=%ITERATION%+1

:: Check if we need to wait before the next big loop
if %ITERATION% LEQ 3 (
    echo [%time%] Iteration complete. Waiting 120s before next Major Iteration...
    timeout /t 120 /nobreak > nul
    goto :test_loop
)

:end_all
echo.
echo ======================================================
echo All 12 test runs completed successfully.
echo Final datasets are in the \results folder.
echo ======================================================
pause