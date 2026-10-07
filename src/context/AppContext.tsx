import React, { createContext, useContext, useState } from 'react';
import {
  NavTab,
  Moto,
  MotoStatus,
  Cliente,
  Aluguel,
  Contrato,
  Pagamento,
  ManutencaoItem,
  Lead,
  LeadStage,
  CampanhaMarketing,
  AtividadeRecente,
  AlertaSistema,
} from '../types/mkMotos';
import {
  INITIAL_MOTOS,
  INITIAL_CLIENTES,
  INITIAL_ALUGUEIS,
  INITIAL_CONTRATOS,
  INITIAL_PAGAMENTOS,
  INITIAL_MANUTENCOES,
  INITIAL_LEADS,
  INITIAL_CAMPANHAS,
  INITIAL_ATIVIDADES,
  INITIAL_ALERTAS,
  MOTO_IMAGES,
} from '../data/mockData';

export interface ToastMessage {
  id: string;
  text: string;
  subtext?: string;
}

interface AppContextType {
  activeTab: NavTab;
  setActiveTab: (tab: NavTab) => void;
  motos: Moto[];
  clientes: Cliente[];
  alugueis: Aluguel[];
  contratos: Contrato[];
  pagamentos: Pagamento[];
  manutencoes: ManutencaoItem[];
  leads: Lead[];
  campanhas: CampanhaMarketing[];
  atividades: AtividadeRecente[];
  alertas: AlertaSistema[];

  // Deep-link modal states for connected storytelling
  selectedMotoId: string | null;
  setSelectedMotoId: (id: string | null) => void;
  selectedClienteId: string | null;
  setSelectedClienteId: (id: string | null) => void;
  selectedContratoId: string | null;
  setSelectedContratoId: (id: string | null) => void;
  whatsAppTargetCliente: Cliente | null;
  setWhatsAppTargetCliente: (cliente: Cliente | null) => void;

  // Guided Tour Mode ("Modo demonstração")
  demoTourActive: boolean;
  setDemoTourActive: (active: boolean) => void;
  demoStep: number;
  setDemoStep: (step: number) => void;

  // Actions
  showToast: (text: string, subtext?: string) => void;
  toasts: ToastMessage[];
  dismissToast: (id: string) => void;

  navigateToMoto: (motoId: string) => void;
  navigateToCliente: (clienteId: string) => void;
  navigateToContrato: (contratoId: string) => void;

  updateMotoStatus: (motoId: string, status: MotoStatus) => void;
  addMoto: (novaMoto: Omit<Moto, 'id' | 'codigo' | 'foto'> & { foto?: string }) => void;
  updateMotoDetails: (motoId: string, updates: Partial<Moto>) => void;

  addCliente: (novoCliente: Omit<Cliente, 'id' | 'dataCadastro'>) => Cliente;

  createFullAluguel: (payload: {
    clienteId: string;
    motoId: string;
    dataInicio: string;
    dataPrevista: string;
    plano: 'Semanal' | 'Mensal' | 'Anual';
    valorMensal: number;
    caucao: number;
    formaPagamento: 'PIX' | 'Boleto' | 'Cartão' | 'Transferência';
    pagamentoConfirmado: boolean;
  }) => void;
  finalizarAluguel: (aluguelId: string) => void;

  registrarPagamento: (payload: {
    pagamentoId?: string;
    clienteId: string;
    contratoId: string;
    motoId: string;
    valor: number;
    vencimento: string;
    formaPagamento: 'PIX' | 'Boleto' | 'Cartão' | 'Transferência';
  }) => void;

  registrarManutencao: (payload: {
    motoId: string;
    tipo: ManutencaoItem['tipo'];
    kmNaManutencao: number;
    custo: number;
    oficina: string;
    observacao: string;
    colocarEmManutencao: boolean;
  }) => void;

