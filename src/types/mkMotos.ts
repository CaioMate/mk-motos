export type NavTab =
  | 'dashboard'
  | 'frota'
  | 'clientes'
  | 'alugueis'
  | 'contratos'
  | 'financeiro'
  | 'manutencao'
  | 'comercial'
  | 'relatorios'
  | 'configuracoes';

export type MotoStatus = 'ALUGADA' | 'DISPONÍVEL' | 'MANUTENÇÃO' | 'ATRASADA';

export type ClienteStatus = 'Ativo' | 'Inativo' | 'Pagamento Pendente' | 'Em Atraso';

export type AluguelStatus = 'Ativo' | 'Próximo' | 'Finalizado' | 'Atrasado';

export type ContratoStatus = 'Ativo' | 'Aguardando assinatura' | 'Finalizado' | 'Vencido';

export type PagamentoStatus = 'Pago' | 'Pendente' | 'Atrasado';

export type LeadStage =
  | 'NOVOS LEADS'
  | 'EM ATENDIMENTO'
  | 'NEGOCIAÇÃO'
  | 'ALUGUEL REALIZADO'
  | 'PERDIDOS';

export type LeadOrigin = 'Instagram' | 'WhatsApp' | 'Google' | 'Indicação' | 'Anúncios';

export interface ManutencaoItem {
  id: string;
  motoId: string;
  tipo: 'Troca de óleo' | 'Pneu' | 'Freio' | 'Revisão' | 'Manutenção preventiva';
  data: string;
  kmNaManutencao: number;
  custo: number;
  oficina: string;
  observacao: string;
  concluida: boolean;
}

export interface Moto {
  id: string;
  codigo: string;
  modelo: string;
  marca: 'Honda' | 'Yamaha';
  ano: number;
  placa: string;
  cor: string;
  chassi: string;
  kmAtual: number;
  ultimaRevisaoKm: number;
  proximaRevisaoKm: number;
  ultimaManutencaoData: string;
  valorSemanal: number;
  valorMensal: number;
  status: MotoStatus;
  foto: string;
  clienteAtualId?: string;
  contratoAtualId?: string;
}

export interface Cliente {
  id: string;
  nome: string;
  cpf: string;
  cnh: string;
  telefone: string;
  email: string;
  endereco: string;
  cidade: string;
  dataCadastro: string;
  status: ClienteStatus;
  motoAtualId?: string;
  contratoAtualId?: string;
  proximoPagamentoData: string;
  proximoPagamentoValor: number;
  origemLead: LeadOrigin;
  campanhaOrigem?: string;
  observacoes: string;
}

export interface Aluguel {
  id: string;
  codigo: string;
  clienteId: string;
  motoId: string;
  contratoId: string;
  dataInicio: string;
  dataPrevista: string;
  plano: 'Semanal' | 'Mensal' | 'Anual';
  valorMensal: number;
  caucao: number;
  status: AluguelStatus;
}

export interface Contrato {
  id: string;
  numero: string;
  clienteId: string;
  motoId: string;
  aluguelId: string;
  dataEmissao: string;
  dataVencimento: string;
  valorMensal: number;
  caucao: number;
  franquiaKmMensal: number;
  status: ContratoStatus;
}

export interface Pagamento {
  id: string;
  clienteId: string;
  contratoId: string;
  motoId: string;
  competencia: string;
  valor: number;
  vencimento: string;
  dataPagamento?: string;
  formaPagamento: 'PIX' | 'Boleto' | 'Cartão' | 'Transferência';
  status: PagamentoStatus;
}

export interface Lead {
  id: string;
  nome: string;
  telefone: string;
  motoInteresse: string;
  origem: LeadOrigin;
  campanha: string;
  stage: LeadStage;
  dataEntrada: string;
  finalidade: 'App de Entrega / Mobilidade' | 'Uso Diário' | 'Trabalho Corporativo';
  convertidoClienteId?: string;
  notas: string;
}

export interface CampanhaMarketing {
  id: string;
  nome: string;
  canal: LeadOrigin;
  status: 'Ativa' | 'Pausada';
  investimentoMensal: number;
  leadsGerados: number;
  conversoes: number;
  custoPorLead: number;
}

export interface AtividadeRecente {
  id: string;
  titulo: string;
  subtitulo: string;
  horario: string;
  tipo: 'aluguel' | 'pagamento' | 'manutencao' | 'cliente' | 'comercial';
  referenciaId?: string;
}

export interface AlertaSistema {
  id: string;
  titulo: string;
  detalhe: string;
  severidade: 'alta' | 'media' | 'info';
  destinoTab: NavTab;
}
