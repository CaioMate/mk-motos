#!/usr/bin/env bash
# =============================================================================
#  MK MOTOS - backup diário (roda sozinho às 03:00 pelo agendador do Linux)
#
#  Teste manual (na VPS, como administrador):
#      sudo bash /opt/mk-motos/deploy/backup.sh
#
#  Guarda os backups em /opt/mk-motos-backups/AAAA-MM-DD/ e apaga os com mais
#  de 14 dias. NÃO para o sistema: o banco é copiado com o comando .backup do
#  SQLite, que faz a cópia com segurança mesmo com o sistema em uso.
#
#  Regra de segurança: o SQLite roda como o usuário 'mkmotos' (o mesmo do
#  sistema). Assim nenhum arquivo do banco é criado com dono 'root' na pasta
#  de dados. A cópia é feita numa pasta temporária e só vai para o destino
#  depois de passar na verificação.
# =============================================================================

set -Eeuo pipefail

APP_DIR="/opt/mk-motos"
DATA_DIR="$APP_DIR/data"
N8N_DIR="/opt/mk-motos-n8n"
BACKUP_BASE="/opt/mk-motos-backups"
TMP_BASE="/var/lib/mk-motos-tmp"
DIAS_GUARDADOS=14
LOG="/var/log/mk-motos-backup.log"
USUARIO="mkmotos"
UID_N8N=1000   # o n8n roda com o usuário 'node', número 1000

log() {
  local linha="[$(date '+%d/%m/%Y %H:%M:%S')] $*"
  echo "$linha"
  echo "$linha" >> "$LOG"
}

TMP=""
TMP_N8N=""
limpar() {
  # Apaga só as cópias temporárias. O banco de verdade (data/) nunca é tocado aqui.
  if [ -n "$TMP" ]; then rm -rf "$TMP"; fi
  if [ -n "$TMP_N8N" ]; then rm -rf "$TMP_N8N"; fi
  return 0
}
trap limpar EXIT
trap 'log "ERRO na linha $LINENO. O backup de hoje ficou INCOMPLETO. Veja o log: $LOG"' ERR

if [ "$(id -u)" -ne 0 ]; then
  echo "Rode como administrador:  sudo bash $0"
  exit 1
fi

touch "$LOG"
chmod 600 "$LOG"

HOJE="$(date +%F)"
DEST="$BACKUP_BASE/$HOJE"
install -d -m 700 -o root -g root "$BACKUP_BASE"
install -d -m 700 -o root -g root "$DEST"
install -d -m 755 -o root -g root "$TMP_BASE"
log "Iniciando backup em $DEST"

# 1) Banco de dados: copiado como o usuário do sistema, numa pasta temporária
if [ -f "$DATA_DIR/mkmotos.db" ]; then
  TMP="$(mktemp -d "$TMP_BASE/copia-XXXXXX")"
  chown "$USUARIO:$USUARIO" "$TMP"
  chmod 700 "$TMP"

  runuser -u "$USUARIO" -- sqlite3 "$DATA_DIR/mkmotos.db" ".backup '$TMP/mkmotos.db'"
  # Junta tudo num arquivo só (sem -wal/-shm soltos na cópia)
  runuser -u "$USUARIO" -- sqlite3 "$TMP/mkmotos.db" "PRAGMA journal_mode=DELETE;" >/dev/null
  integridade="$(runuser -u "$USUARIO" -- sqlite3 "$TMP/mkmotos.db" 'PRAGMA integrity_check;')"
  if [ "$integridade" != "ok" ]; then
    log "ERRO: a cópia do banco não passou na verificação ($integridade). Backup cancelado; o banco original não foi alterado."
    exit 1
  fi
  log "Banco copiado e verificado (integridade: ok)"
else
  log "Aviso: o banco ainda não existe em $DATA_DIR (normal na primeira instalação)."
fi

# 2) Fotos, comprovantes e o arquivo .env (as senhas e chaves ficam aqui)
itens=()
for item in data/fotos data/comprovantes .env; do
  if [ -e "$APP_DIR/$item" ]; then itens+=("$item"); fi
done
if [ "${#itens[@]}" -gt 0 ]; then
  tar -czf "$DEST/arquivos.tar.gz" -C "$APP_DIR" "${itens[@]}"
  chmod 600 "$DEST/arquivos.tar.gz"
  log "Fotos, comprovantes e .env salvos em arquivos.tar.gz"
fi

# 3) n8n (só se a pasta existir, ou seja, se o n8n foi instalado)
if [ -d "$N8N_DIR" ]; then
  if [ -f "$N8N_DIR/database.sqlite" ]; then
    TMP_N8N="$(mktemp -d "$TMP_BASE/n8n-XXXXXX")"
    chown "$UID_N8N:$UID_N8N" "$TMP_N8N"
    chmod 700 "$TMP_N8N"
    setpriv --reuid="$UID_N8N" --regid="$UID_N8N" --clear-groups \
      sqlite3 "$N8N_DIR/database.sqlite" ".backup '$TMP_N8N/database.sqlite'"
    setpriv --reuid="$UID_N8N" --regid="$UID_N8N" --clear-groups \
      sqlite3 "$TMP_N8N/database.sqlite" "PRAGMA journal_mode=DELETE;" >/dev/null
    mv -f "$TMP_N8N/database.sqlite" "$DEST/n8n-database.sqlite"
  fi
  tar -czf "$DEST/n8n-dados.tar.gz" --exclude='*database.sqlite*' -C "$N8N_DIR" .
  chmod 600 "$DEST/n8n-dados.tar.gz"
  log "Dados do n8n salvos"
fi

# 4) Mover a cópia verificada para o destino (com dono root, permissões fechadas)
# (só entra aqui se a pasta temporária existir: nunca mexer em "/*" por engano)
if [ -n "$TMP" ] && [ -d "$TMP" ]; then
  for arq in "$TMP"/*; do
    if [ -f "$arq" ]; then mv -f "$arq" "$DEST/"; fi
  done
fi
if [ -f "$DEST/mkmotos.db" ]; then chown "$USUARIO:$USUARIO" "$DEST/mkmotos.db"; fi
if [ -f "$DEST/n8n-database.sqlite" ]; then chown "$UID_N8N:$UID_N8N" "$DEST/n8n-database.sqlite"; fi
find "$DEST" -type f -exec chmod 600 {} +
chmod 700 "$DEST"

# 5) Apagar backups mais antigos que o prazo (só pastas com data AAAA-MM-DD)
CORTE="$(date -d "$((DIAS_GUARDADOS - 1)) days ago" +%F)"
for pasta in "$BACKUP_BASE"/*/; do
  if [ ! -d "$pasta" ]; then continue; fi
  nome="$(basename "$pasta")"
  if [[ "$nome" =~ ^[0-9]{4}-[0-9]{2}-[0-9]{2}$ ]] && [[ "$nome" < "$CORTE" ]]; then
    rm -rf "$pasta"
    log "Backup antigo apagado (mais de $DIAS_GUARDADOS dias): $nome"
  fi
done

tamanho="$(du -sh "$DEST" | cut -f1)"
log "Backup concluído: $DEST (tamanho: $tamanho)"
