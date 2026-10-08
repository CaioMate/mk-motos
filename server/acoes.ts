import type {
  Aluguel,
  CampanhaMarketing,
  Cliente,
  ConfigSistema,
  Comprovante,
  Contrato,
  FormaPagamento,
  Lead,
  LeadStage,
  ManutencaoItem,
  Moto,
  MotoStatus,
  Pagamento,
} from '../src/types/mkMotos';
import { competenciaDe, dataValidaBR, formatBR, hojeBR, parseBR } from '../src/lib/datas';
import { brl, cpfValido, formatarCpf, somenteDigitos } from '../src/lib/formato';
import { completarConfig } from '../src/lib/configPadrao';
import type { Banco } from './banco';
import {
  ErroNegocio,
  executarRotinas,
  novoId,
  oficinaDaOrdem,
  processarKm,
  registrarAtividade,
  registrarTrocaDePeca,
  textoAvisoTroca,
  verificarPlanoDePecas,
} from './automacao';
import { enfileirar } from './whatsapp';
import { limparChaves } from './seguranca';

export interface ResultadoAcao {
  mensagem?: string;
  sub?: string;
  resultado?: unknown;
}

type Acao = (b: Banco, p: any) => ResultadoAcao;

const exigir = (cond: unknown, msg: string): void => {
  if (!cond) throw new ErroNegocio(msg);
};
const texto = (v: unknown) => {
  const s = (typeof v === 'string' ? v.trim() : v == null ? '' : String(v).trim());
  exigir(s.length <= 5000, 'Texto muito longo.');
  return s;
};
const numero = (v: unknown, campo: string, min = 0, max = 1e9) => {
  const n = Number(v);
  exigir(Number.isFinite(n) && n >= min && n <= max, `${campo}: informe um número válido${min > 0 ? ` (mínimo ${min})` : ''}${n > max ? ` (máximo ${max.toLocaleString('pt-BR')})` : ''}.`);
  return n;
};

const obter = <T extends { id: string }>(b: Banco, c: Parameters<Banco['lista']>[0], id: string, nome: string) => {
  const doc = b.lista<T>(c).find((d) => d.id === id);
  exigir(doc, `${nome} não encontrado(a).`);
  return doc as T;
};

const proximoNumero = (codigos: string[]) =>
  codigos.reduce((max, c) => Math.max(max, parseInt(c.match(/(\d+)$/)?.[1] ?? '0', 10)), 0) + 1;

function validarPlaca(b: Banco, placa: string, ignorarId?: string) {
  exigir(/^[A-Z]{3}-?\d[A-Z0-9]\d{2}$/.test(placa), 'Placa inválida. Use o formato ABC-1234 ou ABC1D23.');
  const repetida = b
    .lista<Moto>('motos')
    .some((m) => m.id !== ignorarId && m.placa.replace('-', '') === placa.replace('-', ''));
  exigir(!repetida, `Já existe uma moto com a placa ${placa}.`);
}

function validarImei(b: Banco, imei: string, ignorarId?: string) {
  if (!imei) return;
  const repetido = b.lista<Moto>('motos').some((m) => m.id !== ignorarId && m.gpsImei === imei);
  exigir(!repetido, `O rastreador ${imei} já está vinculado a outra moto.`);
}

function validarCpf(b: Banco, cpf: string, ignorarId?: string) {
  exigir(cpfValido(cpf), 'CPF inválido. Confira os números.');
  const d = somenteDigitos(cpf);
  const repetido = b
    .lista<Cliente>('clientes')
    .find((c) => c.id !== ignorarId && c.cpf && somenteDigitos(c.cpf) === d);
  exigir(!repetido, `CPF já cadastrado para ${repetido?.nome}.`);
}

const CAMPOS_CLIENTE = [
  'nome', 'cpf', 'cnh', 'telefone', 'email', 'endereco', 'cidade', 'origemLead', 'campanhaOrigem', 'observacoes',
] as const;

/**
 * Aprova um comprovante: conclui a troca, zera o contador da peça e avisa o cliente pelo WhatsApp.
 * Usada pela ação do dono (`aprovarComprovante`) e pela aprovação automática (server/atendimento.ts).
 * Deve rodar dentro de `banco.transacao()`.
 */
