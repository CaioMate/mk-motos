#!/usr/bin/env bash
# =============================================================================
#  MK MOTOS - instalação automática na VPS (Ubuntu 24.04)
#
#  COMO USAR (dentro da VPS, como administrador):
#      sudo bash /opt/mk-motos/deploy/instalar.sh
#  Na primeira vez, veja o LEIA-ME.md: ele mostra como baixar este arquivo.
#
#  É seguro rodar de novo: ele só instala o que falta e atualiza o resto.
#  NÃO apaga banco de dados, fotos, comprovantes nem o arquivo .env.
# =============================================================================

set -Eeuo pipefail
export DEBIAN_FRONTEND=noninteractive
export NEEDRESTART_MODE=a   # impede o Ubuntu de fazer perguntas na tela

APP_DIR="/opt/mk-motos"
USUARIO="mkmotos"
REPO_PADRAO="https://github.com/CaioMate/mk-motos.git"
BACKUP_DIR="/opt/mk-motos-backups"
N8N_DIR="/opt/mk-motos-n8n"
APT="apt-get -o DPkg::Lock::Timeout=300 -y"

# ---------------------------------------------------------------- mensagens
passo()  { echo; echo "=== $* ==="; }
ok()     { echo "  [ok] $*"; }
aviso()  { echo "  [atenção] $*"; }
falha()  { echo; echo "  [ERRO] $*" >&2; exit 1; }
trap 'echo; echo "  [ERRO] A instalação parou na linha $LINENO. Copie as últimas mensagens e peça ajuda." >&2' ERR

# ---------------------------------------------------------------- funções auxiliares
apt_instalar() { $APT install --no-install-recommends "$@" >/dev/null; }

perguntar() { # $1 = texto da pergunta; devolve a resposta (vazia se só apertar ENTER)
  local resp=""
  if [ -r /dev/tty ]; then read -r -p "$1" resp < /dev/tty || true; fi
  echo "$resp"
}

normalizar() { echo "$1" | tr -d ' ' | tr '[:upper:]' '[:lower:]'; }

dominio_valido() { [[ "$1" =~ ^([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}$ ]]; }

# Lê o valor de uma variável do .env (vazio se não existir).
# Tira o fim de linha do Windows (\r) e aspas em volta do valor, se alguém tiver colocado.
valor_do_env() {
  grep -m1 "^$1=" "$APP_DIR/.env" 2>/dev/null | cut -d= -f2- | tr -d '\r' \
    | sed -e 's/^"\(.*\)"$/\1/' -e "s/^'\(.*\)'\$/\1/" || true
}

# Oracle Cloud: a máquina responde no endereço interno de informações (169.254.169.254).
# Fora da Oracle esse endereço não responde e a função devolve "não".
e_oracle() {
  local codigo
  codigo="$(curl -s -m 3 -o /dev/null -w '%{http_code}' -H 'Authorization: Bearer Oracle' \
    http://169.254.169.254/opc/v2/instance/ 2>/dev/null || true)"
  [ "$codigo" = "200" ]
}

# Abre 80 e 443 no iptables (e no ip6tables, se tiver regra de bloqueio). Não repete regra que já existe.
liberar_portas_iptables() { # $1 = iptables ou ip6tables
  command -v "$1" >/dev/null 2>&1 || return 0
  local regras
  regras="$("$1" -S INPUT 2>/dev/null || true)"
  case "$regras" in
    *"-j REJECT"*) ;;
    *) return 0 ;;
  esac
  for porta in 80 443; do
    if ! "$1" -C INPUT -p tcp --dport "$porta" -j ACCEPT 2>/dev/null; then
      "$1" -I INPUT 1 -p tcp --dport "$porta" -j ACCEPT
    fi
  done
  ok "$1: portas 80 e 443 liberadas antes do bloqueio"
}

# Troca a linha CHAVE=valor no .env (ou cria a linha se não existir)
definir_no_env() {
  local chave="$1" valor="$2" arq="$APP_DIR/.env"
  if grep -q "^${chave}=" "$arq"; then
    sed -i "s|^${chave}=.*|${chave}=${valor}|" "$arq"
  else
    printf '%s=%s\n' "$chave" "$valor" >> "$arq"
  fi
}

# ---------------------------------------------------------------- verificações iniciais
if [ "$(id -u)" -ne 0 ]; then
  falha "Este script precisa de permissão de administrador. Rode assim:  sudo bash $0"
fi

if [ -r /etc/os-release ]; then . /etc/os-release; fi
if [ "${ID:-}" != "ubuntu" ]; then
  aviso "Este script foi feito para Ubuntu 24.04. Seu sistema é '${ID:-desconhecido}'. Vou tentar continuar."
fi

# ---------------------------------------------------------------- 1) perguntas
passo "1/9 Algumas perguntas (ENTER aceita o que estiver entre parênteses)"

