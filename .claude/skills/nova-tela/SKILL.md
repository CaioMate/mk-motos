---
name: nova-tela
description: Passo a passo para adicionar uma nova aba/tela ao menu do MK Motos. Use quando o pedido for uma área nova no sistema (ex. "quero uma tela de multas").
---
# Nova tela

Delegue a `dev-frontend` (e `dev-backend` se precisar de ações novas — veja /nova-acao).

1. `src/types/mkMotos.ts` — acrescente o id no tipo `NavTab`.
2. `src/pages/NomeView.tsx` — crie a tela copiando a estrutura de uma View parecida (cabeçalho, cartões, tabela). Dados vêm de `useApp()`; indicadores de `src/lib/indicadores.ts`.
3. `src/components/LayoutShell.tsx` — item no menu: `{ id, label, icon (lucide-react), dica: 'explicação simples' }`.
4. `src/App.tsx` — `case 'id': return <NomeView />;` no `ActivePageRouter`.
5. Coloque `data-dica` nos números e botões que possam confundir o dono.
6. `/verificar`. Atualize o README (seção de telas) pelo `documentador` se for algo que o dono vai usar.
