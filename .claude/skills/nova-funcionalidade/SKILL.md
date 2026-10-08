---
name: nova-funcionalidade
description: Roteiro para criar uma funcionalidade nova em qualquer sistema ou site, dividindo o trabalho entre os agentes (servidor, banco, tela, integrações, testes). Use quando o pedido for "o sistema/site precisa fazer X".
---
# Nova funcionalidade

1. Sem CLAUDE.md no projeto? Rode /adaptar-projeto antes.
2. Pequena (1 área)? Vá direto ao agente da área. Grande (várias áreas)? Peça um plano ao `arquiteto`.
3. Execute com os agentes, em paralelo quando forem independentes:
   - `banco-dados` (estrutura de dados) → `dev-backend` (regras e rotas) → `dev-frontend` (telas).
   - `integracoes` se envolver serviço externo.
4. `/verificar`; `revisor` se for média/grande; `seguranca` se mexer com login, dados pessoais ou internet.
5. `documentador` atualiza o README/guia do usuário, se o usuário vai usar algo novo.
6. Se mudou uma regra de negócio, peça ao `adaptador` para atualizar o CLAUDE.md (1–2 linhas).
7. `/publicar`.
