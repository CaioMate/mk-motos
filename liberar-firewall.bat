@echo off
chcp 65001 >nul
:: Libera a porta 8000 no Firewall do Windows para acessar o MK MOTOS pela rede local.
:: Precisa ser executado como administrador (o script pede a permissao sozinho).

net session >nul 2>&1
if errorlevel 1 (
  powershell -Command "Start-Process '%~f0' -Verb RunAs"
  exit /b
)

netsh advfirewall firewall delete rule name="MK Motos (porta 8000)" >nul 2>&1
netsh advfirewall firewall add rule name="MK Motos (porta 8000)" dir=in action=allow protocol=TCP localport=8000 profile=private,public,domain
echo.
echo Porta 8000 liberada. Outros computadores e celulares da mesma rede ja podem acessar.
pause
