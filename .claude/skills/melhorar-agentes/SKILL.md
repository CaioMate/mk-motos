---
name: melhorar-agentes
description: Pede ao agente aperfeicoador-agentes para revisar e melhorar a equipe de agentes e skills com base no uso recente. Use quando algum agente errar, gastar tokens demais, ou periodicamente (ex. toda semana).
---
# Melhorar agentes

Chame o subagente `aperfeicoador-agentes` passando:
- O que motivou (ex.: "o dev-frontend criou regra de negócio no front", "o testador usou o banco real") — ou "revisão periódica".
- Se houver, os nomes dos agentes envolvidos.

Ele lê os agentes, as skills, o CLAUDE.md e as conversas recentes, aplica melhorias pequenas e registra em `.claude/MELHORIAS.md`.
Depois mostre ao usuário o resumo e publique com /publicar.
