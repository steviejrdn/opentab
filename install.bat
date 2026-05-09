@echo off
setlocal enabledelayedexpansion
title opentab Installer
cd /d "%~dp0"

echo ========================================
echo        opentab_ — One-Click Install
echo ========================================
echo.

REM ── Step 1: Check Python ──
echo [1/3] Checking Python...
python --version >nul 2>&1
if %errorlevel% neq 0 (
    echo [FAIL] Python is NOT installed.
    echo.
    echo Please download and install Python from:
    echo   https://python.org/downloads
    echo.
    echo IMPORTANT: Check "Add Python to PATH" during installation.
    start https://python.org/downloads
    pause
    exit /b 1
)
for /f "delims=" %%i in ('python --version 2^>^&1') do echo [OK] %%i

REM ── Step 2: Check Git ──
echo [2/3] Checking Git...
git --version >nul 2>&1
if %errorlevel% neq 0 (
    echo [FAIL] Git is NOT installed.
    echo.
    echo Please download and install Git from:
    echo   https://git-scm.com/download/win
    start https://git-scm.com/download/win
    pause
    exit /b 1
)
for /f "delims=" %%i in ('git --version') do echo [OK] %%i

REM ── Step 3: Install / Update opentab ──
echo [3/3] Installing opentab...
echo.
pip install git+https://github.com/steviejrdn/opentab.git
if %errorlevel% neq 0 (
    echo.
    echo [FAIL] Installation failed. Check your internet connection.
    pause
    exit /b 1
)
echo [OK] opentab installed successfully.

REM ── Verify opentab command ──
echo.
echo Verifying installation...
where opentab >nul 2>&1
if %errorlevel% neq 0 (
    echo [WARN] 'opentab' command not found in PATH.
    echo        Using 'python -m opentab' as fallback.
    set "OPENTAB_CMD=python -m opentab"
) else (
    set "OPENTAB_CMD=opentab"
)

REM ── Create Desktop Shortcut ──
echo.
echo Creating desktop shortcut...
for /f "delims=" %%i in ('python -c "import opentab, os; print(os.path.dirname(opentab.__file__))"') do set "OPENTAB_DIR=%%i"
if defined OPENTAB_DIR (
    set "ICON=!OPENTAB_DIR!\static\opentab_icon.ico"
    if exist "!ICON!" (
        powershell -Command ^
            $ws = New-Object -ComObject WScript.Shell; ^
            $s = $ws.CreateShortcut('%USERPROFILE%\Desktop\opentab.lnk'); ^
            $s.TargetPath = '!OPENTAB_CMD!'; ^
            $s.WorkingDirectory = '%USERPROFILE%'; ^
            $s.IconLocation = '!ICON!'; ^
            $s.Save() > $null
        echo [OK] Shortcut created on your desktop with opentab icon.
    ) else (
        echo [WARN] Icon file not found at: !ICON!
        echo        Creating shortcut without icon.
        powershell -Command ^
            $ws = New-Object -ComObject WScript.Shell; ^
            $s = $ws.CreateShortcut('%USERPROFILE%\Desktop\opentab.lnk'); ^
            $s.TargetPath = '!OPENTAB_CMD!'; ^
            $s.WorkingDirectory = '%USERPROFILE%'; ^
            $s.Save() > $null
        echo [OK] Shortcut created on your desktop.
    )
) else (
    echo [WARN] Could not determine opentab install path. Skipping shortcut.
)

REM ── Launch opentab (auto-restart loop) ──
echo.
echo ========================================
echo  Starting opentab...
echo  Your browser will open automatically.
echo  Close this window to stop opentab.
echo ========================================
echo.
:loop
%OPENTAB_CMD% --port 8001
echo [INFO] opentab closed. Auto-restarting in 3 seconds...
timeout /t 3 >nul
goto loop