# Domínio principal (obrigatório)
DOMINIO="$(normalizar "${MK_DOMINIO:-}")"
while ! dominio_valido "$DOMINIO"; do
  [ -n "$DOMINIO" ] && echo "  Domínio inválido: '$DOMINIO'. Exemplo certo: mkmotos.com.br (sem http:// e sem barra)."
  if [ ! -r /dev/tty ]; then falha "Informe o domínio com:  MK_DOMINIO=seudominio.com.br sudo -E bash $0"; fi
  DOMINIO="$(normalizar "$(perguntar 'Domínio do sistema (ex.: mkmotos.com.br): ')")"
done

# Domínio do n8n (opcional: ENTER = não instalar o n8n)
DOMINIO_N8N="$(normalizar "${MK_DOMINIO_N8N:-}")"
if [ -z "$DOMINIO_N8N" ] && [ -r /dev/tty ] && [ -z "${MK_DOMINIO_N8N+x}" ]; then
  DOMINIO_N8N="$(normalizar "$(perguntar 'Domínio do n8n (ex.: n8n.mkmotos.com.br) ou ENTER para NÃO instalar o n8n: ')")"
fi
if [ -n "$DOMINIO_N8N" ]; then
  while ! dominio_valido "$DOMINIO_N8N" || [ "$DOMINIO_N8N" = "$DOMINIO" ]; do
    echo "  Domínio do n8n inválido ou igual ao do sistema. Exemplo: n8n.mkmotos.com.br"
    DOMINIO_N8N="$(normalizar "$(perguntar 'Domínio do n8n (ENTER para não instalar): ')")"
    [ -z "$DOMINIO_N8N" ] && break
  done
fi

# Endereço do código no GitHub (padrão já vem preenchido)
REPO="${MK_REPO:-}"
if [ -z "$REPO" ] && [ -r /dev/tty ]; then
  REPO="$(perguntar "Endereço do repositório GitHub (ENTER = $REPO_PADRAO): ")"
fi
REPO="${REPO:-$REPO_PADRAO}"

echo
echo "  Sistema: https://$DOMINIO"
if [ -n "$DOMINIO_N8N" ]; then echo "  n8n:     https://$DOMINIO_N8N"; else echo "  n8n:     não será instalado"; fi
echo "  Código:  $REPO"

# ---------------------------------------------------------------- 2) pacotes básicos
passo "2/9 Atualizando a lista de programas e instalando o básico"
apt-get -o DPkg::Lock::Timeout=300 update >/dev/null
apt_instalar ca-certificates curl gnupg git sqlite3 openssl util-linux
ok "pacotes básicos instalados"

if timedatectl set-timezone America/Sao_Paulo 2>/dev/null; then
  systemctl restart cron
  ok "fuso horário ajustado para Brasília (America/Sao_Paulo); agendador (cron) reiniciado"
fi

# ---------------------------------------------------------------- 3) Node.js 24
passo "3/9 Node.js 24"
if command -v node >/dev/null 2>&1 && [ "$(node -p 'process.versions.node.split(".")[0]')" -ge 24 ]; then
  ok "Node.js $(node -v) já instalado"
else
  install -d -m 0755 /etc/apt/keyrings
  curl -fsSL https://deb.nodesource.com/gpgkey/nodesource-repo.gpg.key \
    | gpg --batch --yes --dearmor -o /etc/apt/keyrings/nodesource.gpg
  echo "deb [signed-by=/etc/apt/keyrings/nodesource.gpg] https://deb.nodesource.com/node_24.x nodistro main" \
    > /etc/apt/sources.list.d/nodesource.list
  apt-get -o DPkg::Lock::Timeout=300 update >/dev/null
  apt_instalar nodejs
  ok "Node.js $(node -v) instalado"
fi

# ---------------------------------------------------------------- 4) Caddy (HTTPS)
passo "4/9 Caddy (cuida do site com cadeado / HTTPS)"
if command -v caddy >/dev/null 2>&1; then
  ok "Caddy já instalado"
else
  curl -fsSL https://dl.cloudsmith.io/public/caddy/stable/gpg.key \
    | gpg --batch --yes --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
  curl -fsSL https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt \
    -o /etc/apt/sources.list.d/caddy-stable.list
  apt-get -o DPkg::Lock::Timeout=300 update >/dev/null
  apt_instalar caddy
  ok "Caddy instalado"
fi

# ---------------------------------------------------------------- 5) firewall
passo "5/9 Firewall: libera SSH (22), site (80) e HTTPS (443)"
regras_input_v4="$(iptables -S INPUT 2>/dev/null || true)"
if e_oracle || [[ "$regras_input_v4" == *"-j REJECT"* ]]; then
  # Oracle (ou máquina com regra de bloqueio no iptables): NÃO usar ufw, para não brigar com o iptables.
  ok "máquina com iptables (Oracle): o ufw NÃO será usado"
  liberar_portas_iptables iptables
  liberar_portas_iptables ip6tables
  apt_instalar iptables-persistent netfilter-persistent
  netfilter-persistent save >/dev/null
  ok "regras salvas: continuam valendo depois de reiniciar a VPS"