export function aprovarComprovanteDaOrdem(
  b: Banco,
  item: ManutencaoItem,
  comp: Comprovante,
  por: 'automatico' | 'dono',
  custoInformado?: unknown
): ResultadoAcao {
  comp.status = 'aprovado';
  comp.aprovadoPor = por;
  if (por === 'automatico') comp.pendencias = [];
  b.salvar('manutencoes', item);
  const custo = custoInformado ?? comp.analise?.valorTotal ?? 0;
  const r = ACOES.concluirManutencao(b, {
    manutencaoId: item.id,
    custo,
    oficina: comp.analise?.estabelecimento || item.oficina,
    observacao: `${item.observacao} Comprovante aprovado${por === 'automatico' ? ' automaticamente' : ''} em ${hojeBR()}.`,
  });
  const moto = b.lista<Moto>('motos').find((m) => m.id === item.motoId);
  const cli = b.lista<Cliente>('clientes').find((c) => c.id === moto?.clienteAtualId);
  if (cli) {
    enfileirar(b, {
      telefone: cli.telefone,
      clienteId: cli.id,
      motivo: 'comprovante',
      texto: `Comprovante de ${item.tipo.toLowerCase()} aprovado. Obrigado por manter a moto ${moto?.placa ?? ''} em dia`,
    });
  }
  if (por === 'automatico') {
    registrarAtividade(b, {
      titulo: 'Comprovante aprovado automaticamente',
      subtitulo: `${item.tipo} • ${moto?.modelo ?? 'moto'} (${moto?.placa ?? ''})${cli ? ` • ${cli.nome}` : ''}`,
      tipo: 'manutencao',
      referenciaId: item.motoId,
    });
  }
  return { ...r, mensagem: 'Comprovante aprovado e troca concluída ✓' };
}

