import type {
  AtividadeRecente,
  Aluguel,
  Cliente,
  Contrato,
  ManutencaoItem,
  Moto,
  Oficina,
  Pagamento,
} from '../src/types/mkMotos';
import {
  competenciaDe,
  formatBR,
  hojeBR,
  inicioDoDia,
  parseBR,
  somarDias,
  somarMeses,
} from '../src/lib/datas';
import { brl } from '../src/lib/formato';
import type { Banco } from './banco';
import { avisarDono, enfileirar } from './whatsapp';

export class ErroNegocio extends Error {}

export { novoId } from './util';
import { novoId } from './util';

const arred = (v: number) => Math.round(v * 10) / 10;

export function registrarAtividade(
  b: Banco,
  a: Omit<AtividadeRecente, 'id' | 'horario' | 'criadoEm'>
) {
  b.salvar<AtividadeRecente>('atividades', {
    ...a,
    id: novoId('ativ'),
    horario: '',
    criadoEm: new Date().toISOString(),
  });
}

/** Aplica alterações e só grava se algo mudou. */
function atualizar<T extends { id: string }>(
  b: Banco,
  colecao: Parameters<Banco['salvar']>[0],
  doc: T,
  patch: Partial<T>
): boolean {
  const antes = JSON.stringify(doc);
  Object.assign(doc, patch);
  for (const k of Object.keys(patch)) {
    if ((patch as Record<string, unknown>)[k] === undefined) delete (doc as Record<string, unknown>)[k];
  }
  if (JSON.stringify(doc) === antes) return false;
  b.salvar(colecao, doc);
  return true;
}

function novaCobranca(
  b: Banco,
  c: Contrato,
  dados: Pick<Pagamento, 'valor' | 'vencimento' | 'tipo' | 'descricao' | 'competencia'> &
    Partial<Pick<Pagamento, 'status' | 'dataPagamento' | 'formaPagamento'>>
): Pagamento {
  const ultima = b.lista<Pagamento>('pagamentos').find((p) => p.contratoId === c.id);
  return b.salvar<Pagamento>('pagamentos', {
    id: novoId('pag'),
    clienteId: c.clienteId,
    contratoId: c.id,
    motoId: c.motoId,
    formaPagamento: dados.formaPagamento ?? ultima?.formaPagamento ?? 'PIX',
    status: dados.status ?? 'Pendente',
    ...dados,
  });
}

// ---------------------------------------------------------------------------
// QUILOMETRAGEM (GPS ou leitura manual do hodômetro)
// ---------------------------------------------------------------------------

/** Soma km rodados na moto e no contrato atual e dispara as cobranças/alertas. */
export function processarKm(b: Banco, moto: Moto, delta: number, origem: string) {
  if (!(delta > 0)) return;
  moto.kmAtual = arred(moto.kmAtual + delta);
  b.salvar('motos', moto);

  const contrato = b.lista<Contrato>('contratos').find((c) => c.id === moto.contratoAtualId);
  if (contrato && contrato.status !== 'Finalizado') {
    contrato.kmRodados = arred((contrato.kmRodados ?? 0) + delta);
    b.salvar('contratos', contrato);
    cobrarCiclosDeKm(b, contrato, moto);
  }
  verificarPlanoDePecas(b, moto);

  if (origem === 'manual') {
    registrarAtividade(b, {
      titulo: `Leitura de km registrada — ${moto.modelo}`,
      subtitulo: `Placa ${moto.placa}: +${arred(delta)} km (total ${moto.kmAtual.toLocaleString('pt-BR')} km)`,
      tipo: 'gps',
      referenciaId: moto.id,
    });
  }
}

/** A cada N km rodados no contrato (padrão 1.000 km), gera uma cobrança para o cliente. */
function cobrarCiclosDeKm(b: Banco, contrato: Contrato, moto: Moto) {
  const regra = b.config.cobrancaKm;
  if (!(regra.kmPorCiclo > 0)) return;
  const ciclos = Math.floor((contrato.kmRodados ?? 0) / regra.kmPorCiclo);
  let cobrados = contrato.kmCiclosCobrados ?? 0;
  if (ciclos <= cobrados) return;

  if (!regra.ativo || !(regra.valorPorCiclo > 0)) {
    // Cobrança desligada: só avança o contador para não cobrar retroativo ao religar.
    contrato.kmCiclosCobrados = ciclos;
    b.salvar('contratos', contrato);
    return;
  }

  const cliente = b.lista<Cliente>('clientes').find((c) => c.id === contrato.clienteId);
  const hoje = new Date();
  while (cobrados < ciclos) {
    cobrados++;
    const kmMarco = cobrados * regra.kmPorCiclo;
    novaCobranca(b, contrato, {
      tipo: 'Km rodado',
      descricao: `${kmMarco.toLocaleString('pt-BR')} km rodados — ${moto.modelo} (${moto.placa})`,
      competencia: competenciaDe(hoje),
      valor: regra.valorPorCiclo,
      vencimento: formatBR(somarDias(hoje, regra.diasParaVencimento)),
    });
    registrarAtividade(b, {
      titulo: `Cobrança automática por km — ${cliente?.nome ?? 'Cliente'}`,
      subtitulo: `${kmMarco.toLocaleString('pt-BR')} km rodados no contrato ${contrato.numero} • ${brl(regra.valorPorCiclo)}`,
      tipo: 'pagamento',
      referenciaId: contrato.clienteId,
    });
  }
  contrato.kmCiclosCobrados = cobrados;
  b.salvar('contratos', contrato);
}

