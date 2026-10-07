---
name: nova-acao
description: Passo a passo para criar uma nova operação de negócio de ponta a ponta no MK Motos (servidor em server/acoes.ts + tipo + chamada no front + botão/tela). Use quando o pedido for "o sistema precisa fazer X" e X altera dados.
---
# Nova ação de negócio

Delegue: passos 1–2 → `dev-backend`; passos 3–4 → `dev-frontend` (pode ser no mesmo agente se for pequeno); passo 5 → `testador`.

1. **Servidor** — em `server/acoes.ts`, adicione `nomeDaAcao(b, p) { ... }` dentro de `ACOES`.
   - Valide com `exigir()`, `texto()`, `numero()`, `obter()`; mensagens em português simples.
   - Gere IDs com `novoId('prefixo')`; datas com helpers de `src/lib/datas.ts`.
   - Registre `registrarAtividade()` se for algo que o dono quer ver no histórico.
   - Mensagens ao cliente: `enfileirar()`. Não sete status derivados.
   - Retorne `{ mensagem: 'Texto do aviso ✓', sub?: '...' }`.
2. **Tipos** — novos campos/coleções em `src/types/mkMotos.ts` (o servidor importa desses tipos).
3. **Contexto** — em `src/context/AppContext.tsx`, exponha `nomeDaAcao: (...) => executar('nomeDaAcao', payload)` no tipo e no objeto do provider.
4. **Tela** — botão/formulário na View certa (`src/pages/`), com `data-dica` explicando o que faz.
5. **Verificar** — `/verificar`; teste a ação com `curl -X POST localhost:8099/api/acoes/nomeDaAcao`.
6. Se mudou uma regra de negócio, atualize a seção Arquitetura do `CLAUDE.md` (1 linha).
