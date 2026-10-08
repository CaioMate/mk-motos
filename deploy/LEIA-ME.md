# MK Motos na internet 24 horas: passo a passo

Este guia coloca o sistema num computador que fica ligado o tempo todo na internet (chamado **VPS**).
Assim o sistema funciona mesmo com o seu PC desligado, e o GPS e o WhatsApp conseguem falar com ele.

---

## Antes de começar: o que você precisa

1. **Uma VPS** (o computador na nuvem). Escolha uma das duas opções abaixo.
2. **Um domínio**, por exemplo `mkmotos.com.br`. É o endereço do seu site.
3. **Um PC com Windows 11** para fazer a instalação.

### Quanto custa

| Item | Custo aproximado |
|---|---|
| Oracle Cloud (Always Free, ARM) | **R$ 0** enquanto ficar nos limites grátis da Oracle |
| Hostinger KVM 2 | Pago por mês. Confira o valor atual no site (costuma ter desconto no primeiro período) |
| Domínio .com.br | Cerca de R$ 40 por ano (valor pode mudar; compre no Registro.br ou no provedor de sua preferência) |

Dica: a Oracle é grátis, mas a conta exige cartão de crédito para verificação. Ela às vezes diz "sem capacidade" para
criar a máquina grátis. Se acontecer, tente de novo depois ou escolha a Hostinger.

---

## Passo 1A: criar a VPS na Oracle (grátis)

1. Entre em **cloud.oracle.com** e crie a conta.
2. No menu (≡) escolha **Compute** > **Instances** > **Create instance**.
3. Em **Image**, clique em **Change image** e escolha **Canonical Ubuntu 24.04**.
4. Em **Shape**, clique em **Change shape**, escolha **Ampere** e a opção **VM.Standard.A1.Flex**.
   Use 2 OCPU e 12 GB de memória (ou 1 OCPU e 6 GB, se quiser deixar parte grátis para outra coisa).
5. Em **SSH keys**, clique em **Generate a key pair for me** e **baixe as duas chaves**.
   Guarde o arquivo que termina em **.key** num lugar seguro (ex.: pasta Documentos). Sem ele você não entra na VPS.
6. Clique em **Create** e espere ficar verde ("Running"). Anote o **Public IP** (ex.: `150.230.10.25`).
7. **Liberar o site (obrigatório na Oracle):**
   - Na página da instância, clique no nome da **Virtual cloud network** (VCN).
   - Clique em **Security Lists** > **Default Security List**.
   - Clique em **Add Ingress Rules** e adicione duas regras: origem `0.0.0.0/0`, protocolo **TCP**, porta de destino **80**;
     depois outra igual com a porta **443**.
   - O instalador já cuida do firewall dentro da VPS, mas essa parte, da Oracle, precisa ser feita aqui.

## Passo 1B: criar a VPS na Hostinger (paga)

1. Entre em **hostinger.com.br**, vá em **VPS** e escolha o plano **KVM 2**.
2. Escolha o sistema **Ubuntu 24.04** (sem Docker pré-instalado, se der a opção).
3. Defina a senha do usuário **root** ou adicione sua chave SSH.
4. Quando a VPS estiver pronta, anote o **endereço IP** mostrado no painel.

---

## Passo 2: apontar o domínio para a VPS

No painel de onde você comprou o domínio (Registro.br, Hostinger, GoDaddy etc.), abra **Zona DNS** ou **Gerenciar DNS** e crie:

1. Registro do sistema:
   - Tipo: **A**
   - Nome: **@** (ou deixe em branco)
   - Valor: **o IP da VPS**
2. Registro do n8n (só se for usar o n8n):
   - Tipo: **A**
   - Nome: **n8n**
   - Valor: **o IP da VPS**

Pode levar de alguns minutos a algumas horas para valer. Para testar, abra o PowerShell e digite
`nslookup mkmotos.com.br`: quando aparecer o IP da VPS, está certo.

---

## Passo 3: entrar na VPS pelo Windows

1. Aperte a tecla **Windows**, digite **PowerShell** e abra.
2. Digite o comando abaixo (troque pelo IP da sua VPS) e aperte **Enter**:

   Na **Oracle** (usuário `ubuntu` e a chave que você baixou):
   ```
   ssh -i "C:\Users\moniq\Downloads\NOME-DA-CHAVE.key" ubuntu@IP-DA-VPS
   ```
   Na **Hostinger** (usuário `root` e a senha que você definiu):
   ```
   ssh root@IP-DA-VPS
   ```
3. Se perguntar "Are you sure you want to continue connecting", digite `yes` e Enter.
4. Quando pedir senha, digite e aperte Enter (a senha não aparece enquanto você digita; é normal).

Você está dentro da VPS quando o texto da linha mudar para algo como `ubuntu@servidor:~$`.
Para sair depois, digite `exit`.

