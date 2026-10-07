@echo off
chcp 65001 >nul
title MK MOTOS - Tunel para o WhatsApp
:: Cria um endereco HTTPS na internet apontando para o sistema (porta 8000),
:: para a Meta entregar as mensagens do WhatsApp. Pela internet so o webhook
:: e o GPS respondem; o painel continua acessivel apenas na rede local.

where cloudflared >nul 2>nul
if errorlevel 1 (
  echo Instalando o Cloudflare Tunnel ^(cloudflared^)...
  winget install --id Cloudflare.cloudflared -e --accept-source-agreements --accept-package-agreements
  echo.
  echo Instalado. Feche esta janela e abra o tunel-whatsapp.bat de novo.
  pause
  exit /b
)

echo.
echo Procure abaixo um endereco https://....trycloudflare.com
echo Na Meta use:  https://ENDERECO/api/whatsapp/webhook
echo ATENCAO: este endereco muda toda vez que o tunel e aberto ^(atualize na Meta^).
echo Para um endereco fixo, crie um tunel nomeado na sua conta Cloudflare.
echo.
cloudflared tunnel --url http://localhost:8000
pause
