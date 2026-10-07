import type {
  AtividadeRecente,
  Aluguel,
  Cliente,
  Contrato,
  ManutencaoItem,
  Moto,
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

export class ErroNegocio extends Error {}

export const novoId = (prefixo: string) =>
  `${prefixo}-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;

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

/** Quando uma peça do plano atinge o intervalo de km, abre a ordem de serviço e cobra o cliente. */
export function verificarPlanoDePecas(b: Banco, moto: Moto) {
  const ultimas = moto.pecasUltimaTrocaKm ?? {};
  const manutencoes = b.lista<ManutencaoItem>('manutencoes');
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

    b.salvar<ManutencaoItem>('manutencoes', {
      id: novoId('man'),
      motoId: moto.id,
      tipo: peca.tipo,
      pecaId: peca.id,
      origem: 'automatica',
      data: hojeBR(),
      kmNaManutencao: moto.kmAtual,
      custo: 0,
      oficina: '',
      observacao: `${peca.nome}: ${Math.round(rodado).toLocaleString('pt-BR')} km desde a última troca (intervalo de ${peca.intervaloKm.toLocaleString('pt-BR')} km).`,
      concluida: false,
    });

    const contrato = b
      .lista<Contrato>('contratos')
      .find((c) => c.id === moto.contratoAtualId && c.status !== 'Finalizado');
    let complemento = 'Sem cliente vinculado — sem cobrança.';
    if (contrato && peca.cobrarCliente && peca.valorCobrado > 0) {
      const hoje = new Date();
      novaCobranca(b, contrato, {
        tipo: 'Peças / Manutenção',
        descricao: `${peca.nome} — ${moto.modelo} (${moto.placa}) aos ${Math.round(moto.kmAtual).toLocaleString('pt-BR')} km`,
        competencia: competenciaDe(hoje),
        valor: peca.valorCobrado,
        vencimento: formatBR(somarDias(hoje, b.config.cobrancaKm.diasParaVencimento)),
      });
      complemento = `Cobrança de ${brl(peca.valorCobrado)} gerada para o cliente.`;
    }
    registrarAtividade(b, {
      titulo: `Troca necessária: ${peca.nome} — ${moto.modelo}`,
      subtitulo: `Placa ${moto.placa}. ${complemento}`,
      tipo: 'manutencao',
      referenciaId: moto.id,
    });
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

/** Ordem: plano de peças → mensalidades → status. */
export function executarRotinas(b: Banco) {
  iniciarPlanoDePecas(b);
  gerarMensalidades(b);
  sincronizarStatus(b);
}