Se aparecer "UNPROTECTED PRIVATE KEY FILE", mova o arquivo `.key` para `C:\Users\moniq\.ssh\` e rode o comando de novo com o novo caminho.

---

## Passo 4: instalar tudo (um comando só)

Dentro da VPS, copie e cole as duas linhas abaixo (uma de cada vez):

```
curl -fsSL https://raw.githubusercontent.com/CaioMate/mk-motos/main/deploy/instalar.sh -o instalar.sh
sudo bash instalar.sh
```

Na **Hostinger**, como você já entrou como `root`, não precisa do `sudo`: use `bash instalar.sh`.

O instalador vai perguntar:
1. **Domínio do sistema**: digite, por exemplo, `mkmotos.com.br` e Enter.
2. **Domínio do n8n**: digite `n8n.mkmotos.com.br` se quiser o n8n, ou só aperte **Enter** para não instalar.
3. **Endereço do repositório**: aperte **Enter** (já vem o certo).

Depois é só esperar (de 5 a 15 minutos). Ele mostra "[ok]" a cada etapa. No final, ele avisa o que falta preencher.

Para o instalador baixar o código, a versão atual precisa estar publicada no GitHub.

---

## Passo 5: preencher o arquivo de configuração (.env)

O arquivo `.env` guarda as senhas e chaves. Ele fica dentro da VPS e nunca vai para o GitHub.

1. Dentro da VPS, digite:
   ```
   sudo nano /opt/mk-motos/.env
   ```
2. Use as setas do teclado para ir até cada linha e preencha **depois do sinal =**, sem espaço:
   - `SENHA_PAINEL=` : a senha para entrar no painel. **Mínimo de 10 caracteres.** Sem ela, o sistema não sobe.
   - `SUPABASE_URL=` e `SUPABASE_SERVICE_ROLE_KEY=` : do painel do Supabase (Project Settings > API).
     Guardam os dados com segurança na nuvem.
   - `WHATSAPP_TOKEN=`, `WHATSAPP_PHONE_NUMBER_ID=`, `WHATSAPP_VERIFY_TOKEN=`, `WHATSAPP_APP_SECRET=`:
     do painel da Meta (developers.facebook.com). Pode deixar para depois.
   - `GEMINI_API_KEY=` : chave grátis do Google AI Studio, para ler comprovantes. Opcional.
3. Escreva cada valor **sem aspas**. Certo: `SENHA_PAINEL=minhasenha123`. Errado: `SENHA_PAINEL="minhasenha123"`.
4. Para salvar e sair do nano: aperte **Ctrl + O**, depois **Enter**, depois **Ctrl + X**.
5. Reinicie o sistema para ler as novas configurações:
   ```
   sudo systemctl restart mk-motos
   ```

**Não apague nem mude** `SESSAO_SEGREDO`, `GPS_TOKEN` e `CRON_SECRET`: o instalador já criou esses
códigos e trocá-los desconecta todo mundo e quebra o GPS.

---

## Passo 6: ver se está funcionando

1. Abra no navegador: **https://mkmotos.com.br** (com o seu domínio). Deve aparecer a tela de login com cadeado.
   Se o cadeado não aparecer, espere alguns minutos (a primeira emissão do certificado pode demorar) e confira o Passo 2.
2. Para ver o estado do sistema, dentro da VPS:
   ```
   sudo systemctl status mk-motos
   ```
   A linha `Active:` deve dizer **active (running)**. Aperte **Q** para sair.
3. Para ver o registro de mensagens (o "diário" do sistema):
   ```
   sudo journalctl -u mk-motos -n 50 --no-pager
   ```
   Para acompanhar ao vivo, use `sudo journalctl -u mk-motos -f`, e aperte **Ctrl + C** para parar.
4. Para ver o site (HTTPS): `sudo systemctl status caddy`.

Se o sistema não estiver "running", o registro de mensagens (item 3) mostra o motivo. Quase sempre é o `.env` incompleto.

---

## Passo 7: configurar o GPS e o WhatsApp

**GPS (rastreador):**
- No painel, vá em **Configurações > GPS**: o sistema mostra a URL pronta. Ela tem este formato:
  `https://mkmotos.com.br/api/gps?token=SEU_TOKEN`
- Cole essa URL no rastreador (campo de servidor/URL de envio). O token também aparece com:
  `sudo grep GPS_TOKEN /opt/mk-motos/.env`

**WhatsApp (Meta):**
1. No painel da Meta, em **WhatsApp > Configuração > Webhook**, coloque:
   - **URL de callback:** `https://mkmotos.com.br/api/whatsapp/webhook`
   - **Token de verificação:** o mesmo valor de `WHATSAPP_VERIFY_TOKEN` do `.env`
2. Clique em **Verificar e salvar** e marque o campo **messages**.

---

## Passo 8: atualizar o sistema quando eu fizer melhorias

Dentro da VPS:
```
sudo bash /opt/mk-motos/deploy/atualizar.sh
```
Ele baixa a versão nova, instala o que faltar, monta o site e reinicia. Os dados não são apagados.