export const ACOES: Record<string, Acao> = {
  // ------------------------------------------------------------- FROTA
  addMoto(b, p) {
    const placa = texto(p.placa).toUpperCase();
    const modelo = texto(p.modelo);
    exigir(modelo, 'Informe o modelo da moto.');
    validarPlaca(b, placa);
    const imei = texto(p.gpsImei);
    validarImei(b, imei);
    const kmAtual = numero(p.kmAtual, 'Quilometragem');
    const valorMensal = numero(p.valorMensal, 'Valor mensal', 1);
    const motos = b.lista<Moto>('motos');
    const moto: Moto = {
      id: novoId('moto'),
      codigo: `MK-${String(proximoNumero(motos.map((m) => m.codigo))).padStart(3, '0')}`,
      modelo,
      marca: p.marca === 'Yamaha' ? 'Yamaha' : 'Honda',
      ano: numero(p.ano, 'Ano', 1990),
      placa,
      cor: texto(p.cor),
      chassi: texto(p.chassi).toUpperCase(),
      kmAtual,
      ultimaRevisaoKm: kmAtual,
      proximaRevisaoKm: kmAtual + b.config.cicloRevisaoKm,
      ultimaManutencaoData: hojeBR(),
      valorSemanal: p.valorSemanal ? numero(p.valorSemanal, 'Valor semanal') : Math.round(valorMensal / 3.5),
      valorMensal,
      status: 'DISPONÍVEL',
      foto: '',
      gpsImei: imei || undefined,
      pecasUltimaTrocaKm: Object.fromEntries(b.config.planoPecas.map((pc) => [pc.id, kmAtual])),
    };
    b.salvar('motos', moto);
    return { mensagem: 'Nova motocicleta adicionada à frota ✓', sub: `${moto.modelo} • ${moto.placa}`, resultado: { id: moto.id } };
  },

  updateMotoDetails(b, p) {
    const moto = obter<Moto>(b, 'motos', p.motoId, 'Moto');
    const u = p.updates ?? {};
    if (u.placa !== undefined) {
      const placa = texto(u.placa).toUpperCase();
      validarPlaca(b, placa, moto.id);
      moto.placa = placa;
    }
    if (u.gpsImei !== undefined) {
      const imei = texto(u.gpsImei);
      validarImei(b, imei, moto.id);
      if (imei !== (moto.gpsImei ?? '')) moto.gpsReferencia = undefined; // novo rastreador: recomeça a medição
      moto.gpsImei = imei || undefined;
    }
    if (u.modelo !== undefined) moto.modelo = texto(u.modelo) || moto.modelo;
    if (u.cor !== undefined) moto.cor = texto(u.cor);
    if (u.chassi !== undefined) moto.chassi = texto(u.chassi).toUpperCase();
    if (u.ano !== undefined) moto.ano = numero(u.ano, 'Ano', 1990);
    if (u.valorMensal !== undefined) moto.valorMensal = numero(u.valorMensal, 'Valor mensal', 1);
    if (u.valorSemanal !== undefined) moto.valorSemanal = numero(u.valorSemanal, 'Valor semanal');
    b.salvar('motos', moto);

    if (u.kmAtual !== undefined) {
      const novoKm = numero(u.kmAtual, 'Quilometragem');
      if (novoKm > moto.kmAtual) processarKm(b, moto, novoKm - moto.kmAtual, 'manual');
      else if (novoKm < moto.kmAtual) {
        moto.kmAtual = novoKm; // correção de digitação
        b.salvar('motos', moto);
      }
    }
    if (u.status !== undefined && u.status !== moto.status) ACOES.updateMotoStatus(b, { motoId: moto.id, status: u.status, silencioso: true });
    return { mensagem: 'Dados da motocicleta atualizados ✓', sub: `${moto.modelo} • ${moto.placa}` };
  },

  updateMotoStatus(b, p) {
    const moto = obter<Moto>(b, 'motos', p.motoId, 'Moto');
    const status = p.status as MotoStatus;
    exigir(['ALUGADA', 'DISPONÍVEL', 'MANUTENÇÃO', 'ATRASADA'].includes(status), 'Status inválido.');
    if (status === 'ALUGADA' || status === 'ATRASADA') {
      exigir(moto.clienteAtualId, 'Para alugar a moto, use Aluguéis > Novo aluguel (gera contrato e cobrança).');
    }
    if (status === 'DISPONÍVEL') {
      exigir(!moto.clienteAtualId, 'Esta moto está com um cliente. Finalize o aluguel em Aluguéis antes de liberar.');
    }
    moto.status = status;
    b.salvar('motos', moto);
    registrarAtividade(b, {
      titulo: `Status alterado — ${moto.modelo}`,
      subtitulo: `Placa ${moto.placa} atualizada para ${status}`,
      tipo: 'manutencao',
      referenciaId: moto.id,
    });
    const rotulo: Record<MotoStatus, string> = {
      MANUTENÇÃO: 'Moto atualizada para manutenção ✓',
      DISPONÍVEL: 'Moto liberada como disponível ✓',
      ALUGADA: 'Moto marcada como alugada ✓',
      ATRASADA: 'Moto sinalizada como atrasada ✓',
    };
    return p.silencioso ? {} : { mensagem: rotulo[status], sub: `${moto.modelo} (${moto.placa})` };
  },

  registrarLeituraKm(b, p) {
    const moto = obter<Moto>(b, 'motos', p.motoId, 'Moto');
    const novoKm = numero(p.kmAtual, 'Quilometragem');
    exigir(novoKm >= moto.kmAtual, `A leitura não pode ser menor que a atual (${moto.kmAtual.toLocaleString('pt-BR')} km).`);
    const delta = novoKm - moto.kmAtual;
    processarKm(b, moto, delta, 'manual');
    return { mensagem: 'Quilometragem registrada ✓', sub: `+${delta.toLocaleString('pt-BR')} km • ${moto.placa}` };
  },

  // ------------------------------------------------------------- CLIENTES
  addCliente(b, p) {
    const nome = texto(p.nome);
    exigir(nome.length >= 3, 'Informe o nome completo do cliente.');
    const telefone = texto(p.telefone);
    exigir(somenteDigitos(telefone).length >= 10, 'Informe um telefone com DDD.');
    const cpf = formatarCpf(texto(p.cpf));
    validarCpf(b, cpf);
    const cliente: Cliente = {
      id: novoId('cli'),
      nome,
      cpf,
      cnh: texto(p.cnh),
      telefone,
      email: texto(p.email),
      endereco: texto(p.endereco),
      cidade: texto(p.cidade),
      dataCadastro: hojeBR(),
      status: 'Inativo',
      proximoPagamentoData: '',
      proximoPagamentoValor: 0,
      origemLead: p.origemLead || 'WhatsApp',
      campanhaOrigem: texto(p.campanhaOrigem) || undefined,
      observacoes: texto(p.observacoes),
    };
    b.salvar('clientes', cliente);
    registrarAtividade(b, {
      titulo: `Novo cliente cadastrado — ${cliente.nome}`,
      subtitulo: `Origem: ${cliente.origemLead}`,
      tipo: 'cliente',
      referenciaId: cliente.id,
    });
    return { mensagem: 'Cliente cadastrado com sucesso ✓', sub: cliente.nome, resultado: cliente };
  },

  updateCliente(b, p) {
    const cli = obter<Cliente>(b, 'clientes', p.clienteId, 'Cliente');
    const u = p.updates ?? {};
    for (const campo of CAMPOS_CLIENTE) {
      if (u[campo] === undefined) continue;
      if (campo === 'cpf') {
        const cpf = formatarCpf(texto(u.cpf));
        validarCpf(b, cpf, cli.id);
        cli.cpf = cpf;
      } else {
        (cli as any)[campo] = texto(u[campo]);
      }
    }
    exigir(cli.nome.length >= 3, 'Informe o nome completo do cliente.');
    b.salvar('clientes', cli);
    return { mensagem: 'Cadastro do cliente atualizado ✓', sub: cli.nome };
  },

  // ------------------------------------------------------------- ALUGUEL
  createFullAluguel(b, p) {
    const cli = obter<Cliente>(b, 'clientes', p.clienteId, 'Cliente');
    const moto = obter<Moto>(b, 'motos', p.motoId, 'Moto');
    exigir(moto.status === 'DISPONÍVEL', `A moto ${moto.placa} não está disponível (status: ${moto.status}).`);
    exigir(!cli.contratoAtualId, `${cli.nome} já possui um aluguel em andamento. Finalize-o antes.`);
    exigir(cli.cpf && cpfValido(cli.cpf), `Complete o cadastro de ${cli.nome} (CPF válido) antes de alugar.`);
    exigir(dataValidaBR(p.dataInicio), 'Data de início inválida (use dd/mm/aaaa).');
    exigir(dataValidaBR(p.dataPrevista), 'Data de término inválida (use dd/mm/aaaa).');
    exigir(parseBR(p.dataPrevista)! > parseBR(p.dataInicio)!, 'A data de término deve ser depois do início.');
    const valor = numero(p.valorMensal, 'Valor da locação', 1);
    const caucao = numero(p.caucao ?? 0, 'Caução');
    const plano = (['Semanal', 'Mensal', 'Anual'].includes(p.plano) ? p.plano : 'Mensal') as Aluguel['plano'];
    const forma = (p.formaPagamento || 'PIX') as FormaPagamento;

    const ano = parseBR(p.dataInicio)!.getFullYear();
    const contratos = b.lista<Contrato>('contratos');
    const alugueis = b.lista<Aluguel>('alugueis');
    const numeroCtr = `CTR-${ano}-${String(proximoNumero(contratos.map((c) => c.numero))).padStart(3, '0')}`;
    const codigoLoc = `LOC-${ano}-${String(proximoNumero(alugueis.map((a) => a.codigo))).padStart(3, '0')}`;
    const aluguelId = novoId('alu');
    const contratoId = novoId('ctr');

    b.salvar<Aluguel>('alugueis', {
      id: aluguelId,
      codigo: codigoLoc,
      clienteId: cli.id,
      motoId: moto.id,
      contratoId,
      dataInicio: p.dataInicio,
      dataPrevista: p.dataPrevista,
      plano,
      valorMensal: valor,
      caucao,
      status: 'Ativo',
    });
    const contrato = b.salvar<Contrato>('contratos', {
      id: contratoId,
      numero: numeroCtr,
      clienteId: cli.id,
      motoId: moto.id,
      aluguelId,
      dataEmissao: p.dataInicio,
      dataVencimento: p.dataPrevista,
      valorMensal: valor,
      caucao,
      franquiaKmMensal: Number(p.franquiaKmMensal) || 4500,
      status: 'Ativo',
      plano,
      kmInicial: moto.kmAtual,
      kmRodados: 0,
      kmCiclosCobrados: 0,
    });

    const pago = !!p.pagamentoConfirmado;
    const base = {
      clienteId: cli.id,
      contratoId,
      motoId: moto.id,
      formaPagamento: forma,
      status: (pago ? 'Pago' : 'Pendente') as Pagamento['status'],
      dataPagamento: pago ? hojeBR() : undefined,
    };
    const inicio = parseBR(p.dataInicio)!;
    b.salvar<Pagamento>('pagamentos', {
      ...base,
      id: novoId('pag'),
      tipo: 'Mensalidade',
      descricao: plano === 'Semanal' ? 'Locação semanal (1º período)' : 'Mensalidade da locação (1º mês)',
      competencia: plano === 'Semanal' ? `Semana de ${p.dataInicio}` : competenciaDe(inicio),
      valor,
      vencimento: p.dataInicio,
    });
    if (caucao > 0) {
      b.salvar<Pagamento>('pagamentos', {
        ...base,
        id: novoId('pag'),
        tipo: 'Avulso',
        descricao: 'Caução de garantia',
        competencia: competenciaDe(inicio),
        valor: caucao,
        vencimento: p.dataInicio,
      });
    }

    moto.status = 'ALUGADA';
    moto.clienteAtualId = cli.id;
    moto.contratoAtualId = contratoId;
    b.salvar('motos', moto);
    cli.motoAtualId = moto.id;
    cli.contratoAtualId = contratoId;
    b.salvar('clientes', cli);

    registrarAtividade(b, {
      titulo: `Novo aluguel criado — ${moto.modelo}`,
      subtitulo: `Contrato ${numeroCtr} vinculado a ${cli.nome} (placa ${moto.placa})`,
      tipo: 'aluguel',
      referenciaId: moto.id,
    });
    return { mensagem: 'Aluguel e contrato gerados com sucesso ✓', sub: `${contrato.numero} • ${cli.nome}` };
  },

  finalizarAluguel(b, p) {
    const alu = obter<Aluguel>(b, 'alugueis', p.aluguelId, 'Aluguel');
    exigir(alu.status !== 'Finalizado', 'Este aluguel já foi finalizado.');
    const moto = b.lista<Moto>('motos').find((m) => m.id === alu.motoId);
    if (moto && p.kmFinal !== undefined && p.kmFinal !== '') {
      const kmFinal = numero(p.kmFinal, 'Km na devolução');
      if (kmFinal > moto.kmAtual) processarKm(b, moto, kmFinal - moto.kmAtual, 'manual');
    }
    alu.status = 'Finalizado';
    b.salvar('alugueis', alu);
    const ctr = b.lista<Contrato>('contratos').find((c) => c.id === alu.contratoId);
    if (ctr) {
      ctr.status = 'Finalizado';
      b.salvar('contratos', ctr);
    }
    if (moto && moto.contratoAtualId === alu.contratoId) {
      moto.status = moto.status === 'MANUTENÇÃO' ? 'MANUTENÇÃO' : 'DISPONÍVEL';
      delete moto.clienteAtualId;
      delete moto.contratoAtualId;
      b.salvar('motos', moto);
    }
    const cli = b.lista<Cliente>('clientes').find((c) => c.id === alu.clienteId);
    if (cli && cli.contratoAtualId === alu.contratoId) {
      delete cli.motoAtualId;
      delete cli.contratoAtualId;
      b.salvar('clientes', cli);
    }
    const emAberto = b
      .lista<Pagamento>('pagamentos')
      .filter((pg) => pg.contratoId === alu.contratoId && pg.status !== 'Pago')
      .reduce((s, pg) => s + pg.valor, 0);
    registrarAtividade(b, {
      titulo: `Aluguel finalizado — ${alu.codigo}`,
      subtitulo: `${cli?.nome ?? 'Cliente'} devolveu ${moto?.modelo ?? 'a moto'} (${ctr?.kmRodados?.toLocaleString('pt-BR') ?? 0} km rodados)`,
      tipo: 'aluguel',
      referenciaId: alu.motoId,
    });
    return {
      mensagem: 'Aluguel finalizado e moto liberada na frota ✓',
      sub: emAberto > 0 ? `Atenção: ${brl(emAberto)} ainda em aberto deste contrato` : alu.codigo,
    };
  },

  assinarContrato(b, p) {
    const ctr = obter<Contrato>(b, 'contratos', p.contratoId, 'Contrato');
    ctr.status = 'Ativo';
    b.salvar('contratos', ctr);
    return { mensagem: 'Assinatura registrada com sucesso ✓', sub: ctr.numero };
  },

  // ------------------------------------------------------------- FINANCEIRO
  registrarPagamento(b, p) {
    const forma = (p.formaPagamento || 'PIX') as FormaPagamento;
    if (p.pagamentoId) {
      const pag = obter<Pagamento>(b, 'pagamentos', p.pagamentoId, 'Cobrança');
      exigir(pag.status !== 'Pago', 'Esta cobrança já está paga.');
      pag.status = 'Pago';
      pag.dataPagamento = hojeBR();
      pag.formaPagamento = forma;
      if (p.valor !== undefined) pag.valor = numero(p.valor, 'Valor', 0.01);
      b.salvar('pagamentos', pag);
      const cli = b.lista<Cliente>('clientes').find((c) => c.id === pag.clienteId);
      registrarAtividade(b, {
        titulo: `Pagamento recebido — ${cli?.nome ?? 'Cliente'}`,
        subtitulo: `${brl(pag.valor)} (${pag.tipo ?? 'Mensalidade'}) confirmado via ${forma}`,
        tipo: 'pagamento',
        referenciaId: pag.clienteId,
      });
      return { mensagem: 'Pagamento registrado com sucesso ✓', sub: `${brl(pag.valor)} • ${cli?.nome ?? ''}` };
    }

    const cli = obter<Cliente>(b, 'clientes', p.clienteId, 'Cliente');
    const valor = numero(p.valor, 'Valor', 0.01);
    const venc = texto(p.vencimento) || hojeBR();
    exigir(dataValidaBR(venc), 'Vencimento inválido (use dd/mm/aaaa).');
    const ctr = b.lista<Contrato>('contratos').find((c) => c.id === (p.contratoId || cli.contratoAtualId));
    b.salvar<Pagamento>('pagamentos', {
      id: novoId('pag'),
      clienteId: cli.id,
      contratoId: ctr?.id ?? '',
      motoId: ctr?.motoId ?? '',
      competencia: competenciaDe(parseBR(venc)!),
      valor,
      vencimento: venc,
      dataPagamento: hojeBR(),
      formaPagamento: forma,
      status: 'Pago',
      tipo: 'Avulso',
      descricao: texto(p.descricao) || 'Recebimento avulso',
    });
    registrarAtividade(b, {
      titulo: `Pagamento recebido — ${cli.nome}`,
      subtitulo: `${brl(valor)} confirmado via ${forma}`,
      tipo: 'pagamento',
      referenciaId: cli.id,
    });
    return { mensagem: 'Pagamento registrado com sucesso ✓', sub: `${brl(valor)} • ${cli.nome}` };
  },

  criarCobranca(b, p) {
    const cli = obter<Cliente>(b, 'clientes', p.clienteId, 'Cliente');
    const valor = numero(p.valor, 'Valor', 0.01);
    const venc = texto(p.vencimento);
    exigir(dataValidaBR(venc), 'Vencimento inválido (use dd/mm/aaaa).');
    const ctr = b.lista<Contrato>('contratos').find((c) => c.id === (p.contratoId || cli.contratoAtualId));
    b.salvar<Pagamento>('pagamentos', {
      id: novoId('pag'),
      clienteId: cli.id,
      contratoId: ctr?.id ?? '',
      motoId: ctr?.motoId ?? '',
      competencia: competenciaDe(parseBR(venc)!),
      valor,
      vencimento: venc,
      formaPagamento: (p.formaPagamento || 'PIX') as FormaPagamento,
      status: 'Pendente',
      tipo: 'Avulso',
      descricao: texto(p.descricao) || 'Cobrança avulsa',
    });
    return { mensagem: 'Cobrança lançada ✓', sub: `${brl(valor)} • ${cli.nome} • vence ${venc}` };
  },

  cancelarCobranca(b, p) {
    const pag = obter<Pagamento>(b, 'pagamentos', p.pagamentoId, 'Cobrança');
    exigir(pag.status !== 'Pago', 'Cobranças pagas não podem ser canceladas.');
    b.remover('pagamentos', pag.id);
    return { mensagem: 'Cobrança cancelada ✓', sub: `${pag.descricao ?? pag.tipo ?? ''} • ${brl(pag.valor)}` };
  },

  // ------------------------------------------------------------- MANUTENÇÃO
  registrarManutencao(b, p) {
    const moto = obter<Moto>(b, 'motos', p.motoId, 'Moto');
    const kmServico = numero(p.kmNaManutencao, 'Quilometragem');
    const emOficina = !!p.colocarEmManutencao;
    const item: ManutencaoItem = {
      id: novoId('man'),
      motoId: moto.id,
      tipo: p.tipo,
      data: hojeBR(),
      kmNaManutencao: kmServico,
      custo: numero(p.custo ?? 0, 'Custo'),
      oficina: texto(p.oficina),
      observacao: texto(p.observacao),
      concluida: !emOficina,
      pecaId: texto(p.pecaId) || undefined,
      origem: 'manual',
    };
    b.salvar('manutencoes', item);
    if (kmServico > moto.kmAtual) processarKm(b, moto, kmServico - moto.kmAtual, 'manual');
    if (!emOficina) aplicarConclusao(b, moto, item);
    if (emOficina) {
      moto.status = 'MANUTENÇÃO';
      b.salvar('motos', moto);
    }
    registrarAtividade(b, {
      titulo: `${emOficina ? 'Moto enviada para manutenção' : 'Manutenção registrada'} — ${moto.modelo}`,
      subtitulo: `${item.tipo} • placa ${moto.placa}${item.custo ? ` • ${brl(item.custo)}` : ''}`,
      tipo: 'manutencao',
      referenciaId: moto.id,
    });
    return {
      mensagem: emOficina ? 'Moto atualizada para manutenção ✓' : 'Manutenção registrada com sucesso ✓',
      sub: `${item.tipo} • ${moto.modelo}`,
    };
  },

  concluirManutencao(b, p) {
    const item = obter<ManutencaoItem>(b, 'manutencoes', p.manutencaoId, 'Manutenção');
    exigir(!item.concluida, 'Esta manutenção já foi concluída.');
    const moto = obter<Moto>(b, 'motos', item.motoId, 'Moto');
    item.concluida = true;
    if (item.origem === 'automatica') item.situacao = 'concluida';
    item.data = hojeBR();
    if (p.custo !== undefined && p.custo !== '') item.custo = numero(p.custo, 'Custo');
    if (texto(p.oficina)) item.oficina = texto(p.oficina);
    if (texto(p.observacao)) item.observacao = texto(p.observacao);
    item.kmNaManutencao = Math.max(moto.kmAtual, item.kmNaManutencao);
    b.salvar('manutencoes', item);
    aplicarConclusao(b, moto, item);
    if (moto.status === 'MANUTENÇÃO') {
      const aindaAberta = b
        .lista<ManutencaoItem>('manutencoes')
        .some((m) => m.motoId === moto.id && !m.concluida && m.origem !== 'automatica');
      if (!aindaAberta) {
        moto.status = moto.clienteAtualId ? 'ALUGADA' : 'DISPONÍVEL';
        b.salvar('motos', moto);
      }
    }
    registrarAtividade(b, {
      titulo: `Manutenção concluída — ${moto.modelo}`,
      subtitulo: `${item.tipo} • placa ${moto.placa}${item.custo ? ` • ${brl(item.custo)}` : ''}`,
      tipo: 'manutencao',
      referenciaId: moto.id,
    });
    return { mensagem: 'Manutenção concluída ✓', sub: `${item.tipo} • ${moto.modelo} (${moto.status})` };
  },

  /** Comprovante conferido: conclui a troca, zera o contador da peça e avisa o cliente. */
  aprovarComprovante(b, p) {
    const item = obter<ManutencaoItem>(b, 'manutencoes', p.manutencaoId, 'Manutenção');
    const comp = (item.comprovantes ?? []).find((c) => c.id === p.comprovanteId);
    exigir(comp, 'Comprovante não encontrado.');
    return aprovarComprovanteDaOrdem(b, item, comp!, 'dono', p.custo);
  },

  recusarComprovante(b, p) {
    const item = obter<ManutencaoItem>(b, 'manutencoes', p.manutencaoId, 'Manutenção');
    const comp = (item.comprovantes ?? []).find((c) => c.id === p.comprovanteId);
    exigir(comp, 'Comprovante não encontrado.');
    const motivo = texto(p.motivo) || 'o comprovante não confere com o serviço/oficina indicados';
    comp!.status = 'recusado';
    comp!.motivoRecusa = motivo;
    if (!(item.comprovantes ?? []).some((c) => c.status === 'pendente')) item.situacao = 'aguardando_comprovante';
    b.salvar('manutencoes', item);
    const moto = b.lista<Moto>('motos').find((m) => m.id === item.motoId);
    const cli = b.lista<Cliente>('clientes').find((c) => c.id === moto?.clienteAtualId);
    if (cli) {
      enfileirar(b, {
        telefone: cli.telefone,
        clienteId: cli.id,
        motivo: 'comprovante',
        texto: `Não conseguimos aprovar o comprovante de ${item.tipo.toLowerCase()}: ${motivo}. Por favor, envie um comprovante válido da ${oficinaDaOrdem(b, item).nome}`,
      });
    }
    return { mensagem: 'Comprovante recusado', sub: cli ? `${cli.nome} foi avisado pelo WhatsApp` : undefined };
  },

  reenviarAvisoTroca(b, p) {
    const item = obter<ManutencaoItem>(b, 'manutencoes', p.manutencaoId, 'Manutenção');
    const moto = obter<Moto>(b, 'motos', item.motoId, 'Moto');
    const cli = b.lista<Cliente>('clientes').find((c) => c.id === moto.clienteAtualId);
    exigir(cli, 'Esta moto não está com nenhum cliente.');
    enfileirar(b, { telefone: cli!.telefone, clienteId: cli!.id, texto: textoAvisoTroca(b, item, moto, true), motivo: 'lembrete_troca' });
    item.avisosEnviados = (item.avisosEnviados ?? 0) + 1;
    item.ultimoAvisoKm = moto.kmAtual;
    b.salvar('manutencoes', item);
    return { mensagem: 'Aviso enviado para a fila do WhatsApp ✓', sub: cli!.nome };
  },

  enviarMensagemWhatsApp(b, p) {
    const msg = texto(p.texto);
    exigir(msg, 'Digite a mensagem.');
    const cli = p.clienteId ? obter<Cliente>(b, 'clientes', p.clienteId, 'Cliente') : undefined;
    const telefone = cli?.telefone ?? texto(p.telefone);
    exigir(somenteDigitos(telefone).length >= 10, 'Telefone inválido.');
    enfileirar(b, { telefone, clienteId: cli?.id, texto: msg, motivo: 'manual' });
    return { mensagem: 'Mensagem na fila de envio ✓' };
  },

  // ------------------------------------------------------------- COMERCIAL
  addLead(b, p) {
    const nome = texto(p.nome);
    exigir(nome, 'Informe o nome do lead.');
    const lead: Lead = {
      id: novoId('lead'),
      nome,
      telefone: texto(p.telefone),
      motoInteresse: texto(p.motoInteresse),
      origem: p.origem || 'Instagram',
      campanha: texto(p.campanha),
      stage: 'NOVOS LEADS',
      dataEntrada: hojeBR(),
      finalidade: p.finalidade || 'App de Entrega / Mobilidade',
      notas: texto(p.notas),
    };
    b.salvar('leads', lead);
    const camp = b.lista<CampanhaMarketing>('campanhas').find((c) => c.nome === lead.campanha);
    if (camp) {
      camp.leadsGerados += 1;
      camp.custoPorLead = camp.leadsGerados ? Math.round((camp.investimentoMensal / camp.leadsGerados) * 10) / 10 : 0;
      b.salvar('campanhas', camp);
    }
    return { mensagem: 'Novo lead adicionado ao pipeline ✓', sub: `${lead.nome} (${lead.origem})` };
  },

  moveLeadStage(b, p) {
    const lead = obter<Lead>(b, 'leads', p.leadId, 'Lead');
    lead.stage = p.stage as LeadStage;
    b.salvar('leads', lead);
    return { mensagem: 'Etapa do lead atualizada ✓', sub: lead.stage };
  },

  converterLeadEmCliente(b, p) {
    const lead = obter<Lead>(b, 'leads', p.leadId, 'Lead');
    const tel = somenteDigitos(lead.telefone);
    const existente = b
      .lista<Cliente>('clientes')
      .find((c) => (tel.length >= 10 && somenteDigitos(c.telefone) === tel) || c.nome.toLowerCase() === lead.nome.toLowerCase());
    let clienteId = existente?.id;
    if (!existente) {
      const novo: Cliente = {
        id: novoId('cli'),
        nome: lead.nome,
        cpf: '',
        cnh: '',
        telefone: lead.telefone,
        email: '',
        endereco: '',
        cidade: '',
        dataCadastro: hojeBR(),
        status: 'Inativo',
        proximoPagamentoData: '',
        proximoPagamentoValor: 0,
        origemLead: lead.origem,
        campanhaOrigem: lead.campanha,
        observacoes: `Convertido da Central Comercial. Interesse: ${lead.motoInteresse}. CADASTRO INCOMPLETO — preencher CPF, CNH e endereço.`,
      };
      b.salvar('clientes', novo);
      clienteId = novo.id;
    }
    lead.stage = 'ALUGUEL REALIZADO';
    lead.convertidoClienteId = clienteId;
    b.salvar('leads', lead);
    const camp = b.lista<CampanhaMarketing>('campanhas').find((c) => c.nome === lead.campanha);
    if (camp) {
      camp.conversoes += 1;
      b.salvar('campanhas', camp);
    }
    registrarAtividade(b, {
      titulo: `Lead convertido em cliente — ${lead.nome}`,
      subtitulo: `Origem: ${lead.origem} • Interesse: ${lead.motoInteresse}`,
      tipo: 'comercial',
      referenciaId: clienteId,
    });
    return {
      mensagem: 'Lead convertido em cliente ✓',
      sub: existente ? `${lead.nome} já existia na base` : `Complete o cadastro de ${lead.nome} (CPF, CNH, endereço)`,
      resultado: clienteId,
    };
  },

  // ------------------------------------------------------------- CONFIGURAÇÕES
  salvarConfig(b, p) {
    const nova = completarConfig({ ...b.config, ...(p.config ?? {}) } as ConfigSistema);
    exigir(nova.cobrancaKm.kmPorCiclo >= 100, 'O ciclo de cobrança deve ser de pelo menos 100 km.');
    exigir(nova.retencaoMeses >= 1 && nova.retencaoMeses <= 120, 'O prazo para guardar dados antigos deve ficar entre 1 e 120 meses.');
    exigir(nova.gps.velocidadeMovimentoKmh >= 1 && nova.gps.minutosParadaFimViagem >= 1, 'Velocidade de movimento e minutos parada devem ser pelo menos 1.');
    exigir(nova.planoPecas.every((pc) => pc.nome && pc.intervaloKm > 0), 'Cada peça do plano precisa de nome e intervalo de km.');
    exigir(nova.oficinas.every((o) => o.nome.trim()), 'Cada oficina precisa de um nome.');
    exigir(
      nova.cercaVirtual.cidades.every((c) => Number.isFinite(c.lat) && Number.isFinite(c.lon) && c.raioKm > 0),
      'Cada cidade da área permitida precisa de localização e raio (km).'
    );
    exigir(!nova.cercaVirtual.ativo || nova.cercaVirtual.cidades.length > 0, 'Adicione pelo menos uma cidade para ligar a cerca virtual.');
    const novasPecas = nova.planoPecas.filter((pc) => !b.config.planoPecas.some((x) => x.id === pc.id));
    b.salvarConfig(nova);
    // Peças novas no plano começam a contar a partir da km atual de cada moto
    if (novasPecas.length) {
      for (const m of b.lista<Moto>('motos')) {
        m.pecasUltimaTrocaKm = { ...(m.pecasUltimaTrocaKm ?? {}) };
        for (const pc of novasPecas) m.pecasUltimaTrocaKm[pc.id] = m.kmAtual;
        b.salvar('motos', m);
      }
    }
    for (const m of b.lista<Moto>('motos')) verificarPlanoDePecas(b, m);
    return { mensagem: 'Configurações salvas ✓' };
  },

  apagarTudo(b, p) {
    exigir(p.confirmacao === 'APAGAR', 'Confirmação ausente. Nada foi apagado.');
    b.apagarTudo();
    return { mensagem: 'Todos os dados foram apagados ✓', sub: 'O sistema está vazio, pronto para recomeçar.' };
  },
};

