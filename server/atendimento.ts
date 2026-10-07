// Recebe as mensagens do WhatsApp (webhook da Meta), guarda comprovantes e responde com o agente.
import fs from 'node:fs';
import path from 'node:path';
import type {
  Cliente,
  Comprovante,
  Contrato,
  ManutencaoItem,
  MensagemWhatsApp,
  Moto,
  Pagamento,
} from '../src/types/mkMotos';
import { brl } from '../src/lib/formato';
import type { Banco } from './banco';
import { oficinaDaOrdem, registrarAtividade } from './automacao';
import { novoId } from './util';
import { analisarComprovante, iaConfigurada, responderCliente } from './agente';
import { avisarDono, baixarMidia, chaveTelefone, clientePorTelefone, enfileirar } from './whatsapp';

const EXTENSOES: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
  'application/pdf': 'pdf',
};

/** Ordem de troca aberta mais antiga da moto do cliente (onde o comprovante vai ser anexado). */
export function ordemAguardandoComprovante(b: Banco, cliente: Cliente | undefined): ManutencaoItem | undefined {
  if (!cliente?.motoAtualId) return undefined;
  // lista vem da mais nova para a mais antiga; prioriza as que ainda esperam comprovante
  const abertas = b
    .lista<ManutencaoItem>('manutencoes')
    .filter((m) => m.motoId === cliente.motoAtualId && !m.concluida && m.origem === 'automatica')
    .reverse();
  return abertas.find((m) => m.situacao !== 'em_analise') ?? abertas[0];
}

/** Salva o arquivo e anexa à ordem de manutenção, com a leitura da IA quando disponível. */
export async function registrarComprovante(
  b: Banco,
  item: ManutencaoItem,
  dados: Buffer,
  mime: string,
  origem: Comprovante['origem']
): Promise<Comprovante> {
  const ext = EXTENSOES[mime];
  if (!ext) throw new Error('Envie o comprovante como foto (JPG/PNG) ou PDF.');
  const id = novoId('comp');
  const arquivo = `${id}.${ext}`;
  fs.writeFileSync(path.join(b.pastaComprovantes, arquivo), dados);

  const moto = b.lista<Moto>('motos').find((m) => m.id === item.motoId);
  const peca = b.config.planoPecas.find((p) => p.id === item.pecaId);
  const oficina = oficinaDaOrdem(b, item);
  let analise: Comprovante['analise'];
  try {
    analise =
      (await analisarComprovante(dados, mime, {
        servicoEsperado: peca?.nome ?? item.tipo,
        oficinaNome: oficina.nome,
        oficinaEndereco: oficina.endereco,
        kmMoto: moto?.kmAtual ?? item.kmNaManutencao,
        placa: moto?.placa ?? '',
      })) ?? undefined;
  } catch (e) {
    console.warn('[IA] Não foi possível analisar o comprovante:', e instanceof Error ? e.message : e);
  }

  const comprovante: Comprovante = {
    id,
    arquivo,
    mime,
    recebidoEm: new Date().toISOString(),
    origem,
    status: 'pendente',
    analise,
  };
  b.transacao(() => {
    const atual = b.lista<ManutencaoItem>('manutencoes').find((m) => m.id === item.id)!;
    atual.comprovantes = [...(atual.comprovantes ?? []), comprovante];
    atual.situacao = 'em_analise';
    b.salvar('manutencoes', atual);
  });
  return comprovante;
}

