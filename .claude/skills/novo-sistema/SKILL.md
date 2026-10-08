---
name: novo-sistema
description: Cria um sistema ou site novo, do zero ou baseado em um projeto existente ("um sistema igual/parecido/melhor para X"). Use para começar projetos novos.
---
# Novo sistema ou site

1. **Entender** — pergunte ao usuário só o essencial: para quem é, o que precisa fazer, onde vai rodar (PC da loja, internet), se existe um sistema parecido para usar de base.
2. **Planejar** — `arquiteto` com essas respostas: stack, o que reaproveitar, divisão por agente, decisões do dono.
3. **Criar a base** (`devops`) — numa pasta nova. Se for baseado em projeto existente, copie sem `.git`, `node_modules`/`vendor`, `dist`/`build`, `.env`, bancos e pastas de dados. `git init`, instalar dependências.
4. **Adaptar** — rode /adaptar-projeto (o `adaptador` escreve o CLAUDE.md do sistema novo).
5. **Construir** — siga /nova-funcionalidade para cada parte, com os agentes em paralelo quando possível.
6. `/verificar`, `seguranca` antes de colocar na internet, `/publicar` num repositório novo.
