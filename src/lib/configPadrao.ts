import { ConfigSistema, PecaPlano } from '../types/mkMotos';

// Valores iniciais — todos podem ser alterados em Configurações.
export const CONFIG_PADRAO: ConfigSistema = {
  empresa: {
    nome: 'Minha Locadora',
    cnpj: '',
    telefone: '',
    pix: '',
  },
  cicloRevisaoKm: 5000,
  caucaoPadrao: 500,
  diasAvisoVencimento: 3,
  cobrancaKm: {
    ativo: true,
    kmPorCiclo: 1000,
    valorPorCiclo: 100,
    diasParaVencimento: 3,
  },
  // O cliente NÃO é cobrado pelas peças: ele troca na oficina indicada e manda o comprovante.
  planoPecas: [
    { id: 'oleo', nome: 'Troca de óleo + filtro', tipo: 'Troca de óleo', intervaloKm: 1000, exigirComprovante: true },
    { id: 'pastilha', nome: 'Pastilha / lona de freio', tipo: 'Freio', intervaloKm: 8000, exigirComprovante: true },
    { id: 'pneu-tras', nome: 'Pneu traseiro', tipo: 'Pneu', intervaloKm: 12000, exigirComprovante: true },
    { id: 'pneu-diant', nome: 'Pneu dianteiro', tipo: 'Pneu', intervaloKm: 20000, exigirComprovante: true },
    { id: 'relacao', nome: 'Kit relação (coroa, pinhão e corrente)', tipo: 'Relação', intervaloKm: 15000, exigirComprovante: true },
    { id: 'revisao', nome: 'Revisão geral', tipo: 'Revisão', intervaloKm: 5000, exigirComprovante: true },
  ],
  oficinas: [
    { id: 'oficina-1', nome: 'Oficina credenciada (preencher)', endereco: 'Endereço da oficina', telefone: '' },
  ],
  oficinaPadraoId: 'oficina-1',
  trocas: {
    lembreteACadaKm: 150,
    toleranciaKm: 300,
  },
  cercaVirtual: {
    ativo: false,
    cidades: [],
  },
  manutencao: {
    aprovacaoAutomatica: true,
  },
  whatsapp: {
    numeroDono: '',
    agenteResponde: true,
    avisarTrocas: true,
    avisarCerca: true,
  },
  gps: {
    velocidadeMaxKmh: 160,
    distanciaMinimaM: 25,
  },
};

/** Garante que configs antigas salvas no banco recebam campos novos. */
export function completarConfig(parcial: Partial<ConfigSistema> | undefined): ConfigSistema {
  const p = parcial || {};
  const planoPecas: PecaPlano[] = (p.planoPecas && p.planoPecas.length ? p.planoPecas : CONFIG_PADRAO.planoPecas).map(
    (pc) => ({
      id: pc.id,
      nome: pc.nome,
      tipo: pc.tipo,
      intervaloKm: pc.intervaloKm,
      exigirComprovante: pc.exigirComprovante ?? true,
    })
  );
  const oficinas = p.oficinas && p.oficinas.length ? p.oficinas : CONFIG_PADRAO.oficinas;
  return {
    ...CONFIG_PADRAO,
    ...p,
    empresa: { ...CONFIG_PADRAO.empresa, ...(p.empresa || {}) },
    cobrancaKm: { ...CONFIG_PADRAO.cobrancaKm, ...(p.cobrancaKm || {}) },
    trocas: { ...CONFIG_PADRAO.trocas, ...(p.trocas || {}) },
    cercaVirtual: { ...CONFIG_PADRAO.cercaVirtual, ...(p.cercaVirtual || {}) },
    manutencao: { ...CONFIG_PADRAO.manutencao, ...(p.manutencao || {}) },
    whatsapp: { ...CONFIG_PADRAO.whatsapp, ...(p.whatsapp || {}) },
    gps: { ...CONFIG_PADRAO.gps, ...(p.gps || {}) },
    planoPecas,
    oficinas,
    oficinaPadraoId: oficinas.some((o) => o.id === p.oficinaPadraoId) ? p.oficinaPadraoId! : oficinas[0].id,
  };
}
