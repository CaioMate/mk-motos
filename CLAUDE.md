# MK MOTOS — notas para desenvolvimento

Sistema de locação de motos (React 19 + Vite 8 + Tailwind 4 no front; Express + `node:sqlite` no back).
Originalmente gerado no Google AI Studio como protótipo só de front-end; agora tem servidor e banco reais.
O dono da locadora não é programador: fale com ele em português simples, com passo a passo.

A equipe de agentes é global (repo `CaioMate/equipe-agentes`, instalada em `~/.claude`); aqui ficam só as notas deste projeto.

## Notas para os agentes
- dev-backend: nova operação = função em `ACOES` (`server/acoes.ts`), `(b, p) => ResultadoAcao`; valide com
  `exigir()`/`texto()`/`numero()`/`obter()`; IDs com `novoId('prefixo')`; `registrarAtividade()` no histórico.
  Exponha no front em `src/context/AppContext.tsx` (`executar('nome', payload)`).
- dev-frontend: nova aba = `NavTab` (`src/types/mkMotos.ts`) + item com `dica` em `LayoutShell.tsx` + `case` em `App.tsx`.
  Dados só via `useApp()`. Ícones `lucide-react`, animações `motion`.
- banco-dados: não há SQL por tabela — `server/banco.ts` guarda cada documento como JSON no SQLite; novas
  coleções/campos = tipos em `src/types/mkMotos.ts` + `Banco`. NÃO existem dados de demonstração: banco novo começa vazio
  (o dono cadastra tudo). Fotos das motos: arquivos em `<pasta do banco>/fotos/` (`Banco.pastaFotos`), servidas em
  `/api/fotos/:arquivo`; `moto.foto` guarda `/api/fotos/<arquivo>` ou `''` (front mostra `FotoMoto` com ícone). Upload em
  `POST /api/motos/:id/foto {base64, mime}` (jpeg/png/webp, até 5 MB; o front reduz para 1200px). `ação apagarTudo` zera tudo.
- integracoes: GPS em `server/gps.ts` + `processarKm()`; WhatsApp em `server/whatsapp.ts`/`atendimento.ts`;
  IA em `server/agente.ts` (sem `ANTHROPIC_API_KEY` deve continuar funcionando). Nunca cobrar km duplicado.
- testador: `npm run lint` → `npm run build` → `MKMOTOS_DB="$TEMP/mk-teste.db" PORT=8099 npm run dev` e
  `curl` em `/api/estado` e `POST /api/acoes/<nome>` (dado inválido → 400 `{ erro }`). Nunca `data/mkmotos.db`.
- seguranca: login por senha única via `SENHA_PAINEL` (`server/login.ts`: cookie HttpOnly assinado com HMAC, 30 dias,
  5 erros/IP = bloqueio de 15 min; mais de 30 erros/hora no total = bloqueio global de 15 min; IP só via `ipDoCliente()`, nunca X-Forwarded-For;
  na Vercel a senha precisa de 10+ caracteres). `server/seguranca.ts`: cabeçalhos/CSP (sem CSP no `npm run dev`; a lista é repetida em
  `scripts/build-vercel.mjs`), CSRF (POST/PUT/DELETE em /api só JSON + Origin do mesmo host, exceto gps/webhook/cron), token do GPS
  (`GPS_TOKEN`, ou derivado do segredo; `?token=`/Bearer/`X-GPS-Token`; obrigatório com SENHA_PAINEL; placa não identifica mais o rastreador),
  `limparChaves()` (anti prototype pollution nas ações) e conferência dos bytes iniciais dos uploads. Webhook WhatsApp sem `WHATSAPP_APP_SECRET`
  é recusado (503) com SENHA_PAINEL ou na Vercel.
  AVISO: sem SENHA_PAINEL o "só rede local" depende de cabeçalhos de proxy e não é segurança forte; nunca exponha à internet sem senha. Com ela, toda `/api/*` exige sessão, exceto webhook WhatsApp, GPS e login. Sem ela:
  só rede local (internet = 403). `/api/backup` entrega o banco inteiro; uploads em `/api/manutencoes/:id/comprovante`.
- devops: scripts `iniciar-mk-motos.bat`, `liberar-firewall.bat`, `tunel-whatsapp.bat`. Backup = copiar
  `data/mkmotos.db` com o servidor parado, ou `GET /api/backup`.
