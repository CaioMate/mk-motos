import { ConfigSistema } from '../types/mkMotos';

// Valores iniciais — todos podem ser alterados em Configurações.
export const CONFIG_PADRAO: ConfigSistema = {
  empresa: {
    nome: 'MK MOTOS — Locação de Motocicletas',
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
  planoPecas: [
    { id: 'oleo', nome: 'Troca de óleo + filtro', tipo: 'Troca de óleo', intervaloKm: 1000, valorCobrado: 60, cobrarCliente: true },
    { id: 'pastilha', nome: 'Pastilha / lona de freio', tipo: 'Freio', intervaloKm: 8000, valorCobrado: 70, cobrarCliente: true },
    { id: 'pneu-tras', nome: 'Pneu traseiro', tipo: 'Pneu', intervaloKm: 12000, valorCobrado: 220, cobrarCliente: true },
    { id: 'pneu-diant', nome: 'Pneu dianteiro', tipo: 'Pneu', intervaloKm: 20000, valorCobrado: 180, cobrarCliente: true },
    { id: 'relacao', nome: 'Kit relação (coroa, pinhão e corrente)', tipo: 'Relação', intervaloKm: 15000, valorCobrado: 180, cobrarCliente: true },
    { id: 'revisao', nome: 'Revisão geral', tipo: 'Revisão', intervaloKm: 5000, valorCobrado: 0, cobrarCliente: false },
  ],
  gps: {
    velocidadeMaxKmh: 160,
    distanciaMinimaM: 25,
  },
  modoDemonstracao: true,
};

/** Garante que configs antigas salvas no banco recebam campos novos. */
export function completarConfig(parcial: Partial<ConfigSistema> | undefined): ConfigSistema {
  const p = parcial || {};
  return {
    ...CONFIG_PADRAO,
    ...p,
    empresa: { ...CONFIG_PADRAO.empresa, ...(p.empresa || {}) },
    cobrancaKm: { ...CONFIG_PADRAO.cobrancaKm, ...(p.cobrancaKm || {}) },
    gps: { ...CONFIG_PADRAO.gps, ...(p.gps || {}) },
    planoPecas: p.planoPecas && p.planoPecas.length ? p.planoPecas : CONFIG_PADRAO.planoPecas,
  };
}
