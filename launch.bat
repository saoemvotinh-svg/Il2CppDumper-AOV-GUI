@echo off
title IL2CPPDUMPER WORKSTATION
cd /d "%~dp0release\win-unpacked"

if not exist "Il2CppDumper-Studio.exe" (
    echo [ERROR] Il2CppDumper-Studio.exe not found!
    echo Please run build.bat first to compile and package the application.
    pause
    exit /b 1
)

start "" "Il2CppDumper-Studio.exe"
exit /b 0
