// Indicadores e alertas calculados a partir dos dados reais (nada fixo no código).
import type {
  AlertaSistema,
  EstadoSistema,
  LeadOrigin,
  ManutencaoItem,
  Moto,
  Pagamento,
} from '../types/mkMotos';
import { MESES_CURTOS, diasEntre, inicioDoDia, parseBR, parseCompetencia } from './datas';
import { brl } from './formato';

export const emAberto = (p: Pagamento) => p.status !== 'Pago';

/** Mês de referência do pagamento: data em que foi pago, senão a competência. */
function mesDoPagamento(p: Pagamento): { mes: number; ano: number } | null {
  const pago = parseBR(p.dataPagamento);
  if (pago) return { mes: pago.getMonth(), ano: pago.getFullYear() };
  return parseCompetencia(p.competencia);
}

export interface MesSerie {
  rotulo: string;
  mes: number;
  ano: number;
  receita: number;
  despesas: number;
  motosAlugadas: number;
}

export function serieMensal(e: EstadoSistema, meses = 6): MesSerie[] {
  const hoje = new Date();
  const serie: MesSerie[] = [];
  for (let i = meses - 1; i >= 0; i--) {
    const ref = new Date(hoje.getFullYear(), hoje.getMonth() - i, 1);
    const fimMes = new Date(ref.getFullYear(), ref.getMonth() + 1, 0);
    const mes = ref.getMonth();
    const ano = ref.getFullYear();
    const receita = e.pagamentos
      .filter((p) => p.status === 'Pago')
      .filter((p) => {
        const m = mesDoPagamento(p);
        return m && m.mes === mes && m.ano === ano;
      })
      .reduce((s, p) => s + p.valor, 0);
    const despesas = e.manutencoes
      .filter((m) => {
        const d = parseBR(m.data);
        return m.concluida && d && d.getMonth() === mes && d.getFullYear() === ano;
      })
      .reduce((s, m) => s + m.custo, 0);
    const motosAlugadas = e.alugueis.filter((a) => {
      const ini = parseBR(a.dataInicio);
      const fim = parseBR(a.dataPrevista);
      if (!ini || ini > fimMes) return false;
      if (a.status === 'Finalizado') return !!fim && fim >= ref;
      return true;
    }).length;
    serie.push({ rotulo: MESES_CURTOS[mes], mes, ano, receita, despesas, motosAlugadas });
  }
  return serie;
}

export function resumoFrota(motos: Moto[]) {
  const total = motos.length;
  const alugadas = motos.filter((m) => m.status === 'ALUGADA' || m.status === 'ATRASADA').length;
  const atrasadas = motos.filter((m) => m.status === 'ATRASADA').length;
  const disponiveis = motos.filter((m) => m.status === 'DISPONÍVEL').length;
  const manutencao = motos.filter((m) => m.status === 'MANUTENÇÃO').length;
  const comGps = motos.filter((m) => m.gpsImei).length;
  return {
    total,
    alugadas,
    atrasadas,
    disponiveis,
    manutencao,
    comGps,
    ocupacao: total ? (alugadas / total) * 100 : 0,
  };
}

