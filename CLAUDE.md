# MK MOTOS — notas para desenvolvimento

Sistema de locação de motos (React 19 + Vite 8 + Tailwind 4 no front; Express + `node:sqlite` no back).
Originalmente gerado no Google AI Studio como protótipo só de front-end; agora tem servidor e banco reais.

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

## Convenções
- Datas sempre `dd/mm/aaaa` (helpers em `src/lib/datas.ts`); timestamps de atividade em ISO (`criadoEm`).
- Dinheiro: `brl()` de `src/lib/formato.ts`. Indicadores/alertas: `src/lib/indicadores.ts` (nunca números fixos).
- IDs mantêm prefixos (`moto-`, `cli-`, `ctr-`…): o Dashboard usa o prefixo para navegar.
- `data/` e `*.db` estão no `.gitignore` — contêm dados pessoais (CPF, CNH).