- banco-dados/devops (Supabase): com `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` o Supabase é o armazenamento permanente;
  o SQLite local vira cache. `Banco` (server/banco.ts) enfileira docs/arquivos alterados em `transacao()` e só envia após o COMMIT (fila com retry,
  `server/nuvem.ts`); na inicialização baixa tudo (ou encerra se não responder). Esquema em `supabase/esquema.sql`, bucket privado `arquivos`.
  Fotos/comprovantes: gravar com `banco.salvarArquivo()`, servir com `banco.garantirArquivo()`. GPS (`gps_posicoes`) NÃO vai ao Supabase.
- devops (VERCEL, plano grátis): `vercel.json` roda `npm run build:vercel` (`scripts/build-vercel.mjs`) que gera `.vercel/output` (Build Output API v3):
  `static/` (front), `functions/api.func/index.mjs` (`server/vercel.ts` empacotado com esbuild, nodejs22.x) e `config.json` (/api/* -> função; resto SPA).
  Rotas em `server/app.ts` (`criarApp({modo})`); `server/index.ts` é só o modo local (listen + setInterval). Na Vercel: SQLite em /tmp baixado do
  Supabase; marcador `meta/revisao` (Supabase) conferido a cada /api (`Banco.conferirRevisao`) e atualizado a cada envio; toda escrita
  AGUARDA a fila no Supabase (`concluirGravacao`/`Banco.garantirEnvio`) e, se falhar, desfaz e responde 503; sem setInterval (rotinas em /api/estado se >15 min
  e em `GET /api/cron` com `Bearer CRON_SECRET`); sem SSE (`/api/sessao` informa `tempoReal:false` e o front consulta a cada 20 s); tentativas de login no Supabase;
  uploads até 3 MB (limite de 4,5 MB da Vercel). Obrigatórias: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, SENHA_PAINEL, SESSAO_SEGREDO (faltando = 503 claro).
  Limitações: GPS (trajeto/relatório de km) fica no /tmp de cada instância; envios simultâneos de duas instâncias podem se sobrepor (último grava); um WhatsApp
  pendente pode sair em dobro se ação e cron coincidirem. Para testar: gere o pacote e importe `index.mjs` num `http.createServer` com um Supabase falso.
- Decisão: produção = servidor 24h (Oracle Cloud VM, `server/index.ts`, SQLite + Supabase como cópia); Vercel é secundário.
- GPS/viagens: `gps_viagens` (SQLite, não vai ao Supabase) é atualizada de forma incremental em `registrarPosicao` (`atualizarViagens` em `server/gps.ts`): com `ignition` (true/false) a viagem = ligada→desligada (origem `ignicao`); sem ele, começa acima de `config.gps.velocidadeMovimentoKmh` e termina após `minutosParadaFimViagem` parado (origem `movimento`). Km da viagem = mesmo delta da cobrança (não cobra nada). API (login): `GET /api/gps/viagens/:motoId?de=&ate=` (padrão hoje, UTC-3) e `GET /api/gps/pontos/:motoId?de=&ate=&max=`. Tela: `src/components/TrajetosMoto.tsx` (Leaflet + tiles OSM, no modal da moto; tile.openstreetmap.org está na CSP das duas listas).
- Retenção LGPD: `server/retencao.ts` (`limpezaAutomatica`, chamada em `executarRotinas`, 1x/dia via meta `limpeza-ultima`), prazo `config.retencaoMeses` (24): apaga GPS/viagens, mensagens, atividades e clientes encerrados há mais que o prazo e sem pendência (com contratos, aluguéis, pagamentos, leads convertidos e arquivos do WhatsApp). Motos nunca. Remoções vão ao Supabase pela fila normal (`Banco.remover`/`apagarArquivo`).
- publicar: o dono autorizou commit + push sem perguntar.

## Comandos
- `npm run dev` — Express na porta 8000 com Vite em middleware (HMR). Não use `vite` direto: a API não sobe.
- `npm run lint` — `tsc --noEmit` (cobre `src/` e `server/`).
- `npm start` — build + servidor de produção (`--producao` serve `dist/`).
- Variáveis: `PORT` (padrão 8000), `MKMOTOS_DB` (padrão `data/mkmotos.db`). `.env` é lido via `process.loadEnvFile`.

## Arquitetura
- Toda regra de negócio fica no servidor. O front chama `POST /api/acoes/:nome` (ver `server/acoes.ts`)
  e recebe o estado completo de volta. Erros de validação → `ErroNegocio` → HTTP 400 `{ erro }`.
- `Banco` mantém todas as coleções em memória e grava cada documento (JSON) no SQLite na hora.
  Toda ação roda em `banco.transacao()`; em erro, faz ROLLBACK e recarrega a memória.
- Depois de toda ação/posição GPS roda `executarRotinas()` (mensalidades, atrasos, status derivados).
  Também roda a cada 15 min. Status de cliente/moto/aluguel/pagamento são **derivados** — não setar à mão.
- Tempo real: `GET /api/eventos` (SSE) avisa `atualizado`; o front recarrega `/api/estado` (na Vercel não há SSE: consulta a cada 20 s).
- GPS: `server/gps.ts` normaliza OsmAnd, Traccar Client 9+, Traccar Server forward e JSON simples.
  Distância por hodômetro quando existe, senão Haversine com filtro de ruído/saltos (`config.gps`).
- Km → `processarKm()` soma na moto e no contrato, cobra ciclos (`config.cobrancaKm`) e abre trocas do
  `config.planoPecas` (contador por peça em `moto.pecasUltimaTrocaKm`).

- Peças/óleo NÃO geram cobrança (regra do dono): ordem automática com `situacao` aguardando_comprovante →
  em_analise → concluida. Aviso/lembrete ao cliente via `enfileirar()` (server/whatsapp.ts).
- WhatsApp: API oficial da Meta. Mensagens de saída são gravadas como `pendente` dentro da transação e
  enviadas por `processarFila()` (a cada 5 s, fora da transação). Fora da janela de 24h usa o modelo
  `WHATSAPP_TEMPLATE` (3 parâmetros: nome, empresa, texto). Webhook em `/api/whatsapp/webhook` (assinatura
  X-Hub-Signature-256 com `WHATSAPP_APP_SECRET`); processamento em `server/atendimento.ts`.
- Agente (server/agente.ts): Claude `claude-opus-5-5`; comprovante via `messages.parse` + zod; respostas via
  `beta.messages.create` com `fallbacks: 'default'`. Sem `ANTHROPIC_API_KEY` usa respostas fixas.
- Aprovação automática de comprovantes (`config.manutencao.aprovacaoAutomatica`, padrão true): `registrarComprovante` →
  `anexarEConferir` (`server/atendimento.ts`) chama `pendenciasDoComprovante` (`server/comprovantes.ts`, funções puras: IA diz que confere,
  oficina com nome tolerante, data entre abertura−3 dias e hoje, km entre km da ordem−300 e km atual+300, SHA-256 do arquivo inédito). Lista vazia →
  `aprovarComprovanteDaOrdem` (`server/acoes.ts`, a mesma da ação do dono; `aprovadoPor: 'automatico'|'dono'`); senão grava `comprovante.pendencias`
  (texto para o dono) e fica em_analise. Comprovantes antigos não têm `hash`. Na Vercel, GPS e webhook também chamam `rotinasSeVencidas()`.
  O WhatsApp não tem restrição de horário (a janela de 23,5 h em `dentroDaJanela` só escolhe texto livre x modelo).
- Cerca virtual: `config.cercaVirtual.cidades` (centro + raio), checada em `registrarPosicao`; `moto.foraDaArea`.
- Requisições com cabeçalho de proxy (`cf-connecting-ip`/`x-forwarded-for`) só acessam webhook e GPS.
- Telefones comparados por `chaveTelefone()` (DDD + últimos 8 dígitos) por causa do 9º dígito.

## Convenções
- Datas sempre `dd/mm/aaaa` (helpers em `src/lib/datas.ts`); timestamps de atividade em ISO (`criadoEm`).
- Dinheiro: `brl()` de `src/lib/formato.ts`. Indicadores/alertas: `src/lib/indicadores.ts` (nunca números fixos).
- Dicas ao passar o mouse: escreva `data-dica="texto"` em qualquer elemento; `DicaFlutuante` (montado no
  LayoutShell) mostra a caixa. Texto simples, para o dono (não-técnico). Não há mais roteiro/apresentação guiada.
- Aluguéis e Contratos são uma tela só (`AlugueisView`, aba `alugueis`); `navigateToContrato` abre essa aba
  com o modal do contrato. Não existe aba `contratos`.
- IDs mantêm prefixos (`moto-`, `cli-`, `ctr-`…): o Dashboard usa o prefixo para navegar.
- `data/` e `*.db` estão no `.gitignore` — contêm dados pessoais (CPF, CNH).