/** Quando um serviço é concluído, zera o contador da peça e atualiza a revisão. */
function aplicarConclusao(b: Banco, moto: Moto, item: ManutencaoItem) {
  const km = Math.max(moto.kmAtual, item.kmNaManutencao);
  const pecas = item.pecaId ? [item.pecaId] : b.config.planoPecas.filter((pc) => pc.tipo === item.tipo).map((pc) => pc.id);
  // Peça específica informada, ou única peça do plano com esse tipo
  if (item.pecaId || pecas.length === 1) for (const id of pecas) registrarTrocaDePeca(b, moto, id, km);
  // Fecha a ordem automática da mesma peça, se existir
  for (const m of b.lista<ManutencaoItem>('manutencoes')) {
    if (m.id !== item.id && m.motoId === moto.id && !m.concluida && m.origem === 'automatica' && pecas.includes(m.pecaId ?? '')) {
      m.concluida = true;
      m.data = hojeBR();
      m.observacao += ` Atendida em ${hojeBR()} (${item.oficina || 'oficina'}).`;
      b.salvar('manutencoes', m);
    }
  }
  if (item.tipo === 'Revisão' || item.tipo === 'Manutenção preventiva') {
    moto.ultimaRevisaoKm = km;
    moto.proximaRevisaoKm = km + b.config.cicloRevisaoKm;
  }
  moto.ultimaManutencaoData = item.data || formatBR(new Date());
  b.salvar('motos', moto);
}

export const existeAcao = (nome: string) => Object.prototype.hasOwnProperty.call(ACOES, nome);

/** Executa uma ação dentro de uma transação e roda as automações em seguida. */
export function executarAcao(b: Banco, nome: string, payload: unknown): ResultadoAcao {
  if (!existeAcao(nome)) throw new ErroNegocio(`Ação desconhecida: ${nome}`);
  const acao = ACOES[nome];
  return b.transacao(() => {
    const r = acao(b, limparChaves(payload ?? {}));
    executarRotinas(b);
    return r;
  });
}