export function oficinaDaOrdem(b: Banco, item?: Pick<ManutencaoItem, 'oficinaId'>): Oficina {
  const ofs = b.config.oficinas;
  return ofs.find((o) => o.id === item?.oficinaId) ?? ofs.find((o) => o.id === b.config.oficinaPadraoId) ?? ofs[0];
}

/** Mensagem de WhatsApp para o cliente fazer a troca na oficina credenciada e mandar o comprovante. */
export function textoAvisoTroca(b: Banco, item: ManutencaoItem, moto: Moto, lembrete: boolean): string {
  const peca = b.config.planoPecas.find((p) => p.id === item.pecaId);
  const oficina = oficinaDaOrdem(b, item);
  const servico = peca?.nome ?? item.tipo;
  return (
    `${lembrete ? 'Lembrete: ainda não recebemos o comprovante da' : 'Sua moto'} ${lembrete ? servico.toLowerCase() : `${moto.modelo} (${moto.placa}) chegou a ${Math.round(moto.kmAtual).toLocaleString('pt-BR')} km e precisa de ${servico.toLowerCase()}`}. ` +
    `Faça o serviço na ${oficina.nome} (${oficina.endereco}${oficina.telefone ? `, tel. ${oficina.telefone}` : ''}) ` +
    'e envie a foto do comprovante respondendo esta mensagem'
  );
}

/** Quando uma peça do plano atinge o intervalo de km, abre a ordem e avisa o cliente (sem cobrar). */
export function verificarPlanoDePecas(b: Banco, moto: Moto) {
  const ultimas = moto.pecasUltimaTrocaKm ?? {};
  const manutencoes = b.lista<ManutencaoItem>('manutencoes');
  const cliente = b.lista<Cliente>('clientes').find((c) => c.id === moto.clienteAtualId);
  for (const peca of b.config.planoPecas) {
    if (!(peca.intervaloKm > 0)) continue;
    const base = ultimas[peca.id];
    if (base === undefined) continue;
    const rodado = moto.kmAtual - base;
    if (rodado < peca.intervaloKm) continue;
    const jaAberta = manutencoes.some(
      (m) => m.motoId === moto.id && m.pecaId === peca.id && !m.concluida
    );
    if (jaAberta) continue;

    const item = b.salvar<ManutencaoItem>('manutencoes', {
      id: novoId('man'),
      motoId: moto.id,
      tipo: peca.tipo,
      pecaId: peca.id,
      origem: 'automatica',
      situacao: 'aguardando_comprovante',
      oficinaId: b.config.oficinaPadraoId,
      data: hojeBR(),
      kmNaManutencao: moto.kmAtual,
      custo: 0,
      oficina: oficinaDaOrdem(b).nome,
      observacao: `${peca.nome}: ${Math.round(rodado).toLocaleString('pt-BR')} km desde a última troca (intervalo de ${peca.intervaloKm.toLocaleString('pt-BR')} km).`,
      concluida: false,
      comprovantes: [],
      avisosEnviados: 0,
    });

    let complemento = 'Moto sem cliente — fazer a troca no pátio.';
    if (cliente && peca.exigirComprovante && b.config.whatsapp.avisarTrocas) {
      enfileirar(b, { telefone: cliente.telefone, clienteId: cliente.id, texto: textoAvisoTroca(b, item, moto, false), motivo: 'troca' });
      item.avisosEnviados = 1;
      item.ultimoAvisoKm = moto.kmAtual;
      b.salvar('manutencoes', item);
      complemento = `${cliente.nome} foi avisado pelo WhatsApp para trocar na oficina credenciada e enviar o comprovante.`;
    } else if (cliente) {
      complemento = `Cliente: ${cliente.nome}. Aguardando comprovante.`;
    }
    registrarAtividade(b, {
      titulo: `Troca necessária: ${peca.nome} — ${moto.modelo}`,
      subtitulo: `Placa ${moto.placa}. ${complemento}`,
      tipo: 'manutencao',
      referenciaId: moto.id,
    });
  }
  lembrarTrocasPendentes(b, moto, cliente);
}