else
  apt_instalar ufw
  ufw allow 22/tcp >/dev/null
  ufw allow 80/tcp >/dev/null
  ufw allow 443/tcp >/dev/null
  ufw --force enable >/dev/null
  ok "ufw ativo: portas 22, 80 e 443 liberadas"
fi

# ---------------------------------------------------------------- 6) usuário e código
passo "6/9 Usuário do sistema e pasta do programa ($APP_DIR)"
if ! id -u "$USUARIO" >/dev/null 2>&1; then
  useradd --system --home-dir "$APP_DIR" --shell /usr/sbin/nologin "$USUARIO"
  ok "usuário '$USUARIO' criado (sem senha de login, só para rodar o sistema)"
fi

if [ -d "$APP_DIR/.git" ]; then
  runuser -u "$USUARIO" -- env HOME="$APP_DIR" GIT_TERMINAL_PROMPT=0 git -C "$APP_DIR" pull --ff-only \
    || falha "Não consegui atualizar o código pelo GitHub. Veja a mensagem acima. Se o repositório for privado, ele precisa ser público ou ter acesso configurado."
  ok "código atualizado pelo GitHub"
else
  if [ -d "$APP_DIR" ] && [ -n "$(ls -A "$APP_DIR" 2>/dev/null || true)" ]; then
    falha "A pasta $APP_DIR já existe, mas não é uma cópia do programa. Não vou mexer nela. Peça ajuda."
  fi
  GIT_TERMINAL_PROMPT=0 git clone "$REPO" "$APP_DIR" \
    || falha "Não consegui baixar o código do GitHub ($REPO). Confira o endereço e se o repositório é público."
  ok "código baixado para $APP_DIR"
fi
install -d -m 0755 -o "$USUARIO" -g "$USUARIO" "$APP_DIR/data"
chown -R "$USUARIO:$USUARIO" "$APP_DIR"

# ---------------------------------------------------------------- 7) instalar e montar o sistema
passo "7/9 Instalando e montando o sistema (pode levar de 3 a 10 minutos)"
install -d -m 0755 -o "$USUARIO" -g "$USUARIO" /var/cache/mk-motos-npm
# --include=dev: o build do site precisa das ferramentas de desenvolvimento
runuser -u "$USUARIO" -- env HOME="$APP_DIR" npm_config_cache=/var/cache/mk-motos-npm \
  bash -c "cd '$APP_DIR' && npm ci --include=dev && npm run build" >/dev/null
ok "programas instalados e site montado (pasta dist/)"

# ---------------------------------------------------------------- 8) arquivo .env
passo "8/9 Arquivo de configuração (.env) e serviço"
if [ ! -f "$APP_DIR/.env" ]; then
  cp "$APP_DIR/.env.example" "$APP_DIR/.env"
  ok "arquivo .env criado a partir do modelo"
else
  ok "arquivo .env já existe: não será substituído, só completo o que falta"
fi
chown "$USUARIO:$USUARIO" "$APP_DIR/.env"
chmod 600 "$APP_DIR/.env"

# Configurações obrigatórias desta instalação
definir_no_env HOST 127.0.0.1
definir_no_env PORT 8000
definir_no_env PROXY_LOCAL 1
definir_no_env NODE_ENV production

# Segredos aleatórios: só são criados se estiverem vazios (nunca troca um valor que já existe)
for chave in SESSAO_SEGREDO GPS_TOKEN CRON_SECRET; do
  if [ -z "$(valor_do_env "$chave")" ]; then
    definir_no_env "$chave" "$(openssl rand -hex 32)"
    ok "segredo $chave gerado automaticamente"
  fi
done

# Serviço do sistema (liga sozinho quando a VPS reinicia)
NODE_BIN="$(command -v node)"
sed "s|/usr/bin/node|$NODE_BIN|" "$APP_DIR/deploy/mk-motos.service" > /etc/systemd/system/mk-motos.service
systemctl daemon-reload
systemctl enable mk-motos >/dev/null
ok "serviço 'mk-motos' instalado"

# Senha do painel: sem ela o sistema não sobe quando está atrás do Caddy (por segurança)
senha="$(valor_do_env SENHA_PAINEL)"
if [ "${#senha}" -ge 10 ]; then
  systemctl restart mk-motos
  ok "sistema iniciado"
else
  systemctl stop mk-motos 2>/dev/null || true
  aviso "o sistema NÃO foi iniciado ainda: falta SENHA_PAINEL com 10 caracteres ou mais no .env."
