---
name: melhorar-agentes
description: Pede ao agente aperfeicoador-agentes para revisar e melhorar a equipe de agentes e skills com base no uso recente em todos os projetos. Use quando um agente errar, gastar tokens demais, faltar uma especialidade, ou periodicamente (ex. toda semana).
---
# Melhorar agentes

Chame o subagente `aperfeicoador-agentes` passando o motivo (ex.: "o testador usou o banco real no projeto X") ou "revisão periódica", e os agentes envolvidos.
Ele aplica melhorias pequenas e registra em `MELHORIAS-AGENTES.md` do repositório equipe-agentes e publica no GitHub. Mostre ao usuário o resumo em linguagem simples.