/** Reenvia o aviso a cada X km sem comprovante e avisa o dono quando passa da tolerância. */
function lembrarTrocasPendentes(b: Banco, moto: Moto, cliente: Cliente | undefined) {
  const { lembreteACadaKm, toleranciaKm } = b.config.trocas;
  for (const item of b.lista<ManutencaoItem>('manutencoes')) {
    if (item.motoId !== moto.id || item.concluida || item.origem !== 'automatica') continue;
    if (item.situacao === 'em_analise') continue; // comprovante já chegou, aguardando o dono
    const peca = b.config.planoPecas.find((p) => p.id === item.pecaId);
    if (!peca?.exigirComprovante) continue;

    if (cliente && b.config.whatsapp.avisarTrocas && lembreteACadaKm > 0 &&
        moto.kmAtual - (item.ultimoAvisoKm ?? item.kmNaManutencao) >= lembreteACadaKm) {
      enfileirar(b, { telefone: cliente.telefone, clienteId: cliente.id, texto: textoAvisoTroca(b, item, moto, true), motivo: 'lembrete_troca' });
      item.avisosEnviados = (item.avisosEnviados ?? 0) + 1;
      item.ultimoAvisoKm = moto.kmAtual;
      b.salvar('manutencoes', item);
    }

    const passou = moto.kmAtual - item.kmNaManutencao;
    if (!item.atrasoAvisado && toleranciaKm > 0 && passou >= toleranciaKm) {
      item.atrasoAvisado = true;
      b.salvar('manutencoes', item);
      const msg = `${peca.nome} da ${moto.modelo} (${moto.placa}) está atrasada: ${Math.round(passou)} km além do prazo, sem comprovante${cliente ? ` (cliente ${cliente.nome}, ${cliente.telefone})` : ''}`;
      registrarAtividade(b, { titulo: 'Troca atrasada sem comprovante', subtitulo: msg, tipo: 'manutencao', referenciaId: moto.id });
      avisarDono(b, msg);
    }
  }
}

/** Marca a peça como trocada naquela quilometragem (zera o contador do plano). */
export function registrarTrocaDePeca(b: Banco, moto: Moto, pecaId: string, km: number) {
  moto.pecasUltimaTrocaKm = { ...(moto.pecasUltimaTrocaKm ?? {}), [pecaId]: km };
  b.salvar('motos', moto);
}

// ---------------------------------------------------------------------------
// ROTINAS (rodam ao iniciar o servidor, a cada 15 min e após cada ação)
// ---------------------------------------------------------------------------

/** Define o ponto de partida do plano de peças para motos que ainda não têm. */
function iniciarPlanoDePecas(b: Banco) {
  const manutencoes = b.lista<ManutencaoItem>('manutencoes');
  for (const moto of b.lista<Moto>('motos')) {
    const atual = moto.pecasUltimaTrocaKm ?? {};
    let mudou = false;
    for (const peca of b.config.planoPecas) {
      if (atual[peca.id] !== undefined) continue;
      const ultimaDoTipo = manutencoes
        .filter((m) => m.motoId === moto.id && m.concluida && m.tipo === peca.tipo)
        .sort((x, y) => y.kmNaManutencao - x.kmNaManutencao)[0];
      atual[peca.id] =
        ultimaDoTipo?.kmNaManutencao ?? (peca.tipo === 'Revisão' ? moto.ultimaRevisaoKm : moto.kmAtual);
      mudou = true;
    }
    if (mudou) {
      moto.pecasUltimaTrocaKm = atual;
      b.salvar('motos', moto);
      verificarPlanoDePecas(b, moto);
    }
  }
}

/** Gera as mensalidades (ou semanalidades) dos contratos em andamento. */
function gerarMensalidades(b: Banco) {
  const hoje = inicioDoDia();
  const limite = somarDias(hoje, b.config.diasAvisoVencimento);
  const pagamentos = b.lista<Pagamento>('pagamentos');

  for (const c of b.lista<Contrato>('contratos')) {
    if (c.status === 'Finalizado' || c.status === 'Aguardando assinatura') continue;
    const inicio = parseBR(c.dataEmissao);
    const fim = parseBR(c.dataVencimento);
    if (!inicio) continue;

    const semanal = c.plano === 'Semanal';
    const doContrato = pagamentos.filter(
      (p) => p.contratoId === c.id && (p.tipo ?? 'Mensalidade') === 'Mensalidade'
    );
    // Não gera retroativo antes da última mensalidade já existente
    const ultimaVenc = doContrato
      .map((p) => parseBR(p.vencimento))
      .filter((d): d is Date => !!d)
      .sort((x, y) => y.getTime() - x.getTime())[0];

    for (let k = 0; k < 600; k++) {
      const venc = semanal ? somarDias(inicio, 7 * k) : somarMeses(inicio, k);
      if (venc > limite) break;
      if (fim && venc >= fim) break;
      if (ultimaVenc && venc <= ultimaVenc) continue;
      if (!ultimaVenc && venc < somarDias(hoje, -31)) continue;

      const competencia = semanal ? `Semana de ${formatBR(venc)}` : competenciaDe(venc);
      const existe = doContrato.some((p) => p.competencia === competencia);
      if (existe) continue;
      const nova = novaCobranca(b, c, {
        tipo: 'Mensalidade',
        descricao: semanal ? 'Locação semanal' : 'Mensalidade da locação',
        competencia,
        valor: c.valorMensal,
        vencimento: formatBR(venc),
      });
      doContrato.push(nova);
    }
  }
}

