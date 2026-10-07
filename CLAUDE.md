# MK MOTOS — notas para desenvolvimento

Sistema de locação de motos (React 19 + Vite 8 + Tailwind 4 no front; Express + `node:sqlite` no back).
Originalmente gerado no Google AI Studio como protótipo só de front-end; agora tem servidor e banco reais.
O dono da locadora não é programador: fale com ele em português simples, com passo a passo.

## Equipe de agentes — DELEGUE PRIMEIRO (economia de tokens)
Regra: tarefas simples ou médias vão para um subagente (`.claude/agents/`), que roda em modelo mais barato
e com contexto próprio. O agente principal só coordena, decide e conversa com o dono. Faça você mesmo apenas
quando for mais barato que explicar (ex.: editar 1–2 linhas já vistas) ou quando exigir a conversa inteira.
Tarefas independentes: dispare os subagentes em paralelo, na mesma mensagem. Passe a eles só o necessário
(arquivo, objetivo, restrições) — eles não veem esta conversa.

| Situação | Subagente | Modelo |
|---|---|---|
| Achar onde algo está no código | `explorador` | haiku |
| Regra de negócio, ações, banco, rotinas (server/) | `dev-backend` | sonnet |
| Telas, modais, visual, `data-dica` (src/) | `dev-frontend` | sonnet |
| GPS, km, cobrança por km, peças/óleo, cerca virtual | `especialista-gps` | sonnet |
| WhatsApp (Meta), robô de atendimento, IA Claude | `especialista-whatsapp-ia` | sonnet |
| Testar (lint, build, servidor de teste, curl) — após toda mudança | `testador` | haiku |
| Revisar o diff antes de publicar (mudanças médias/grandes) | `revisor` | sonnet |
| Segurança, LGPD, exposição na internet | `seguranca-lgpd` | sonnet |
| README, CLAUDE.md, guias, textos de tela | `documentador` | haiku |
| Windows, .bat, firewall, túnel, backup, instalação | `devops-windows` | haiku |
| Dúvida do dono sobre como usar o sistema | `suporte-dono` | haiku |
| Funcionalidade grande / várias áreas / sistema novo → plano | `arquiteto` | opus |
| Agente errou, gastou demais ou revisão periódica | `aperfeicoador-agentes` | opus |

Skills (procedimentos, `/nome`): `/nova-acao`, `/nova-tela`, `/verificar`, `/publicar`, `/backup-banco`,
`/novo-sistema`, `/melhorar-agentes`.

Fluxo padrão: (complexo? `arquiteto`) → agente(s) da área → `testador` → (`revisor` se médio/grande) → `/publicar`.
Se um subagente falhar duas vezes na mesma coisa, resolva você e chame `aperfeicoador-agentes` com o ocorrido.

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
- Tempo real: `GET /api/eventos` (SSE) avisa `atualizado`; o front recarrega `/api/estado`.
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
