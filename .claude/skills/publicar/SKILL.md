---
name: publicar
description: Envia as alterações do MK Motos para o GitHub (commit + push) com segurança, sem levar dados de clientes. Use ao terminar uma leva de mudanças.
---
# Publicar

O dono autorizou commit e push sem pedir permissão.

1. `/verificar` precisa estar ✅.
2. `git status` — confira que NÃO aparecem `data/`, `*.db`, `.env` ou comprovantes de clientes. Se aparecerem, pare e corrija o `.gitignore`.
3. `git add` só dos arquivos alterados (nunca `git add -A` às cegas).
4. Mensagem de commit em português, no imperativo, resumindo o que muda para o dono (ex.: "Adiciona tela de multas e aviso por WhatsApp").
5. `git push`. Se falhar por autenticação, explique ao dono em passos simples (ele não é programador).
6. Conte ao dono, em 2–3 linhas, o que foi publicado.