/** Resumo da situação do cliente para o agente responder. */
function fichaDoCliente(b: Banco, cli: Cliente): string {
  const moto = b.lista<Moto>('motos').find((m) => m.id === cli.motoAtualId);
  const ctr = b.lista<Contrato>('contratos').find((c) => c.id === cli.contratoAtualId);
  const abertos = b.lista<Pagamento>('pagamentos').filter((p) => p.clienteId === cli.id && p.status !== 'Pago');
  const trocas = b
    .lista<ManutencaoItem>('manutencoes')
    .filter((m) => m.motoId === cli.motoAtualId && !m.concluida && m.origem === 'automatica');
  const linhas = [
    `Nome: ${cli.nome}`,
    moto ? `Moto: ${moto.modelo}, placa ${moto.placa}, ${Math.round(moto.kmAtual)} km` : 'Sem moto alugada no momento',
    ctr ? `Contrato ${ctr.numero}, vigência ${ctr.dataEmissao} a ${ctr.dataVencimento}, ${brl(ctr.valorMensal)} por ${ctr.plano === 'Semanal' ? 'semana' : 'mês'}` : '',
    abertos.length
      ? `Pagamentos em aberto: ${abertos.map((p) => `${p.descricao ?? p.tipo} ${brl(p.valor)} vence ${p.vencimento} (${p.status})`).join('; ')}`
      : 'Nenhum pagamento em aberto',
    b.config.empresa.pix ? `Chave PIX da empresa: ${b.config.empresa.pix}` : '',
    trocas.length
      ? `Trocas pendentes: ${trocas
          .map((t) => {
            const of = oficinaDaOrdem(b, t);
            const situacao = t.situacao === 'em_analise' ? 'comprovante recebido, em análise pela equipe' : 'aguardando o cliente fazer e mandar o comprovante';
            return `${t.tipo} — fazer na ${of.nome} (${of.endereco}) — ${situacao}`;
          })
          .join('; ')}`
      : 'Nenhuma troca de peça/óleo pendente',
    moto?.foraDaArea ? 'ATENÇÃO: o rastreador indica que a moto está fora da área permitida.' : '',
    b.config.cercaVirtual.ativo && b.config.cercaVirtual.cidades.length
      ? `Área permitida de uso: ${b.config.cercaVirtual.cidades.map((c) => c.nome).join(', ')}`
      : '',
    b.config.empresa.telefone ? `Telefone da empresa: ${b.config.empresa.telefone}` : '',
  ];
  return linhas.filter(Boolean).join('\n');
}

function respostaPadrao(b: Banco, cli: Cliente): string {
  const ordem = ordemAguardandoComprovante(b, cli);
  const partes = [`Olá ${cli.nome.split(' ')[0]}! Recebemos sua mensagem e a equipe vai responder em breve.`];
  if (ordem?.situacao === 'aguardando_comprovante') {
    const of = oficinaDaOrdem(b, ordem);
    partes.push(`Lembrete: ${ordem.tipo.toLowerCase()} pendente na ${of.nome} (${of.endereco}). Envie a foto do comprovante por aqui.`);
  }
  return partes.join(' ');
}

interface MensagemMeta {
  from: string;
  id: string;
  timestamp?: string;
  type: string;
  text?: { body: string };
  image?: { id: string; mime_type?: string; caption?: string };
  document?: { id: string; mime_type?: string; filename?: string; caption?: string };
}

/** Processa o corpo do webhook da Meta (pode trazer várias mensagens e status de entrega). */
export async function processarWebhook(b: Banco, corpo: any, aoMudar: () => void) {
  for (const entrada of corpo?.entry ?? []) {
    for (const mudanca of entrada.changes ?? []) {
      const valor = mudanca.value ?? {};
      for (const msg of (valor.messages ?? []) as MensagemMeta[]) {
        try {
          await processarMensagem(b, msg);
        } catch (e) {
          console.error('[WhatsApp] Erro ao processar mensagem:', e);
        }
        aoMudar();
      }
    }
  }
}

