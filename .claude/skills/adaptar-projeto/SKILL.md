---
name: adaptar-projeto
description: Prepara um projeto ou site qualquer para a equipe de agentes trabalhar nele — chama o agente adaptador para estudar o sistema e escrever o CLAUDE.md com mapa, regras e notas para os agentes. Use ao abrir um projeto pela primeira vez ou quando o CLAUDE.md estiver faltando/desatualizado.
---
# Adaptar projeto

1. Chame o subagente `adaptador` (diga se é projeto novo ou atualização, e qualquer regra que o dono já tenha dito).
2. Mostre ao usuário, em linguagem simples, o que ele entendeu do sistema e as dúvidas que só o dono responde.
3. Com as respostas, peça ao `adaptador` para completar o CLAUDE.md.
4. Se o projeto usa git, publique o CLAUDE.md (skill /publicar).
