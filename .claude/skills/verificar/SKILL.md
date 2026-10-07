---
name: verificar
description: Confere se o MK Motos está funcionando depois de uma alteração (lint, build e teste rápido do servidor com banco temporário). Use antes de publicar ou quando o usuário perguntar "está funcionando?".
---
# Verificar

Delegue ao subagente `testador` (modelo barato), informando o que mudou e quais ações/rotas testar.
Ele roda: `npm run lint` → `npm run build` → servidor de teste na porta 8099 com banco temporário → `curl` nas rotas.

Se falhar: corrija com o agente da área (`dev-backend`, `dev-frontend`, `especialista-*`) e rode de novo.
Para mudanças médias/grandes, depois do ✅ chame também o `revisor`.
Nunca teste usando o banco real `data/mkmotos.db`.
