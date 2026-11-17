@echo off
rem Liga tudo o que o modo Netflix precisa: addon, Stremio Service e Stremio Enhanced.
rem Pode clicar de novo sem problema: o que ja estiver aberto nao abre duas vezes.
title Streaming Modes
cd /d "%~dp0addon"

rem 1) Addon (porta 7100), em uma janela minimizada
netstat -ano | findstr ":7100 " | findstr LISTENING >nul
if errorlevel 1 (
  echo Ligando o addon...
  start "Streaming Modes - addon (pode minimizar, nao feche)" /min node --env-file-if-exists=.env server.js
) else (
  echo Addon ja esta rodando.
)

rem 2) Stremio Service (necessario para assistir)
tasklist /fi "imagename eq stremio-service.exe" | findstr /i stremio-service.exe >nul
if errorlevel 1 (
  echo Ligando o Stremio Service...
  start "" "%LOCALAPPDATA%\Programs\StremioService\stremio-service.exe"
) else (
  echo Stremio Service ja esta rodando.
)

rem 3) Stremio Enhanced (onde o plugin roda)
timeout /t 3 /nobreak >nul
echo Abrindo o Stremio Enhanced...
start "" "%LOCALAPPDATA%\Programs\stremio-enhanced\Stremio Enhanced.exe"