  addLead: (novoLead: Omit<Lead, 'id' | 'dataEntrada'>) => void;
  moveLeadStage: (leadId: string, stage: LeadStage) => void;
  converterLeadEmCliente: (leadId: string) => void;
  assinarContrato: (contratoId: string) => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [activeTab, setActiveTab] = useState<NavTab>('dashboard');
  const [motos, setMotos] = useState<Moto[]>(INITIAL_MOTOS);
  const [clientes, setClientes] = useState<Cliente[]>(INITIAL_CLIENTES);
  const [alugueis, setAlugueis] = useState<Aluguel[]>(INITIAL_ALUGUEIS);
  const [contratos, setContratos] = useState<Contrato[]>(INITIAL_CONTRATOS);
  const [pagamentos, setPagamentos] = useState<Pagamento[]>(INITIAL_PAGAMENTOS);
  const [manutencoes, setManutencoes] = useState<ManutencaoItem[]>(INITIAL_MANUTENCOES);
  const [leads, setLeads] = useState<Lead[]>(INITIAL_LEADS);
  const [campanhas] = useState<CampanhaMarketing[]>(INITIAL_CAMPANHAS);
  const [atividades, setAtividades] = useState<AtividadeRecente[]>(INITIAL_ATIVIDADES);
  const [alertas] = useState<AlertaSistema[]>(INITIAL_ALERTAS);

  const [selectedMotoId, setSelectedMotoId] = useState<string | null>(null);
  const [selectedClienteId, setSelectedClienteId] = useState<string | null>(null);
  const [selectedContratoId, setSelectedContratoId] = useState<string | null>(null);
  const [whatsAppTargetCliente, setWhatsAppTargetCliente] = useState<Cliente | null>(null);

