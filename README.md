# MK MOTOS — Sistema de Gestão e Locação de Motos

Gestão de frota, clientes, aluguéis, contratos, financeiro, manutenção e CRM, com **banco de dados próprio**,
**rastreamento GPS** e **cobrança automática por quilometragem**.

## Como usar (Windows)

1. Instale o [Node.js](https://nodejs.org) versão 22 ou mais nova (já instalado neste PC: v24).
2. Dê dois cliques em **`iniciar-mk-motos.bat`**. Na primeira vez ele instala tudo sozinho.
3. A janela mostra os endereços:
   - Neste computador: `http://localhost:8000`
   - Na rede local (outros PCs e celulares no mesmo Wi-Fi): `http://IP-DO-PC:8000`
4. Se outro aparelho não conseguir abrir, rode **`liberar-firewall.bat`** uma vez (pede permissão de administrador).

> Deixe a janela do servidor aberta enquanto usa o sistema. Fechou a janela = sistema fora do ar.

### Começar com seus dados reais

O sistema abre com **dados de demonstração**. Para usar de verdade:
**Configurações → Banco de dados → Apagar todos os dados e começar do zero**.

Depois, em **Configurações**, preencha:
- **Dados da empresa** (nome, CNPJ, telefone, chave PIX — aparecem no contrato e nas cobranças)
- **Cobrança por km e peças** (valor a cada 1.000 km e o plano de troca de óleo/peças)

## Banco de dados

- Arquivo SQLite em `data/mkmotos.db` (não vai para o GitHub — contém dados pessoais dos clientes).
- Backup: **Configurações → Banco de dados → Baixar backup** (ou copie o arquivo `data/mkmotos.db` com o sistema fechado).
- Para guardar o banco em outra pasta, crie um arquivo `.env` com `MKMOTOS_DB=C:\caminho\mkmotos.db`.
- Regras garantidas pelo banco: CPF, placa e IMEI do rastreador não se repetem.

## GPS e cobrança automática

1. Cadastre o **IMEI** do rastreador em cada moto (Frota → Editar / GPS).
2. Configure o rastreador para enviar posições para `http://IP-DO-PC:8000/api/gps`
   (instruções detalhadas em **Configurações → GPS / Rastreadores**).
3. A cada posição recebida o sistema:
   - soma os km rodados na moto e **no contrato do cliente atual**;
   - a cada **1.000 km** (configurável) gera uma **cobrança automática** para o cliente;
   - quando a moto atinge a km de **troca de óleo, pastilha, pneu, relação ou revisão**, abre a ordem
     em Manutenção e **avisa o cliente pelo WhatsApp** com o endereço da **oficina credenciada**.
     O cliente paga direto na oficina (o sistema **não cobra peças**) e manda a foto do comprovante;
   - se a moto sair das **cidades permitidas** (cerca virtual), avisa você e o cliente na hora;
   - atualiza Dashboard, Financeiro e alertas em tempo real em todas as telas abertas.

## WhatsApp e agente de IA

Fluxo da troca de óleo/peças:

1. GPS detecta a km da troca → ordem "Aguardando comprovante" + mensagem ao cliente com a oficina.
2. Cliente manda a foto/PDF do comprovante no WhatsApp → o agente (Claude) lê oficina, data, serviços e valor
   e anexa à ordem; você recebe o alerta.
3. Você aprova em **Manutenção** (ou recusa com o motivo) → o cliente é avisado e o contador da peça zera.
4. Sem comprovante: lembrete a cada 150 km e alerta para você ao passar de 300 km (configurável).

O agente também responde às dúvidas dos clientes usando os dados de cada um (moto, contrato, pagamentos,
trocas pendentes). Ele não negocia valores nem promete nada: passa para a equipe. Toda conversa aparece na tela **WhatsApp**,
de onde a equipe também responde.

Configuração (uma vez): **Configurações → WhatsApp e agente** tem o passo a passo. Resumo:
- Conta Meta + app com o produto WhatsApp e um número exclusivo da empresa.
- Copiar `.env.example` para `.env` e preencher `WHATSAPP_*` e `ANTHROPIC_API_KEY`.
- Rodar `tunel-whatsapp.bat` (endereço HTTPS para o webhook) e cadastrar a URL na Meta.
- Criar o modelo de mensagem `aviso_mk_motos` (necessário para avisos fora da janela de 24h).

Pela internet só ficam acessíveis o webhook do WhatsApp e o GPS; o painel responde apenas na rede local.

Formatos aceitos no mesmo endereço:

| Origem | Como configurar |
|---|---|
| App **Traccar Client** no celular | URL do servidor = `http://IP:8000/api/gps`, identificador = IMEI cadastrado |
| Rastreador veicular (GT06, TK103, Suntech…) via **Traccar Server** | `forward.url = http://IP:8000/api/gps/traccar`, `forward.json = true` |
| Plataforma do fornecedor / integração própria | `POST /api/gps` com JSON `{"imei":"...","lat":-23.5,"lon":-46.6,"odometroKm":1520}` |

Sem GPS, use **Frota → Lançar km** com a leitura do painel: as mesmas cobranças e alertas são gerados.

## Automações (rodam sozinhas)

- Gera a **mensalidade** (ou semanalidade) de cada contrato alguns dias antes do vencimento.
- Marca cobranças vencidas como **Atrasado**, e o cliente/moto/aluguel como em atraso.
- Marca contratos vencidos e avisa.
- Calcula todos os indicadores, gráficos, alertas e notificações a partir dos dados (nada fixo).

## Para desenvolvedores

```bash
npm install
npm run dev      # servidor + Vite com recarga automática em http://localhost:8000
npm run lint     # verificação de tipos (TypeScript)
npm start        # build de produção + servidor na porta 8000
```

Estrutura:

- `server/` — API Express, banco SQLite (`node:sqlite`), GPS e automações
  - `banco.ts` armazenamento · `automacao.ts` km/cobranças/rotinas · `gps.ts` recepção de posições
  - `acoes.ts` todas as ações com validação · `index.ts` servidor HTTP, tempo real (SSE)
- `src/` — interface React + Tailwind
  - `context/AppContext.tsx` conversa com a API · `lib/indicadores.ts` KPIs e alertas
