---
name: backup-banco
description: Faz cópia de segurança do banco de dados do MK Motos (clientes, motos, contratos) ou orienta o dono a fazer. Use antes de mudanças arriscadas no banco ou quando o dono pedir backup.
---
# Backup do banco

Delegue ao `devops-windows`.

- Com o servidor rodando: baixar `http://localhost:8000/api/backup` (só pela rede local).
- Com o servidor parado: copiar `data/mkmotos.db` (ou o caminho de `MKMOTOS_DB`) para `backups/mkmotos-AAAA-MM-DD.db`, fora do git.
- Nunca sobrescreva nem apague o banco original. Nunca faça commit do backup.
- Para o dono: recomende guardar uma cópia fora do PC (pendrive ou nuvem pessoal) — o banco tem CPF/CNH, então em local privado.
