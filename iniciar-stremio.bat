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

rem 1b) O ffmpeg do Stremio Service vem sem as DLLs e nao roda; sem ele, audio Dolby (AC3/DDP/E-AC3)
rem     e DTS fica mudo no player. Copia as DLLs do Stremio normal, se estiver instalado. Se acabou de copiar,
rem     reinicia o servico para ele passar a usar o ffmpeg.
set "SVC=%LOCALAPPDATA%\Programs\StremioService"
set "DESK=%LOCALAPPDATA%\Programs\Stremio"
set "FIXED="
if exist "%DESK%vcodec-58.dll" if not exist "%SVC%vcodec-58.dll" (
  echo Corrigindo o ffmpeg do Stremio Service ^(audio Dolby^)...
  for %%D in (avcodec-58 avdevice-58 avfilter-7 avformat-58 avutil-56 postproc-55 swresample-3 swscale-5) do (
    if not exist "%SVC%\%%D.dll" copy /y "%DESK%\%%D.dll" "%SVC%\" >nul
  )
  set "FIXED=1"
  taskkill /f /im stremio-service.exe >nul 2>&1
  taskkill /f /im stremio-runtime.exe >nul 2>&1
  timeout /t 2 /nobreak >nul
)

rem 2) Stremio Service (necessario para assistir). Confere a porta 11470 e nao so o processo:
rem    as vezes o stremio-service.exe fica aberto com o servidor de streaming caido por dentro,
rem    e ai todo video da "Video is not supported". Nesse caso, reinicia o servico.
netstat -ano | findstr ":11470 " | findstr LISTENING >nul
if errorlevel 1 (
  taskkill /f /im stremio-service.exe >nul 2>&1
  taskkill /f /im stremio-runtime.exe >nul 2>&1
  echo Ligando o Stremio Service...
  start "" "%LOCALAPPDATA%\Programs\StremioService\stremio-service.exe"
  timeout /t 5 /nobreak >nul
) else (
  echo Stremio Service ja esta rodando.
)

rem 3) Stremio Enhanced (onde o plugin roda)
timeout /t 3 /nobreak >nul
echo Abrindo o Stremio Enhanced...
start "" "%LOCALAPPDATA%\Programs\stremio-enhanced\Stremio Enhanced.exe"
