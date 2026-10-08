---
name: backup
description: Faz cópia de segurança dos dados do sistema atual (banco de dados, uploads, configurações) ou orienta o usuário a fazer. Use antes de mudanças arriscadas ou quando o usuário pedir backup.
---
# Backup

Delegue ao `devops`, que descobre no CLAUDE.md onde ficam os dados.
- Copie o banco e as pastas de dados para `backups/AAAA-MM-DD/` (fora do git), com o sistema parado ou usando o comando de exportação do banco.
- Nunca sobrescreva nem apague o original. Nunca faça commit do backup.
- Recomende ao usuário guardar uma cópia fora do PC, em local privado (dados pessoais).
