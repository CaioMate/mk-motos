// Retenção de dados (LGPD): nada fica guardado além de `config.retencaoMeses` (padrão 24 meses).
// Roda dentro de executarRotinas, no máximo 1x por dia. Motos NUNCA são apagadas.
import type { AtividadeRecente, Aluguel, Cliente, Contrato, Lead, MensagemWhatsApp, Pagamento } from '../src/types/mkMotos';
import { parseBR, somarMeses } from '../src/lib/datas';
import type { Banco } from './banco';
import { registrarAtividade } from './automacao';
import { chaveTelefone } from './whatsapp';

const hojeIso = () => new Date().toISOString().slice(0, 10);
const maxData = (datas: Array<Date | null>): number => Math.max(0, ...datas.map((d) => d?.getTime() ?? 0));

/** Apaga o que passou do prazo. Devolve quantos registros (e arquivos) foram removidos. */
export function limpezaAutomatica(b: Banco, forcar = false): number {
  if (!forcar && b.meta('limpeza-ultima') === hojeIso()) return 0;
  const meses = b.config.retencaoMeses;
  const limite = somarMeses(new Date(), -meses);
  const limiteIso = limite.toISOString();
  let total = 0;

  // GPS: posições e viagens
  total += b.apagarGpsAnterior(limiteIso);

  // Mensagens (e os arquivos que o cliente mandou pelo WhatsApp)
  for (const m of [...b.lista<MensagemWhatsApp>('mensagens')]) {
    if (m.criadoEm && m.criadoEm < limiteIso) {
      if (m.arquivo) b.apagarArquivo('comprovantes', m.arquivo);
      b.remover('mensagens', m.id);
      total++;
    }
  }

  // Histórico de atividades
  for (const a of [...b.lista<AtividadeRecente>('atividades')]) {
    if (a.criadoEm && a.criadoEm < limiteIso) {
      b.remover('atividades', a.id);
      total++;
    }
  }

  // Clientes encerrados há mais do prazo e sem nada em aberto: saem com contratos, aluguéis, pagamentos, mensagens e arquivos
  const pagamentos = b.lista<Pagamento>('pagamentos');
  const contratos = b.lista<Contrato>('contratos');
  for (const cli of [...b.lista<Cliente>('clientes')]) {
    if (cli.contratoAtualId || cli.motoAtualId) continue;
    const dele = contratos.filter((c) => c.clienteId === cli.id);
    if (dele.some((c) => c.status === 'Ativo' || c.status === 'Aguardando assinatura')) continue;
    const pgDele = pagamentos.filter((p) => p.clienteId === cli.id);
    if (pgDele.some((p) => p.status !== 'Pago')) continue;
    const ultima = maxData([
      ...dele.map((c) => parseBR(c.dataVencimento)),
      ...dele.map((c) => parseBR(c.dataEmissao)),
      ...pgDele.map((p) => parseBR(p.dataPagamento) ?? parseBR(p.vencimento)),
    ]);
    // sem contrato nem pagamento: vale a data do cadastro (se não tiver data válida, não apaga)
    const referencia = ultima || (parseBR(cli.dataCadastro)?.getTime() ?? Date.now());
    if (referencia >= limite.getTime()) continue;

    const chave = chaveTelefone(cli.telefone);
    for (const m of [...b.lista<MensagemWhatsApp>('mensagens')]) {
      if (m.clienteId === cli.id || (chave && chaveTelefone(m.telefone) === chave)) {
        if (m.arquivo) b.apagarArquivo('comprovantes', m.arquivo);
        b.remover('mensagens', m.id);
        total++;
      }
    }
    for (const p of pgDele) {
      b.remover('pagamentos', p.id);
      total++;
    }
    for (const c of dele) {
      b.remover('contratos', c.id);
      total++;
    }
    for (const a of [...b.lista<Aluguel>('alugueis')].filter((x) => x.clienteId === cli.id)) {
      b.remover('alugueis', a.id);
      total++;
    }
    for (const l of [...b.lista<Lead>('leads')].filter((x) => x.convertidoClienteId === cli.id)) {
      b.remover('leads', l.id);
      total++;
    }
    b.remover('clientes', cli.id);
    total++;
  }

  b.definirMeta('limpeza-ultima', hojeIso());
  if (total > 0) {
    registrarAtividade(b, {
      titulo: `Limpeza automática: ${total} registros antigos apagados (regra de ${meses === 24 ? '2 anos' : `${meses} meses`})`,
      subtitulo: 'Dados pessoais e de GPS guardados só pelo prazo definido em Configurações (LGPD).',
      tipo: 'cliente',
    });
  }
  return total;
}
