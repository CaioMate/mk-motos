#!/usr/bin/env bash
# =============================================================================
#  MK MOTOS - atualizar para a versão mais nova do GitHub
#
#  COMO USAR (na VPS, como administrador):
#      sudo bash /opt/mk-motos/deploy/atualizar.sh
#
#  Ordem: 1) cópia de segurança  2) baixa o código  3) instala programas
#         4) monta o site numa pasta temporária  5) troca o site só se deu certo
#         6) reinicia o sistema (só se tudo acima deu certo)
#
#  Não apaga dados (banco, fotos, comprovantes) nem o arquivo .env.
#  Se o Caddyfile.modelo ou o serviço mudarem, rode também o instalar.sh.
# =============================================================================

set -Eeuo pipefail

APP_DIR="/opt/mk-motos"
USUARIO="mkmotos"
CACHE_NPM="/var/cache/mk-motos-npm"

passo() { echo; echo "=== $* ==="; }
falha() { echo; echo "[ERRO] $*" >&2; exit 1; }
trap 'echo; echo "[ERRO] A atualização parou na linha $LINENO. Veja as mensagens acima." >&2' ERR

if [ "$(id -u)" -ne 0 ]; then
  falha "Rode como administrador:  sudo bash $0"
fi

passo "1/6 Cópia de segurança antes de atualizar"
bash "$APP_DIR/deploy/backup.sh" \
  || falha "A cópia de segurança falhou, então a atualização foi CANCELADA. Nada foi trocado. Veja: /var/log/mk-motos-backup.log"
echo "  [ok] cópia feita"

passo "2/6 Baixando a versão nova do GitHub"
runuser -u "$USUARIO" -- env HOME="$APP_DIR" GIT_TERMINAL_PROMPT=0 git -C "$APP_DIR" pull --ff-only \
  || falha "Não consegui baixar a atualização. O sistema NÃO foi reiniciado. Veja a mensagem acima."

passo "3/6 Instalando programas novos (se houver)"
runuser -u "$USUARIO" -- env HOME="$APP_DIR" npm_config_cache="$CACHE_NPM" \
  bash -c "cd '$APP_DIR' && npm ci --include=dev" >/dev/null \
  || falha "A instalação dos programas falhou. O sistema NÃO foi reiniciado (continua rodando a versão anterior). Veja a mensagem acima."
echo "  [ok] programas instalados"

passo "4/6 Montando o site novo numa pasta temporária"
# Monta em dist-novo: o site atual (dist/) continua intacto enquanto isso
runuser -u "$USUARIO" -- env HOME="$APP_DIR" npm_config_cache="$CACHE_NPM" \
  bash -c "cd '$APP_DIR' && rm -rf dist-novo && node_modules/.bin/vite build --outDir dist-novo --emptyOutDir" >/dev/null \
  || falha "A montagem do site falhou. O sistema NÃO foi reiniciado (continua rodando a versão anterior). Veja a mensagem acima."
if [ ! -f "$APP_DIR/dist-novo/index.html" ]; then
  falha "A montagem do site não gerou o arquivo principal. O sistema NÃO foi reiniciado."
fi
echo "  [ok] site novo montado"

passo "5/6 Trocando o site antigo pelo novo"
rm -rf "$APP_DIR/dist-antigo"
if [ -d "$APP_DIR/dist" ]; then mv "$APP_DIR/dist" "$APP_DIR/dist-antigo"; fi
mv "$APP_DIR/dist-novo" "$APP_DIR/dist"
rm -rf "$APP_DIR/dist-antigo"
echo "  [ok] site trocado"

passo "6/6 Reiniciando o sistema"
NODE_BIN="$(command -v node)"
sed "s|/usr/bin/node|$NODE_BIN|" "$APP_DIR/deploy/mk-motos.service" > /etc/systemd/system/mk-motos.service
systemctl daemon-reload
systemctl restart mk-motos
sleep 3
systemctl status mk-motos --no-pager -l | head -n 12 || true

echo
echo "Atualização terminada. Se o status acima estiver 'active (running)', está tudo certo."
echo "Se aparecer 'failed' ou 'activating', veja o motivo com:"
echo "    sudo journalctl -u mk-motos -n 50 --no-pager"