export function resumoFinanceiro(e: EstadoSistema) {
  const hoje = new Date();
  const mes = hoje.getMonth();
  const ano = hoje.getFullYear();
  const doMes = (p: Pagamento) => {
    const v = parseBR(p.vencimento);
    return !!v && v.getMonth() === mes && v.getFullYear() === ano;
  };
  const recebidoMes = e.pagamentos
    .filter((p) => p.status === 'Pago')
    .filter((p) => {
      const d = parseBR(p.dataPagamento);
      return d && d.getMonth() === mes && d.getFullYear() === ano;
    })
    .reduce((s, p) => s + p.valor, 0);
  const previstoMes = e.pagamentos.filter(doMes).reduce((s, p) => s + p.valor, 0);
  const aReceber = e.pagamentos.filter((p) => p.status === 'Pendente').reduce((s, p) => s + p.valor, 0);
  const atrasados = e.pagamentos.filter((p) => p.status === 'Atrasado');
  const atrasado = atrasados.reduce((s, p) => s + p.valor, 0);
  const despesasMes = e.manutencoes
    .filter((m) => {
      const d = parseBR(m.data);
      return m.concluida && d && d.getMonth() === mes && d.getFullYear() === ano;
    })
    .reduce((s, m) => s + m.custo, 0);
  const clientesAtrasados = new Set(atrasados.map((p) => p.clienteId)).size;
  const cobrancasKm = e.pagamentos.filter((p) => p.tipo === 'Km rodado' || p.tipo === 'Peças / Manutenção');
  const carteira = e.pagamentos.reduce((s, p) => s + p.valor, 0);
  return {
    recebidoMes,
    previstoMes,
    aReceber,
    atrasado,
    despesasMes,
    clientesAtrasados,
    lucroMes: recebidoMes - despesasMes,
    margemMes: recebidoMes ? ((recebidoMes - despesasMes) / recebidoMes) * 100 : 0,
    inadimplencia: carteira ? (atrasado / carteira) * 100 : 0,
    totalCobrancasKm: cobrancasKm.reduce((s, p) => s + p.valor, 0),
  };
}

export function situacaoRevisao(m: Moto) {
  const falta = m.proximaRevisaoKm - m.kmAtual;
  return { falta, vencida: falta <= 0, proxima: falta > 0 && falta <= 500 };
}

export function manutencoesAbertas(manutencoes: ManutencaoItem[]) {
  return manutencoes.filter((m) => !m.concluida);
}

export const CORES_ORIGEM: Record<LeadOrigin, string> = {
  Instagram: '#E50914',
  WhatsApp: '#087BFF',
  Google: '#0B0B0B',
  Anúncios: '#475569',
  Indicação: '#94A3B8',
};

export function origemLeads(e: EstadoSistema) {
  const origens: LeadOrigin[] = ['Instagram', 'WhatsApp', 'Google', 'Anúncios', 'Indicação'];
  const contagem = origens.map((o) => ({
    origem: o,
    quantidade: e.leads.filter((l) => l.origem === o).length + e.clientes.filter((c) => c.origemLead === o && !e.leads.some((l) => l.convertidoClienteId === c.id)).length,
    cor: CORES_ORIGEM[o],
  }));
  const total = contagem.reduce((s, c) => s + c.quantidade, 0);
  return contagem
    .map((c) => ({ ...c, percentual: total ? Math.round((c.quantidade / total) * 100) : 0 }))
    .sort((a, b) => b.quantidade - a.quantidade);
}

export function taxaConversao(e: EstadoSistema) {
  const total = e.leads.length;
  const convertidos = e.leads.filter((l) => l.stage === 'ALUGUEL REALIZADO').length;
  return total ? (convertidos / total) * 100 : 0;
}

export function cadastroIncompleto(c: { cpf: string; cnh: string; endereco: string }) {
  return !c.cpf || !c.cnh || !c.endereco;
}