/** Mantém status de pagamentos, contratos, aluguéis, motos e clientes coerentes entre si. */
function sincronizarStatus(b: Banco) {
  const hoje = inicioDoDia();
  const pagamentos = b.lista<Pagamento>('pagamentos');

  for (const p of pagamentos) {
    const venc = parseBR(p.vencimento);
    if (p.status === 'Pendente' && venc && venc < hoje) atualizar(b, 'pagamentos', p, { status: 'Atrasado' });
  }

  for (const c of b.lista<Contrato>('contratos')) {
    const fim = parseBR(c.dataVencimento);
    if (c.status === 'Ativo' && fim && fim < hoje) {
      atualizar(b, 'contratos', c, { status: 'Vencido' });
      registrarAtividade(b, {
        titulo: `Contrato vencido — ${c.numero}`,
        subtitulo: 'Renove o contrato ou finalize o aluguel.',
        tipo: 'aluguel',
        referenciaId: c.clienteId,
      });
    }
  }

  const contratoAtrasado = new Set(
    pagamentos.filter((p) => p.status === 'Atrasado').map((p) => p.contratoId)
  );

  for (const a of b.lista<Aluguel>('alugueis')) {
    if (a.status === 'Finalizado') continue;
    const inicio = parseBR(a.dataInicio);
    const status: Aluguel['status'] =
      inicio && inicio > hoje ? 'Próximo' : contratoAtrasado.has(a.contratoId) ? 'Atrasado' : 'Ativo';
    atualizar(b, 'alugueis', a, { status });
  }

  for (const m of b.lista<Moto>('motos')) {
    if (m.status !== 'ALUGADA' && m.status !== 'ATRASADA') continue;
    if (!m.contratoAtualId) continue;
    atualizar(b, 'motos', m, { status: contratoAtrasado.has(m.contratoAtualId) ? 'ATRASADA' : 'ALUGADA' });
  }

  for (const cli of b.lista<Cliente>('clientes')) {
    const emAberto = pagamentos
      .filter((p) => p.clienteId === cli.id && p.status !== 'Pago')
      .sort((x, y) => (parseBR(x.vencimento)?.getTime() ?? 0) - (parseBR(y.vencimento)?.getTime() ?? 0));
    const status: Cliente['status'] = emAberto.some((p) => p.status === 'Atrasado')
      ? 'Em Atraso'
      : emAberto.length
      ? 'Pagamento Pendente'
      : cli.contratoAtualId
      ? 'Ativo'
      : 'Inativo';
    const proxData = emAberto[0]?.vencimento ?? '';
    atualizar(b, 'clientes', cli, {
      status,
      proximoPagamentoData: proxData,
      proximoPagamentoValor: emAberto.filter((p) => p.vencimento === proxData).reduce((s, p) => s + p.valor, 0),
    });
  }
}

/** Ajustes únicos em bancos criados por versões anteriores. Roda ao iniciar o servidor. */
export function migrarDados(b: Banco) {
  if (!b.meta('pecas-sem-cobranca')) {
    // Regra nova: o cliente não paga peças/óleo (troca na oficina credenciada e manda comprovante).
    for (const p of [...b.lista<Pagamento>('pagamentos')]) {
      if (p.tipo === 'Peças / Manutenção' && p.status !== 'Pago') b.remover('pagamentos', p.id);
    }
    for (const m of b.lista<ManutencaoItem>('manutencoes')) {
      if (m.origem === 'automatica' && !m.concluida && !m.situacao) {
        m.situacao = 'aguardando_comprovante';
        m.oficinaId = b.config.oficinaPadraoId;
        m.comprovantes = m.comprovantes ?? [];
        b.salvar('manutencoes', m);
      }
    }
    b.definirMeta('pecas-sem-cobranca', new Date().toISOString());
  }
}

/** Ordem: plano de peças → mensalidades → status. */
export function executarRotinas(b: Banco) {
  iniciarPlanoDePecas(b);
  gerarMensalidades(b);
  sincronizarStatus(b);
}