fi

# Caddy: gera o Caddyfile a partir do modelo
tmp_caddy="$(mktemp)"
cp "$APP_DIR/deploy/Caddyfile.modelo" "$tmp_caddy"
if [ -n "$DOMINIO_N8N" ]; then
  sed -i -e 's|{\$DOMINIO_N8N}|'"$DOMINIO_N8N"'|g' "$tmp_caddy"
else
  sed -i '/# --- n8n inicio/,/# --- n8n fim/d' "$tmp_caddy"
fi
sed -i -e 's|{\$DOMINIO}|'"$DOMINIO"'|g' "$tmp_caddy"
caddy validate --config "$tmp_caddy" --adapter caddyfile >/dev/null 2>&1 \
  || falha "O Caddyfile gerado tem erro. Confira o domínio digitado."
if [ -f /etc/caddy/Caddyfile ]; then
  cp /etc/caddy/Caddyfile "/etc/caddy/Caddyfile.antes-$(date +%Y%m%d-%H%M%S)"
fi
install -m 0644 "$tmp_caddy" /etc/caddy/Caddyfile
rm -f "$tmp_caddy"
systemctl enable caddy >/dev/null
systemctl restart caddy
ok "Caddy configurado para $DOMINIO${DOMINIO_N8N:+ e $DOMINIO_N8N}"

# Backup diário às 03:00 (horário de Brasília)
chmod 755 "$APP_DIR/deploy/backup.sh" "$APP_DIR/deploy/atualizar.sh"
install -d -m 0700 "$BACKUP_DIR"
cat > /etc/cron.d/mk-motos-backup <<'EOF'
# Backup diário do MK Motos, todo dia às 03:00 (horário de Brasília). Criado pelo instalar.sh.
0 3 * * * root bash /opt/mk-motos/deploy/backup.sh
EOF
chmod 644 /etc/cron.d/mk-motos-backup
ok "backup diário agendado para 03:00 (guarda 14 dias em $BACKUP_DIR)"

# ---------------------------------------------------------------- 9) n8n (opcional)
if [ -n "$DOMINIO_N8N" ]; then
  passo "9/9 n8n (automações) com Docker"
  if ! command -v docker >/dev/null 2>&1; then
    apt_instalar docker.io docker-compose-v2
  fi
  systemctl enable --now docker >/dev/null
  # O n8n roda com o usuário 'node' (número 1000): a pasta de dados precisa ser dele
  install -d -m 0700 -o 1000 -g 1000 "$N8N_DIR"
  printf 'N8N_DOMINIO=%s\nN8N_DADOS=%s\n' "$DOMINIO_N8N" "$N8N_DIR" > "$APP_DIR/deploy/n8n/.env"
  chmod 600 "$APP_DIR/deploy/n8n/.env"
  docker compose -f "$APP_DIR/deploy/n8n/docker-compose.yml" up -d
  ok "n8n iniciado (na primeira abertura você cria o usuário dono)"
else
  passo "9/9 n8n"
  ok "n8n não foi pedido: nada a fazer"
fi

# ---------------------------------------------------------------- teste e resumo final
sleep 3
codigo_local="$(curl -s -o /dev/null -w '%{http_code}' http://127.0.0.1:8000/ || true)"

faltando=()
for v in SENHA_PAINEL SUPABASE_URL SUPABASE_SERVICE_ROLE_KEY WHATSAPP_TOKEN WHATSAPP_PHONE_NUMBER_ID WHATSAPP_VERIFY_TOKEN WHATSAPP_APP_SECRET; do
  if [ -z "$(valor_do_env "$v")" ]; then faltando+=("$v"); fi
done

echo
echo "============================================================"
echo "  INSTALAÇÃO TERMINADA"
echo "============================================================"
echo "  Site do sistema:  https://$DOMINIO"
if [ -n "$DOMINIO_N8N" ]; then echo "  Site do n8n:      https://$DOMINIO_N8N"; fi
echo "  Teste interno do sistema: código $codigo_local (200 = funcionando)"
echo
echo "  O QUE VOCÊ PRECISA PREENCHER no arquivo .env:"
echo "    sudo nano $APP_DIR/.env"
if [ "${#faltando[@]}" -gt 0 ]; then
  for v in "${faltando[@]}"; do echo "    - $v (vazio)"; done
else
  echo "    (nada obrigatório faltando)"
fi
if [ "${#senha}" -lt 10 ]; then echo "    - SENHA_PAINEL precisa ter pelo menos 10 caracteres"; fi
echo
echo "  Depois de preencher, reinicie com:  sudo systemctl restart mk-motos"
echo "  Se o domínio ainda não aponta para esta VPS, o cadeado (HTTPS) só"
echo "  aparece depois que os registros A forem criados. O Caddy tenta sozinho."
echo "============================================================"
