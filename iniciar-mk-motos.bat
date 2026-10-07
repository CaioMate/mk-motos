@echo off
chcp 65001 >nul
title MK MOTOS - Servidor
cd /d "%~dp0"

where node >nul 2>nul
if errorlevel 1 (
  echo Node.js nao encontrado. Instale em https://nodejs.org ^(versao 22 ou mais nova^).
  pause
  exit /b 1
)

if not exist node_modules (
  echo Instalando dependencias pela primeira vez...
  call npm install
)

echo Preparando o sistema...
call npm start
pause
