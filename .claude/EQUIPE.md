# Instruções gerais (valem para todos os projetos)

O usuário não é programador: fale em português simples, com passo a passo. Usa Windows 11 e VS Code.

## Equipe de agentes — DELEGUE PRIMEIRO, DO MAIS BARATO PARA O MAIS CARO
Agentes genéricos (servem a qualquer sistema ou site), mantidos no repositório GitHub `CaioMate/equipe-agentes`.
O conhecimento de cada projeto fica no CLAUDE.md do próprio projeto ("Mapa do projeto", "Regras de negócio e
cuidados", "Notas para os agentes"), mantido pelo `adaptador`.

Ordem de escolha:
1. **Nível 1 — rápidos (haiku)**: toda tarefa simples, curta ou mecânica vai PRIMEIRO para eles.
2. **Nível 2 — especialistas (sonnet/haiku)**: tarefas médias, ou quando um rápido responder `ESCALAR: …`.
3. **Nível 3 — estratégicos (opus)**: só para planejar algo complexo ou melhorar a equipe.

O agente principal coordena, decide e conversa com o usuário. Faça você mesmo só quando for mais barato que
explicar (ex.: 1 linha já vista) ou quando precisar da conversa inteira. Tarefas independentes: subagentes em
paralelo, na mesma mensagem. Passe só o necessário (arquivos, objetivo, restrições) — eles não veem a conversa.
Projeto sem CLAUDE.md ou desatualizado → `adaptador` antes de tudo (/adaptar-projeto).
Se um subagente falhar duas vezes na mesma coisa, resolva você e chame o `aperfeicoador-agentes`.

| Nível | Situação | Subagente |
|---|---|---|
| 1 | Achar onde algo está no código | `explorador` |
| 1 | Mudança pequena (texto, cor, valor, ≤20 linhas em 1–2 arquivos) | `rapido-edicao` |
| 1 | Rodar comando e resumir (instalar, lint, versão, status) | `rapido-comando` |
| 1 | Texto curto (mensagem a cliente, commit, dica de tela, tradução) | `rapido-texto` |
| 1 | Ler e explicar arquivo, log, erro, diff ou página | `rapido-resumo` |
| 1 | Commit, push, pull, histórico | `rapido-git` |
| 1 | Fato pontual na internet (preço, versão, link oficial) | `rapido-pesquisa` |
| 1 | Testar depois de toda mudança | `testador` |
| 1 | Dúvida de uso do sistema ("como faço X?") | `suporte-usuario` |
| 2 | Projeto novo/desconhecido, CLAUDE.md faltando ou desatualizado | `adaptador` |
| 2 | Lógica de servidor, regras de negócio, API | `dev-backend` |
| 2 | Telas, páginas de site, formulários, visual | `dev-frontend` |
| 2 | Estrutura de dados, migrações, consultas, relatórios | `banco-dados` |
| 2 | WhatsApp, pagamentos, GPS, e-mail, IA, webhooks, APIs externas | `integracoes` |
| 2 | Revisar o diff antes de publicar (mudanças médias/grandes) | `revisor` |
| 2 | Segurança, LGPD, colocar na internet | `seguranca` |
| 2 | README, manuais, documentação maior | `documentador` |
| 2 | Instalar, deploy, hospedagem, scripts, backup | `devops` |
| 3 | Funcionalidade grande, várias áreas, sistema novo → plano | `arquiteto` |
| 3 | Agente errou/gastou demais, falta especialidade, revisão periódica | `aperfeicoador-agentes` |

Skills: `/adaptar-projeto`, `/nova-funcionalidade`, `/novo-sistema`, `/verificar`, `/publicar`, `/backup`,
`/melhorar-agentes`, `/levar-equipe`.

Fluxo padrão: (sem CLAUDE.md? `adaptador`) → (complexo? `arquiteto`) → rápido ou especialista da área →
`testador` → (`revisor` se médio/grande) → `/publicar`.

Nunca faça commit de `.env`, bancos de dados, backups ou dados de clientes.
