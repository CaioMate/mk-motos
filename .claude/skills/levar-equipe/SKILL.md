---
name: levar-equipe
description: Coloca a equipe de agentes dentro de um projeto (pasta .claude do repositório), para ela funcionar também no Claude Code na web (claude.ai/code), no celular e em qualquer computador que abrir esse projeto. Use quando o usuário quiser usar os agentes fora deste PC ou em um projeto específico.
---
# Levar a equipe para um projeto

1. Pegue a versão mais nova: `git -C <pasta do equipe-agentes> pull` (padrão: `~/OneDrive/Documentos/antigravity/equipe-agentes`; se não existir, `git clone https://github.com/CaioMate/equipe-agentes`).
2. Rode o script de lá passando a pasta do projeto:
   - Windows: `levar-para-projeto.bat "<pasta do projeto>"`
   - Mac/Linux/nuvem: `sh levar-para-projeto.sh "<pasta do projeto>"`
   Ele copia `agents/` e `skills/` para `<projeto>/.claude/` e cria `<projeto>/.claude/EQUIPE.md` com as regras de delegação.
3. Garanta que o CLAUDE.md do projeto tenha a linha: `Equipe de agentes: siga @.claude/EQUIPE.md (delegue primeiro aos agentes de nível 1).`
   (Sem CLAUDE.md? Rode /adaptar-projeto antes.)
4. Publique com /publicar (`.claude/` vai para o git; confira que nada sensível entrou).