---

## Passo 9: backups (cópias de segurança)

- **Quando:** todo dia às **03:00** (horário de Brasília). Não precisa fazer nada.
- **Onde:** `/opt/mk-motos-backups/` (uma pasta por dia, ex.: `2026-10-08`). São guardados os **últimos 14 dias**.
- **O que tem dentro:**
  - `mkmotos.db`: o banco de dados (clientes, motos, contratos, pagamentos).
  - `arquivos.tar.gz`: fotos, comprovantes e o `.env`.
  - `n8n-dados.tar.gz`: dados do n8n (se instalado).
- **Ver o registro dos backups:** `sudo tail -n 30 /var/log/mk-motos-backup.log`
- **Fazer um backup agora:** `sudo bash /opt/mk-motos/deploy/backup.sh`

### Cópia fora do servidor (recomendado, de vez em quando)

Os backups ficam **na mesma VPS**. Se a VPS tiver um problema grave, eles se perdem junto.
Por isso, uma vez por mês, baixe uma cópia para o seu PC:

1. Na VPS, deixe a pasta do dia legível para o usuário `ubuntu` (troque a data pela que você quer):
   ```
   sudo chown -R ubuntu:ubuntu /opt/mk-motos-backups/2026-10-08
   ```
   (Na Hostinger, você entra como `root`: pule este passo.)
2. No PowerShell do Windows, vá para a Área de Trabalho e baixe a pasta:
   ```
   cd $env:USERPROFILE\Desktop
   scp -r ubuntu@IP-DA-VPS:/opt/mk-motos-backups/2026-10-08 .
   ```
   (Na Hostinger, use `root@IP-DA-VPS`. O ponto no fim quer dizer "guarde aqui nesta pasta".)
3. Vai aparecer a pasta `2026-10-08` na Área de Trabalho, com o banco e os arquivos.

Atenção: essa cópia tem senhas e dados de clientes. Guarde em local seguro e não envie por WhatsApp nem e-mail.

Opcional, para depois: a Oracle tem o **Object Storage** (armazenamento de arquivos na nuvem dela), que pode
receber os backups automaticamente. Pode ser configurado depois, com ajuda.

### Como restaurar um backup (só em caso de problema)

1. Pare o sistema: `sudo systemctl stop mk-motos`
2. Guarde o banco atual (não apague): 
   `sudo mv /opt/mk-motos/data/mkmotos.db /opt/mk-motos/data/mkmotos.db.antigo`
   Se existir um arquivo `mkmotos.db-wal`, faça o mesmo com ele (acrescente `.antigo` no nome).
3. Copie o backup do dia desejado no lugar (troque a data):
   `sudo cp /opt/mk-motos-backups/2026-10-08/mkmotos.db /opt/mk-motos/data/mkmotos.db`
   `sudo chown mkmotos:mkmotos /opt/mk-motos/data/mkmotos.db`
4. Ligue de novo: `sudo systemctl start mk-motos`

Se o sistema estiver ligado ao Supabase, ao iniciar ele baixa os dados da nuvem. Nesse caso, peça ajuda antes de restaurar.

---

## Problemas comuns

| O que acontece | O que fazer |
|---|---|
| Site não abre ou sem cadeado | O domínio ainda não aponta para a VPS (Passo 2), ou as portas 80/443 estão fechadas (Oracle: Passo 1A, item 7; Hostinger: confira o firewall do painel). |
| Entra na página, mas não aceita a senha | Confira `SENHA_PAINEL` no `.env` (mínimo 10 caracteres) e rode `sudo systemctl restart mk-motos`. |
| Pelo celular/internet aparece "403" ou "acesso negado" | Esperado enquanto não houver `SENHA_PAINEL`. Preencha o `.env`. |
| `sudo systemctl status mk-motos` mostra "activating" ou "failed" | Veja o motivo com o comando do Passo 6, item 3. |
| Mensagem "Could not get lock" ao instalar | Outro programa do Ubuntu está atualizando. Espere 5 minutos e rode o instalador de novo. |

---

## Glossário rápido

- **VPS**: computador alugado na internet, ligado 24 horas. É como um PC que mora num data center.
- **SSH**: jeito de digitar comandos numa VPS a partir do seu PC, como o PowerShell faz aqui.
- **DNS / registro A**: a "lista telefônica" da internet. O registro A diz em qual IP fica o seu domínio.
- **Caddy**: programa que coloca o cadeado (HTTPS) no site e encaminha os visitantes para o sistema.
- **systemd**: o "gerente" do Linux que liga o sistema sozinho e o reinicia se ele cair.
- **.env**: arquivo de configuração com senhas e chaves. Nunca compartilhe.
- **n8n**: ferramenta de automação (ex.: mandar mensagem quando um pagamento vence).
- **Backup**: cópia de segurança dos dados, para recuperar se algo der errado.
