---
name: verificar
description: Confere se o sistema ou site atual está funcionando depois de uma alteração (lint, testes, build e teste rápido com dados temporários). Use antes de publicar ou quando o usuário perguntar "está funcionando?".
---
# Verificar

Delegue ao subagente `testador` (modelo barato), informando o que mudou e quais rotas/páginas testar.
Se falhar: corrija com o agente da área e rode de novo. Mudança média/grande: depois do ✅, chame o `revisor`.
Nunca teste usando dados ou banco reais.
