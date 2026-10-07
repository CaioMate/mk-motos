---
name: novo-sistema
description: Cria um sistema novo parecido com o MK Motos (outra locadora — carros, bicicletas, equipamentos — ou outro negócio de aluguel/assinatura) reaproveitando a arquitetura, os agentes e as skills. Use quando o usuário pedir "um sistema igual/parecido/melhor para X".
---
# Novo sistema a partir do MK Motos

1. **Planejar** — chame o `arquiteto` com o negócio novo. Ele devolve: o que reaproveitar, o que trocar, decisões do dono e a divisão por agente.
2. **Perguntar ao dono** só as decisões de negócio que o plano listou (preços, regras, o que cobra).
3. **Copiar a base** (via `devops-windows`) para uma pasta irmã, sem `data/`, `dist/`, `node_modules/`, `.env` e sem `.git`:
   `src/`, `server/`, `public/`, `index.html`, `package.json`, `tsconfig.json`, `vite.config.ts`, `.env.example`, `.gitignore`, `*.bat`, `CLAUDE.md` e a pasta `.claude/` (agentes + skills vão junto).
   Depois `git init` e `npm install`.
4. **Adaptar** em paralelo quando possível:
   - `dev-backend`: tipos em `src/types`, ações em `server/acoes.ts`, rotinas em `server/automacao.ts`, dados de demonstração.
   - `dev-frontend`: nomes, telas, menu, cores/marca, `data-dica`.
   - `especialista-gps` / `especialista-whatsapp-ia`: manter, adaptar ou remover conforme o negócio.
5. **Ajustar o CLAUDE.md** e os prompts dos agentes para o novo domínio (`documentador` + `aperfeicoador-agentes`).
6. `/verificar`, depois `/publicar` num repositório novo.
