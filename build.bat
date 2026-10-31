@echo off
title Build IL2CPPDUMPER STUDIO
cd /d "%~dp0"

echo =======================================================
echo   IL2CPPDUMPER STUDIO - UNIFIED BUILD SYSTEM
echo   C# .NET Engine + React Electron Desktop GUI
echo =======================================================
echo.

echo [1/3] Compiling C# Core Engine (.NET 8)...
call dotnet build engine/Il2CppDumper/Il2CppDumper.csproj -c Release
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] C# Engine compilation failed!
    pause
    exit /b %ERRORLEVEL%
)

echo.
echo [2/3] Compiling React TypeScript Frontend...
call npm run build:gui
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Frontend build failed!
    pause
    exit /b %ERRORLEVEL%
)

echo.
echo [3/3] Packaging Windows Standalone Application & Installer...
call npx electron-builder --win --dir
call npx electron-builder --win nsis
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Electron packaging failed!
    pause
    exit /b %ERRORLEVEL%
)

echo.
echo =======================================================
echo   BUILD COMPLETED SUCCESSFULLY!
echo   - Direct Executable: release\win-unpacked\Il2CppDumper-Studio.exe
echo   - Setup Installer:   release\Il2CppDumper-Studio Setup 6.8.0.exe
echo =======================================================
echo.
pause
