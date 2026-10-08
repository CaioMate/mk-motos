export type NavTab =
  | 'dashboard'
  | 'frota'
  | 'clientes'
  | 'alugueis'
  | 'financeiro'
  | 'manutencao'
  | 'comercial'
  | 'relatorios'
  | 'whatsapp'
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

export type TipoManutencao =
  | 'Troca de óleo'
  | 'Pneu'
  | 'Freio'
  | 'Relação'
  | 'Revisão'
  | 'Manutenção preventiva';

export interface ManutencaoItem {
  id: string;
  motoId: string;
  tipo: TipoManutencao;
  data: string;
  kmNaManutencao: number;
  custo: number;
  oficina: string;
  observacao: string;
  concluida: boolean;
  /** Item do plano de peças que esta manutenção atende (zera o contador daquela peça) */
  pecaId?: string;
  /** 'automatica' quando gerada pelo sistema ao atingir a km do plano */
  origem?: 'manual' | 'automatica';
  /** Trocas automáticas: o cliente faz na oficina credenciada e manda o comprovante */
  situacao?: 'aguardando_comprovante' | 'em_analise' | 'concluida';
  oficinaId?: string;
  comprovantes?: Comprovante[];
  avisosEnviados?: number;
  /** Km da moto no último aviso enviado ao cliente */
  ultimoAvisoKm?: number;
  /** Dono já foi avisado que passou da tolerância */
  atrasoAvisado?: boolean;
}

export interface AnaliseComprovante {
  ehComprovante: boolean;
  estabelecimento: string;
  data: string;
  servicos: string[];
  valorTotal: number | null;
  km: number | null;
  /** O estabelecimento parece ser a oficina credenciada indicada */
  confereComOficina: boolean;
  observacao: string;
}

export interface Comprovante {
  id: string;
  /** Nome do arquivo em data/comprovantes */
  arquivo: string;
  mime: string;
  recebidoEm: string; // ISO
  origem: 'whatsapp' | 'sistema';
  status: 'pendente' | 'aprovado' | 'recusado';
  motivoRecusa?: string;
  analise?: AnaliseComprovante;
}

export interface Oficina {
  id: string;
  nome: string;
  endereco: string;
  telefone: string;
}

export interface CidadePermitida {
  id: string;
  nome: string;
  lat: number;
  lon: number;
  raioKm: number;
}

export interface MensagemWhatsApp {
  id: string;
  telefone: string;
  clienteId?: string;
  direcao: 'entrada' | 'saida';
  tipo: 'texto' | 'imagem' | 'documento' | 'audio' | 'outro';
  texto: string;
  arquivo?: string;
  /** recebida (entrada) · pendente/enviada/erro (saída) */
  status: 'recebida' | 'pendente' | 'enviada' | 'erro';
  erro?: string;
  motivo?: 'troca' | 'lembrete_troca' | 'cerca' | 'comprovante' | 'agente' | 'manual' | 'dono';
  waId?: string;
  criadoEm: string; // ISO
}

export interface PosicaoGps {
  lat: number;
  lon: number;
  velocidadeKmh?: number;
  dataHora: string; // ISO
  odometroKm?: number;
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
  /** IMEI / identificador do rastreador GPS instalado na moto */
  gpsImei?: string;
  gpsUltimaPosicao?: PosicaoGps;
  /** Ponto de referência usado para somar a distância percorrida */
  gpsReferencia?: PosicaoGps;
  /** Km da moto na última troca de cada peça do plano (chave = id da peça) */
  pecasUltimaTrocaKm?: Record<string, number>;
  /** Cerca virtual: moto está fora das cidades permitidas */
  foraDaArea?: boolean;
  foraDaAreaDesde?: string;
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
  plano?: 'Semanal' | 'Mensal' | 'Anual';
  /** Km da moto no início do contrato */
  kmInicial?: number;
  /** Km rodados com o cliente neste contrato (somados pelo GPS / leituras de hodômetro) */
  kmRodados?: number;
  /** Quantos ciclos de km (ex.: a cada 1.000 km) já foram cobrados */
  kmCiclosCobrados?: number;
}

export type FormaPagamento = 'PIX' | 'Boleto' | 'Cartão' | 'Transferência';

export type TipoCobranca = 'Mensalidade' | 'Km rodado' | 'Peças / Manutenção' | 'Avulso';

export interface Pagamento {
  id: string;
  clienteId: string;
  contratoId: string;
  motoId: string;
  competencia: string;
  valor: number;
  /** dd/mm/aaaa */
  vencimento: string;
  dataPagamento?: string;
  formaPagamento: FormaPagamento;
  status: PagamentoStatus;
  tipo?: TipoCobranca;
  descricao?: string;
}

export interface PecaPlano {
  id: string;
  nome: string;
  tipo: TipoManutencao;
  /** A cada quantos km a peça deve ser trocada */
  intervaloKm: number;
  /** Quando vence, o sistema avisa o cliente e pede o comprovante (o cliente não é cobrado) */
  exigirComprovante: boolean;
}

export interface ConfigSistema {
  empresa: {
    nome: string;
    cnpj: string;
    telefone: string;
    pix: string;
  };
  cicloRevisaoKm: number;
  caucaoPadrao: number;
  diasAvisoVencimento: number;
  cobrancaKm: {
    ativo: boolean;
    kmPorCiclo: number;
    valorPorCiclo: number;
    diasParaVencimento: number;
  };
  planoPecas: PecaPlano[];
  /** Oficinas/locais onde o cliente deve fazer as trocas */
  oficinas: Oficina[];
  oficinaPadraoId: string;
  trocas: {
    /** Reenviar o aviso ao cliente a cada X km sem comprovante */
    lembreteACadaKm: number;
    /** Passou X km do vencimento sem comprovante: avisa o dono */
    toleranciaKm: number;
  };
  cercaVirtual: {
    ativo: boolean;
    cidades: CidadePermitida[];
  };
  whatsapp: {
    /** WhatsApp do dono para receber alertas (com DDD) */
    numeroDono: string;
    /** O agente de IA responde as mensagens dos clientes */
    agenteResponde: boolean;
    avisarTrocas: boolean;
    avisarCerca: boolean;
  };
  gps: {
    /** Pontos que impliquem velocidade acima disso são descartados (erro de GPS) */
    velocidadeMaxKmh: number;
    /** Movimentos menores que isso são considerados ruído do GPS */
    distanciaMinimaM: number;
  };
}

export interface StatusIntegracoes {
  whatsappConfigurado: boolean;
  iaConfigurada: boolean;
  /** Mensagens pendentes de envio na fila */
  filaPendente: number;
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
  tipo: 'aluguel' | 'pagamento' | 'manutencao' | 'cliente' | 'comercial' | 'gps';
  referenciaId?: string;
  /** ISO — quando existir, o horário é calculado ("Há 5 min") */
  criadoEm?: string;
}

/** Tudo o que o servidor devolve para a tela */
export interface EstadoSistema {
  motos: Moto[];
  clientes: Cliente[];
  alugueis: Aluguel[];
  contratos: Contrato[];
  pagamentos: Pagamento[];
  manutencoes: ManutencaoItem[];
  leads: Lead[];
  campanhas: CampanhaMarketing[];
  atividades: AtividadeRecente[];
  mensagens: MensagemWhatsApp[];
  config: ConfigSistema;
  integracoes: StatusIntegracoes;
}

export interface AlertaSistema {
  id: string;
  titulo: string;
  detalhe: string;
  severidade: 'alta' | 'media' | 'info';
  destinoTab: NavTab;
}