/** Alertas do painel e do sino de notificações. */
export function calcularAlertas(e: EstadoSistema): AlertaSistema[] {
  const alertas: AlertaSistema[] = [];
  const hoje = inicioDoDia();
  const nomeCli = (id: string) => e.clientes.find((c) => c.id === id)?.nome ?? 'Cliente';
  const listar = (itens: string[]) => (itens.length > 3 ? `${itens.slice(0, 3).join(', ')} e mais ${itens.length - 3}` : itens.join(', '));

  const atrasados = e.pagamentos.filter((p) => p.status === 'Atrasado');
  if (atrasados.length) {
    const total = atrasados.reduce((s, p) => s + p.valor, 0);
    alertas.push({
      id: 'pag-atrasados',
      titulo: `${atrasados.length} cobrança${atrasados.length > 1 ? 's' : ''} em atraso (${brl(total)})`,
      detalhe: listar([...new Set(atrasados.map((p) => nomeCli(p.clienteId)))]),
      severidade: 'alta',
      destinoTab: 'financeiro',
    });
  }

  const vencendo = e.pagamentos.filter((p) => {
    const v = parseBR(p.vencimento);
    if (p.status !== 'Pendente' || !v) return false;
    const dias = diasEntre(hoje, v);
    return dias >= 0 && dias <= e.config.diasAvisoVencimento;
  });
  if (vencendo.length) {
    alertas.push({
      id: 'pag-vencendo',
      titulo: `${vencendo.length} pagamento${vencendo.length > 1 ? 's' : ''} vencendo em até ${e.config.diasAvisoVencimento} dias`,
      detalhe: listar(vencendo.map((p) => `${nomeCli(p.clienteId)} (${p.vencimento.slice(0, 5)})`)),
      severidade: 'media',
      destinoTab: 'financeiro',
    });
  }

  const contratosVencidos = e.contratos.filter((c) => c.status === 'Vencido');
  if (contratosVencidos.length) {
    alertas.push({
      id: 'ctr-vencidos',
      titulo: `${contratosVencidos.length} contrato${contratosVencidos.length > 1 ? 's' : ''} vencido${contratosVencidos.length > 1 ? 's' : ''}`,
      detalhe: listar(contratosVencidos.map((c) => `${c.numero} — ${nomeCli(c.clienteId)}`)),
      severidade: 'alta',
      destinoTab: 'contratos',
    });
  }

  const pecas = e.manutencoes.filter((m) => !m.concluida && m.origem === 'automatica');
  if (pecas.length) {
    alertas.push({
      id: 'pecas',
      titulo: `${pecas.length} troca${pecas.length > 1 ? 's' : ''} de peça/óleo pendente${pecas.length > 1 ? 's' : ''}`,
      detalhe: listar(
        pecas.map((m) => {
          const moto = e.motos.find((x) => x.id === m.motoId);
          return `${m.tipo} ${moto?.placa ?? ''}`;
        })
      ),
      severidade: 'media',
      destinoTab: 'manutencao',
    });
  }

  const revisao = e.motos.filter((m) => m.status !== 'MANUTENÇÃO' && situacaoRevisao(m).falta <= 500);
  if (revisao.length) {
    alertas.push({
      id: 'revisao',
      titulo: `${revisao.length} moto${revisao.length > 1 ? 's' : ''} com revisão próxima ou vencida`,
      detalhe: listar(
        revisao.map((m) => {
          const f = situacaoRevisao(m).falta;
          return `${m.placa} (${f > 0 ? `faltam ${Math.round(f)} km` : `vencida há ${Math.round(-f)} km`})`;
        })
      ),
      severidade: 'media',
      destinoTab: 'manutencao',
    });
  }

  const semSinal = e.motos.filter((m) => {
    if (!m.gpsImei || !m.clienteAtualId) return false;
    const ultima = m.gpsUltimaPosicao?.dataHora;
    return !ultima || Date.now() - new Date(ultima).getTime() > 24 * 3.6e6;
  });
  if (semSinal.length) {
    alertas.push({
      id: 'gps',
      titulo: `${semSinal.length} rastreador${semSinal.length > 1 ? 'es' : ''} sem sinal há mais de 24h`,
      detalhe: listar(semSinal.map((m) => `${m.modelo} ${m.placa}`)),
      severidade: 'media',
      destinoTab: 'frota',
    });
  }

  const aguardando = e.contratos.filter((c) => c.status === 'Aguardando assinatura');
  if (aguardando.length) {
    alertas.push({
      id: 'assinatura',
      titulo: `${aguardando.length} contrato${aguardando.length > 1 ? 's' : ''} aguardando assinatura`,
      detalhe: listar(aguardando.map((c) => `${c.numero} — ${nomeCli(c.clienteId)}`)),
      severidade: 'info',
      destinoTab: 'contratos',
    });
  }

  const incompletos = e.clientes.filter(cadastroIncompleto);
  if (incompletos.length) {
    alertas.push({
      id: 'cadastro',
      titulo: `${incompletos.length} cliente${incompletos.length > 1 ? 's' : ''} com cadastro incompleto`,
      detalhe: listar(incompletos.map((c) => c.nome)),
      severidade: 'info',
      destinoTab: 'clientes',
    });
  }

  return alertas;
}