  const [demoTourActive, setDemoTourActive] = useState<boolean>(false);
  const [demoStep, setDemoStep] = useState<number>(0);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const showToast = (text: string, subtext?: string) => {
    const id = `toast-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    setToasts((prev) => [...prev, { id, text, subtext }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3800);
  };

  const dismissToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  const navigateToMoto = (motoId: string) => {
    setSelectedClienteId(null);
    setSelectedContratoId(null);
    setActiveTab('frota');
    setSelectedMotoId(motoId);
  };

  const navigateToCliente = (clienteId: string) => {
    setSelectedMotoId(null);
    setSelectedContratoId(null);
    setActiveTab('clientes');
    setSelectedClienteId(clienteId);
  };

  const navigateToContrato = (contratoId: string) => {
    setSelectedMotoId(null);
    setSelectedClienteId(null);
    setActiveTab('contratos');
    setSelectedContratoId(contratoId);
  };

  const updateMotoStatus = (motoId: string, status: MotoStatus) => {
    const targetMoto = motos.find((m) => m.id === motoId);
    setMotos((prev) => prev.map((m) => (m.id === motoId ? { ...m, status } : m)));
    if (targetMoto) {
      const labelMap: Record<MotoStatus, string> = {
        MANUTENÇÃO: 'Moto atualizada para manutenção ✓',
        DISPONÍVEL: 'Moto liberada como disponível ✓',
        ALUGADA: 'Moto marcada como alugada ✓',
        ATRASADA: 'Moto sinalizada como atrasada ✓',
      };
      showToast(labelMap[status], `${targetMoto.modelo} (${targetMoto.placa})`);
      setAtividades((prev) => [
        {
          id: `ativ-${Date.now()}`,
          titulo: `Status alterado — ${targetMoto.modelo}`,
          subtitulo: `Placa ${targetMoto.placa} atualizada para ${status}`,
          horario: 'Agora mesmo',
          tipo: 'manutencao',
          referenciaId: motoId,
        },
        ...prev,
      ]);
    }
  };

  const addMoto = (novaMoto: Omit<Moto, 'id' | 'codigo' | 'foto'> & { foto?: string }) => {
    const nextNum = motos.length + 1;
    const id = `moto-${Date.now()}`;
    const codigo = `MK-${String(nextNum).padStart(3, '0')}`;
    const defaultFoto = novaMoto.modelo.toLowerCase().includes('biz')
      ? MOTO_IMAGES.biz125
      : novaMoto.modelo.toLowerCase().includes('factor')
      ? MOTO_IMAGES.factor150
      : novaMoto.modelo.toLowerCase().includes('bros')
      ? MOTO_IMAGES.bros160
      : novaMoto.modelo.toLowerCase().includes('fazer')
      ? MOTO_IMAGES.fazer250
      : MOTO_IMAGES.cg160;

    const created: Moto = {
      ...novaMoto,
      id,
      codigo,
      foto: novaMoto.foto || defaultFoto,
    };
    setMotos((prev) => [created, ...prev]);
    showToast('Nova motocicleta adicionada à frota ✓', `${created.modelo} • ${created.placa}`);
  };

  const updateMotoDetails = (motoId: string, updates: Partial<Moto>) => {
    setMotos((prev) => prev.map((m) => (m.id === motoId ? { ...m, ...updates } : m)));
    showToast('Dados da motocicleta atualizados ✓');
  };

  const addCliente = (novoCliente: Omit<Cliente, 'id' | 'dataCadastro'>): Cliente => {
    const created: Cliente = {
      ...novoCliente,
      id: `cli-${Date.now()}`,
      dataCadastro: '29/09/2026',
    };
    setClientes((prev) => [created, ...prev]);
    setAtividades((prev) => [
      {
        id: `ativ-${Date.now()}`,
        titulo: `Novo cliente cadastrado — ${created.nome}`,
        subtitulo: `Origem: ${created.origemLead}`,
        horario: 'Agora mesmo',
        tipo: 'cliente',
        referenciaId: created.id,
      },
      ...prev,
    ]);
    showToast('Cliente cadastrado com sucesso ✓', created.nome);
    return created;
  };

  const createFullAluguel = (payload: {
    clienteId: string;
    motoId: string;
    dataInicio: string;
    dataPrevista: string;
    plano: 'Semanal' | 'Mensal' | 'Anual';
    valorMensal: number;
    caucao: number;
    formaPagamento: 'PIX' | 'Boleto' | 'Cartão' | 'Transferência';
    pagamentoConfirmado: boolean;
  }) => {
    const ctrNumber = `CTR-2026-00${contratos.length + 1}`;
    const locNumber = `LOC-2026-00${alugueis.length + 1}`;
    const newAluguelId = `alu-${Date.now()}`;
    const newContratoId = `ctr-${Date.now()}`;

    const novoAluguel: Aluguel = {
      id: newAluguelId,
      codigo: locNumber,
      clienteId: payload.clienteId,
      motoId: payload.motoId,
      contratoId: newContratoId,
      dataInicio: payload.dataInicio,
      dataPrevista: payload.dataPrevista,
      plano: payload.plano,
      valorMensal: payload.valorMensal,
      caucao: payload.caucao,
      status: 'Ativo',
    };

    const novoContrato: Contrato = {
      id: newContratoId,
      numero: ctrNumber,
      clienteId: payload.clienteId,
      motoId: payload.motoId,
      aluguelId: newAluguelId,
      dataEmissao: payload.dataInicio,
      dataVencimento: payload.dataPrevista,
      valorMensal: payload.valorMensal,
      caucao: payload.caucao,
      franquiaKmMensal: 4500,
      status: 'Ativo',
    };

    const novoPagamento: Pagamento = {
      id: `pag-${Date.now()}`,
      clienteId: payload.clienteId,
      contratoId: newContratoId,
      motoId: payload.motoId,
      competencia: 'Outubro/2026',
      valor: payload.valorMensal,
      vencimento: '05/10',
      dataPagamento: payload.pagamentoConfirmado ? '29/09/2026' : undefined,
      formaPagamento: payload.formaPagamento,
      status: payload.pagamentoConfirmado ? 'Pago' : 'Pendente',
    };

    setAlugueis((prev) => [novoAluguel, ...prev]);
    setContratos((prev) => [novoContrato, ...prev]);
    setPagamentos((prev) => [novoPagamento, ...prev]);
    setMotos((prev) =>
      prev.map((m) =>
        m.id === payload.motoId
          ? {
              ...m,
              status: 'ALUGADA',
              clienteAtualId: payload.clienteId,
              contratoAtualId: newContratoId,
            }
          : m
      )
    );
    setClientes((prev) =>
      prev.map((c) =>
        c.id === payload.clienteId
          ? {
              ...c,
              status: 'Ativo',
              motoAtualId: payload.motoId,
              contratoAtualId: newContratoId,
              proximoPagamentoValor: payload.valorMensal,
              proximoPagamentoData: '05/10/2026',
            }
          : c
      )
    );

    const motoObj = motos.find((m) => m.id === payload.motoId);
    const cliObj = clientes.find((c) => c.id === payload.clienteId);
    setAtividades((prev) => [
      {
        id: `ativ-${Date.now()}`,
        titulo: `Novo aluguel criado — ${motoObj?.modelo || 'Motocicleta'}`,
        subtitulo: `Contrato ${ctrNumber} vinculado a ${cliObj?.nome || 'Cliente'}`,
        horario: 'Agora mesmo',
        tipo: 'aluguel',
        referenciaId: payload.motoId,
      },
      ...prev,
    ]);
    showToast('Aluguel e contrato gerados com sucesso ✓', `${ctrNumber} • ${cliObj?.nome}`);
  };

  const finalizarAluguel = (aluguelId: string) => {
    const alu = alugueis.find((a) => a.id === aluguelId);
    if (!alu) return;
    setAlugueis((prev) => prev.map((a) => (a.id === aluguelId ? { ...a, status: 'Finalizado' } : a)));
    setContratos((prev) =>
      prev.map((c) => (c.id === alu.contratoId ? { ...c, status: 'Finalizado' } : c))
    );
    setMotos((prev) =>
      prev.map((m) =>
        m.id === alu.motoId
          ? { ...m, status: 'DISPONÍVEL', clienteAtualId: undefined, contratoAtualId: undefined }
          : m
      )
    );
    showToast('Aluguel finalizado e moto liberada na frota ✓', alu.codigo);
  };

  const registrarPagamento = (payload: {
    pagamentoId?: string;
    clienteId: string;
    contratoId: string;
    motoId: string;
    valor: number;
    vencimento: string;
    formaPagamento: 'PIX' | 'Boleto' | 'Cartão' | 'Transferência';
  }) => {
    if (payload.pagamentoId) {
      setPagamentos((prev) =>
        prev.map((p) =>
          p.id === payload.pagamentoId
            ? {
                ...p,
                status: 'Pago',
                dataPagamento: '29/09/2026',
                formaPagamento: payload.formaPagamento,
              }
            : p
        )
      );
    } else {
      const novo: Pagamento = {
        id: `pag-${Date.now()}`,
        clienteId: payload.clienteId,
        contratoId: payload.contratoId,
        motoId: payload.motoId,
        competencia: 'Outubro/2026',
        valor: payload.valor,
        vencimento: payload.vencimento,
        dataPagamento: '29/09/2026',
        formaPagamento: payload.formaPagamento,
        status: 'Pago',
      };
      setPagamentos((prev) => [novo, ...prev]);
    }

    setClientes((prev) =>
      prev.map((c) => (c.id === payload.clienteId ? { ...c, status: 'Ativo' } : c))
    );
    const cli = clientes.find((c) => c.id === payload.clienteId);
    setAtividades((prev) => [
      {
        id: `ativ-${Date.now()}`,
        titulo: `Pagamento recebido — ${cli?.nome || 'Cliente'}`,
        subtitulo: `R$ ${payload.valor.toLocaleString('pt-BR')} confirmado via ${payload.formaPagamento}`,
        horario: 'Agora mesmo',
        tipo: 'pagamento',
        referenciaId: payload.clienteId,
      },
      ...prev,
    ]);
    showToast('Pagamento registrado com sucesso ✓', `R$ ${payload.valor.toLocaleString('pt-BR')} • ${cli?.nome || ''}`);
  };

  const registrarManutencao = (payload: {
    motoId: string;
    tipo: ManutencaoItem['tipo'];
    kmNaManutencao: number;
    custo: number;
    oficina: string;
    observacao: string;
    colocarEmManutencao: boolean;
  }) => {
    const nova: ManutencaoItem = {
      id: `man-${Date.now()}`,
      motoId: payload.motoId,
      tipo: payload.tipo,
      data: '29/09/2026',
      kmNaManutencao: payload.kmNaManutencao,
      custo: payload.custo,
      oficina: payload.oficina,
      observacao: payload.observacao,
      concluida: !payload.colocarEmManutencao,
    };
    setManutencoes((prev) => [nova, ...prev]);
    setMotos((prev) =>
      prev.map((m) =>
        m.id === payload.motoId
          ? {
              ...m,
              kmAtual: Math.max(m.kmAtual, payload.kmNaManutencao),
              ultimaRevisaoKm: payload.kmNaManutencao,
              proximaRevisaoKm: payload.kmNaManutencao + 5000,
              ultimaManutencaoData: '29/09/2026',
              status: payload.colocarEmManutencao ? 'MANUTENÇÃO' : m.status,
            }
          : m
      )
    );
    const motoObj = motos.find((m) => m.id === payload.motoId);
    showToast(
      payload.colocarEmManutencao
        ? 'Moto atualizada para manutenção ✓'
        : 'Manutenção registrada com sucesso ✓',
      `${payload.tipo} • ${motoObj?.modelo || ''}`
    );
  };

  const addLead = (novoLead: Omit<Lead, 'id' | 'dataEntrada'>) => {
    const created: Lead = {
      ...novoLead,
      id: `lead-${Date.now()}`,
      dataEntrada: 'Agora mesmo',
    };
    setLeads((prev) => [created, ...prev]);
    showToast('Novo lead adicionado ao pipeline ✓', `${created.nome} (${created.origem})`);
  };

  const moveLeadStage = (leadId: string, stage: LeadStage) => {
    setLeads((prev) => prev.map((l) => (l.id === leadId ? { ...l, stage } : l)));
    showToast('Etapa do lead atualizada ✓', stage);
  };

  const converterLeadEmCliente = (leadId: string) => {
    const lead = leads.find((l) => l.id === leadId);
    if (!lead) return;

    const existingCliente = clientes.find(
      (c) => c.nome.toLowerCase() === lead.nome.toLowerCase()
    );

    let targetClienteId = existingCliente?.id;

    if (!existingCliente) {
      const novoCli: Cliente = {
        id: `cli-${Date.now()}`,
        nome: lead.nome,
        cpf: '412.890.318-20',
        cnh: '06829104812 (Cat. A)',
        telefone: lead.telefone,
        email: `${lead.nome.toLowerCase().replace(/\s+/g, '.')}@email.com`,
        endereco: 'Av. Paulista, 1000 - Bela Vista',
        cidade: 'São Paulo - SP',
        dataCadastro: '29/09/2026',
        status: 'Ativo',
        proximoPagamentoData: '10/10/2026',
        proximoPagamentoValor: 850,
        origemLead: lead.origem,
        campanhaOrigem: lead.campanha,
        observacoes: `Lead convertido da Central Comercial. Interesse inicial: ${lead.motoInteresse}.`,
      };
      setClientes((prev) => [novoCli, ...prev]);
      targetClienteId = novoCli.id;
    }

    setLeads((prev) =>
      prev.map((l) =>
        l.id === leadId
          ? {
              ...l,
              stage: 'ALUGUEL REALIZADO',
              convertidoClienteId: targetClienteId,
            }
          : l
      )
    );

    setAtividades((prev) => [
      {
        id: `ativ-${Date.now()}`,
        titulo: `Lead convertido em cliente — ${lead.nome}`,
        subtitulo: `Origem: ${lead.origem} • Interesse: ${lead.motoInteresse}`,
        horario: 'Agora mesmo',
        tipo: 'comercial',
        referenciaId: targetClienteId,
      },
      ...prev,
    ]);

    showToast('Lead convertido em cliente ✓', `${lead.nome} agora consta na base de Clientes`);
  };

  const assinarContrato = (contratoId: string) => {
    const ctr = contratos.find((c) => c.id === contratoId);
    setContratos((prev) =>
      prev.map((c) => (c.id === contratoId ? { ...c, status: 'Ativo' } : c))
    );
    showToast('Assinatura registrada com sucesso ✓', ctr?.numero);
  };

  return (
    <AppContext.Provider
      value={{
        activeTab,
        setActiveTab,
        motos,
        clientes,
        alugueis,
        contratos,
        pagamentos,
        manutencoes,
        leads,
        campanhas,
        atividades,
        alertas,
        selectedMotoId,
        setSelectedMotoId,
        selectedClienteId,
        setSelectedClienteId,
        selectedContratoId,
        setSelectedContratoId,
        whatsAppTargetCliente,
        setWhatsAppTargetCliente,
        demoTourActive,
        setDemoTourActive,
        demoStep,
        setDemoStep,
        showToast,
        toasts,
        dismissToast,
        navigateToMoto,
        navigateToCliente,
        navigateToContrato,
        updateMotoStatus,
        addMoto,
        updateMotoDetails,
        addCliente,
        createFullAluguel,
        finalizarAluguel,
        registrarPagamento,
        registrarManutencao,
        addLead,
        moveLeadStage,
        converterLeadEmCliente,
        assinarContrato,
      }}
    >
      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used inside AppProvider');
  return ctx;
};
