@echo off
setlocal enabledelayedexpansion
title opentab - One-Click Install
cd /d "%~dp0"

echo ========================================
echo      opentab_ - One-Click Install
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
set "OPENTAB_EXE="
set "SHORTCUT_ARGS="
where opentab >nul 2>&1
if %errorlevel% equ 0 (
    for /f "delims=" %%i in ('where opentab 2^>nul') do if not defined OPENTAB_EXE set "OPENTAB_EXE=%%i"
    set "OPENTAB_CMD=opentab"
    set "SHORTCUT_ARGS=--port 8001"
    echo [OK] opentab found at: !OPENTAB_EXE!
) else (
    echo [WARN] 'opentab' command not found in PATH.
    echo        Using 'python -m opentab' as fallback.
    for /f "delims=" %%i in ('where python 2^>nul') do if not defined OPENTAB_EXE set "OPENTAB_EXE=%%i"
    set "SHORTCUT_ARGS=-m opentab --port 8001"
    set "OPENTAB_CMD=python -m opentab"
    echo [OK] python found at: !OPENTAB_EXE!
)

REM ── Find opentab package directory for icon ──
set "OPENTAB_DIR="
for /f "delims=" %%i in ('python -c "import opentab, os; print(os.path.dirname(opentab.__file__))" 2^>nul') do set "OPENTAB_DIR=%%i"

REM ── Create hidden launcher and Desktop Shortcut ──
echo.
echo Creating desktop shortcut...
if defined OPENTAB_EXE (
    if defined LOCALAPPDATA (
        set "LAUNCHER_DIR=!LOCALAPPDATA!\OpenTab"
        set "LAUNCHER_VBS=!LAUNCHER_DIR!\opentab_hidden_launcher.vbs"
        if not exist "!LAUNCHER_DIR!\" mkdir "!LAUNCHER_DIR!" >nul 2>&1
        if exist "!LAUNCHER_DIR!\" (
            REM Pass values through the environment so paths containing spaces or
            REM PowerShell metacharacters are not interpolated into the script.
            set "OPENTAB_LAUNCH_EXE=!OPENTAB_EXE!"
            set "OPENTAB_LAUNCH_ARGS=!SHORTCUT_ARGS!"
            set "OPENTAB_LAUNCHER=!LAUNCHER_VBS!"
            powershell -NoProfile -ExecutionPolicy Bypass -Command "$ErrorActionPreference='Stop'; $exe=$env:OPENTAB_LAUNCH_EXE; $argLine=$env:OPENTAB_LAUNCH_ARGS; $q=[string][char]34; $vbsExe=$exe.Replace($q,$q+$q); $vbsArgs=$argLine.Replace($q,$q+$q); $commandLine='commandLine = '+$q+$q+$q+$q+' & '+$q+$vbsExe+$q+' & '+$q+$q+$q+$q+' & '+$q+' '+$q+' & '+$q+$vbsArgs+$q; $lines=@('Option Explicit','Dim shell, commandLine, exitCode','Set shell = CreateObject('+$q+'WScript.Shell'+$q+')',$commandLine,'Do','    exitCode = shell.Run(commandLine, 0, True)','    WScript.Sleep 5000','Loop'); Set-Content -LiteralPath $env:OPENTAB_LAUNCHER -Value $lines -Encoding ASCII"
            if !errorlevel! neq 0 (
                echo [WARN] Could not create hidden launcher. Skipping shortcut.
            ) else (
                set "ICON="
                if defined OPENTAB_DIR set "ICON=!OPENTAB_DIR!\static\opentab_icon.ico"
                set "OPENTAB_LAUNCH_ICON=!ICON!"
                set "OPENTAB_LAUNCHER=!LAUNCHER_VBS!"
                powershell -NoProfile -Command "$ErrorActionPreference='Stop'; $d=[Environment]::GetFolderPath('Desktop'); $ws=New-Object -ComObject WScript.Shell; $s=$ws.CreateShortcut([IO.Path]::Combine($d,'opentab.lnk')); $s.TargetPath=(Join-Path $env:WINDIR 'System32\wscript.exe'); $s.Arguments='//nologo ' + [char]34 + $env:OPENTAB_LAUNCHER + [char]34; $s.WorkingDirectory=$d; if ($env:OPENTAB_LAUNCH_ICON -and (Test-Path -LiteralPath $env:OPENTAB_LAUNCH_ICON)) { $s.IconLocation=$env:OPENTAB_LAUNCH_ICON }; $s.Save(); exit 0"
                if !errorlevel! equ 0 (
                    if defined ICON (
                        if exist "!ICON!" (echo [OK] Shortcut created on your desktop with opentab icon.) else (echo [WARN] Shortcut created but icon may not display.)
                    ) else (
                        echo [OK] Shortcut created on your desktop.
                    )
                ) else (
                    echo [WARN] Could not create the desktop shortcut.
                )
            )
        ) else (
            echo [WARN] Could not create launcher directory. Skipping shortcut.
        )
    ) else (
        echo [WARN] LOCALAPPDATA is not set. Skipping shortcut.
    )
) else (
    echo [WARN] Could not find opentab or python executable. Skipping shortcut.
)

REM ── Launch opentab (auto-restart loop) ──
echo.
echo ========================================
echo  Starting opentab...
echo  Your browser will open automatically.
echo  Press Ctrl+C to stop opentab.
echo ========================================
echo.
:loop
echo [INFO] Starting opentab on port 8001...
%OPENTAB_CMD% --port 8001
if !errorlevel! neq 0 (
    echo.
    echo [ERROR] opentab exited with code !errorlevel!.
    echo          Check the output above for details.
    echo          Restarting in 5 seconds...
    timeout /t 5 >nul
    goto loop
)
echo [INFO] opentab stopped. Restarting in 5 seconds...
timeout /t 5 >nul
goto loop