async function processarMensagem(b: Banco, msg: MensagemMeta) {
  // A Meta pode reenviar a mesma mensagem: ignora repetidas
  if (b.lista<MensagemWhatsApp>('mensagens').some((m) => m.waId === msg.id)) return;
  const cli = clientePorTelefone(b, msg.from);
  const midia = msg.image ?? msg.document;
  const tipo: MensagemWhatsApp['tipo'] = msg.image ? 'imagem' : msg.document ? 'documento' : msg.type === 'text' ? 'texto' : msg.type === 'audio' ? 'audio' : 'outro';
  const texto = msg.text?.body ?? midia?.caption ?? (msg.document?.filename ? `📎 ${msg.document.filename}` : '');

  const registro = b.transacao(() =>
    b.salvar<MensagemWhatsApp>('mensagens', {
      id: novoId('msg'),
      telefone: msg.from,
      clienteId: cli?.id,
      direcao: 'entrada',
      tipo,
      texto,
      status: 'recebida',
      waId: msg.id,
      criadoEm: new Date().toISOString(),
    })
  );

  const responder = (t: string, motivo: MensagemWhatsApp['motivo'] = 'agente') =>
    b.transacao(() => enfileirar(b, { telefone: msg.from, clienteId: cli?.id, texto: t, motivo: motivo ?? 'agente' }));

  if (!cli) {
    responder(
      `Olá! Aqui é o atendimento da ${b.config.empresa.nome || 'MK Motos'}. Não encontramos um cadastro com este número. ` +
        'A equipe vai entrar em contato com você.'
    );
    b.transacao(() => avisarDono(b, `Mensagem de número não cadastrado (${msg.from}): ${texto || `[${tipo}]`}`));
    return;
  }

  // ---------- Comprovante (foto ou PDF)
  if (midia) {
    const ordem = ordemAguardandoComprovante(b, cli);
    try {
      const { dados, mime } = await baixarMidia(midia.id);
      const ext = EXTENSOES[mime];
      if (ext) {
        const arquivo = `${novoId('wa')}.${ext}`;
        fs.writeFileSync(path.join(b.pastaComprovantes, arquivo), dados);
        b.transacao(() => b.salvar('mensagens', { ...registro, arquivo }));
      }
      if (!ordem) {
        responder('Recebemos seu arquivo! No momento não há troca pendente para a sua moto; a equipe vai conferir.');
        b.transacao(() => avisarDono(b, `${cli.nome} enviou um arquivo pelo WhatsApp, mas não há troca pendente. Confira em WhatsApp no sistema.`));
        return;
      }
      const comp = await registrarComprovante(b, ordem, dados, mime, 'whatsapp');
      const moto = b.lista<Moto>('motos').find((m) => m.id === ordem.motoId);
      b.transacao(() => {
        registrarAtividade(b, {
          titulo: `Comprovante recebido — ${cli.nome}`,
          subtitulo: `${ordem.tipo} da ${moto?.modelo ?? 'moto'} (${moto?.placa ?? ''}) — aguardando sua aprovação em Manutenção`,
          tipo: 'manutencao',
          referenciaId: ordem.motoId,
        });
        const leitura = comp.analise
          ? ` Leitura automática: ${comp.analise.estabelecimento || 'estabelecimento não identificado'}, ${comp.analise.data || 'sem data'}, ${comp.analise.valorTotal != null ? brl(comp.analise.valorTotal) : 'sem valor'}. ${comp.analise.observacao}`
          : '';
        avisarDono(b, `Comprovante de ${ordem.tipo.toLowerCase()} recebido de ${cli.nome} (${moto?.placa ?? ''}). Aprove em Manutenção no sistema.${leitura}`);
      });
      if (comp.analise && !comp.analise.ehComprovante) {
        responder('Recebemos sua imagem, mas ela não parece ser um comprovante do serviço. Se puder, envie uma foto nítida da nota ou recibo da oficina.', 'comprovante');
      } else {
        responder(`Recebemos o comprovante de ${ordem.tipo.toLowerCase()}, obrigado! A equipe vai conferir e te confirmar por aqui.`, 'comprovante');
      }
    } catch (e) {
      const erro = e instanceof Error ? e.message : String(e);
      console.warn('[WhatsApp] Falha com o arquivo recebido:', erro);
      responder('Não conseguimos abrir o arquivo. Pode enviar de novo como foto (JPG) ou PDF?', 'comprovante');
    }
    return;
  }

  // ---------- Texto: resposta do agente
  if (!b.config.whatsapp.agenteResponde) return; // a equipe responde manualmente pelo sistema
  const k = chaveTelefone(msg.from);
  const historico = b
    .lista<MensagemWhatsApp>('mensagens')
    .filter((m) => chaveTelefone(m.telefone) === k && m.status !== 'erro')
    .slice(0, 16)
    .reverse()
    .map((m) => ({ papel: m.direcao === 'entrada' ? ('cliente' as const) : ('empresa' as const), texto: m.texto || `[${m.tipo}]` }));

  let resposta: string | null = null;
  if (iaConfigurada()) {
    try {
      resposta = await responderCliente({ empresa: b.config.empresa.nome || 'MK Motos', ficha: fichaDoCliente(b, cli), historico });
    } catch (e) {
      console.warn('[IA] Falha ao responder:', e instanceof Error ? e.message : e);
    }
  }
  responder(resposta ?? respostaPadrao(b, cli));
}
