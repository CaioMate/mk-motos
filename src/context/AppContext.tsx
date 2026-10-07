import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
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
  ConfigSistema,
  EstadoSistema,
  FormaPagamento,
} from '../types/mkMotos';
import { calcularAlertas } from '../lib/indicadores';

export interface ToastMessage {
  id: string;
  text: string;
  subtext?: string;
  erro?: boolean;
}

type Conexao = 'carregando' | 'online' | 'offline';

interface AppContextType {
  activeTab: NavTab;
  setActiveTab: (tab: NavTab) => void;
  conexao: Conexao;
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
  config: ConfigSistema;
  estado: EstadoSistema;

  // Deep-link modal states for connected storytelling
  selectedMotoId: string | null;
  setSelectedMotoId: (id: string | null) => void;
  selectedClienteId: string | null;
  setSelectedClienteId: (id: string | null) => void;
  selectedContratoId: string | null;
  setSelectedContratoId: (id: string | null) => void;
  whatsAppTargetCliente: Cliente | null;
  setWhatsAppTargetCliente: (cliente: Cliente | null) => void;

  // Actions
  showToast: (text: string, subtext?: string, erro?: boolean) => void;
  toasts: ToastMessage[];
  dismissToast: (id: string) => void;

  navigateToMoto: (motoId: string) => void;
  navigateToCliente: (clienteId: string) => void;
  navigateToContrato: (contratoId: string) => void;

  /** Todas as ações abaixo vão para o servidor e devolvem true se deram certo. */
  updateMotoStatus: (motoId: string, status: MotoStatus) => Promise<boolean>;
  addMoto: (novaMoto: {
    modelo: string;
    marca: 'Honda' | 'Yamaha';
    ano: number;
    placa: string;
    cor: string;
    chassi?: string;
    kmAtual: number;
    valorMensal: number;
    valorSemanal?: number;
    gpsImei?: string;
  }) => Promise<boolean>;
  updateMotoDetails: (motoId: string, updates: Partial<Moto>) => Promise<boolean>;
  registrarLeituraKm: (motoId: string, kmAtual: number) => Promise<boolean>;

  addCliente: (novoCliente: Partial<Cliente>) => Promise<boolean>;
  updateCliente: (clienteId: string, updates: Partial<Cliente>) => Promise<boolean>;

  createFullAluguel: (payload: {
    clienteId: string;
    motoId: string;
    dataInicio: string;
    dataPrevista: string;
    plano: 'Semanal' | 'Mensal' | 'Anual';
    valorMensal: number;
    caucao: number;
    formaPagamento: FormaPagamento;
    pagamentoConfirmado: boolean;
  }) => Promise<boolean>;
  finalizarAluguel: (aluguelId: string, kmFinal?: number) => Promise<boolean>;

  registrarPagamento: (payload: {
    pagamentoId?: string;
    clienteId: string;
    contratoId?: string;
    valor: number;
    vencimento: string;
    formaPagamento: FormaPagamento;
    descricao?: string;
  }) => Promise<boolean>;
  criarCobranca: (payload: {
    clienteId: string;
    valor: number;
    vencimento: string;
    descricao: string;
    formaPagamento: FormaPagamento;
  }) => Promise<boolean>;
  cancelarCobranca: (pagamentoId: string) => Promise<boolean>;

  registrarManutencao: (payload: {
    motoId: string;
    tipo: ManutencaoItem['tipo'];
    kmNaManutencao: number;
    custo: number;
    oficina: string;
    observacao: string;
    colocarEmManutencao: boolean;
    pecaId?: string;
  }) => Promise<boolean>;
  concluirManutencao: (payload: {
    manutencaoId: string;
    custo?: number;
    oficina?: string;
    observacao?: string;
  }) => Promise<boolean>;

  addLead: (novoLead: Omit<Lead, 'id' | 'dataEntrada'>) => Promise<boolean>;
  moveLeadStage: (leadId: string, stage: LeadStage) => Promise<boolean>;
  converterLeadEmCliente: (leadId: string) => Promise<boolean>;
  assinarContrato: (contratoId: string) => Promise<boolean>;

  aprovarComprovante: (manutencaoId: string, comprovanteId: string, custo?: number) => Promise<boolean>;
  recusarComprovante: (manutencaoId: string, comprovanteId: string, motivo: string) => Promise<boolean>;
  anexarComprovante: (manutencaoId: string, arquivo: File) => Promise<boolean>;
  reenviarAvisoTroca: (manutencaoId: string) => Promise<boolean>;
  enviarMensagemWhatsApp: (payload: { clienteId?: string; telefone?: string; texto: string }) => Promise<boolean>;

  salvarConfig: (config: Partial<ConfigSistema>) => Promise<boolean>;
  limparDemonstracao: () => Promise<boolean>;
  restaurarDemonstracao: () => Promise<boolean>;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

async function chamarApi(nome: string, payload: unknown) {
  const url = nome.startsWith('/') ? nome : `/api/acoes/${nome}`;
  const r = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload ?? {}),
  });
  const json = await r.json().catch(() => ({ erro: 'Resposta inválida do servidor.' }));
  if (!r.ok) throw new Error(json.erro || `Erro ${r.status}`);
  return json as { mensagem?: string; sub?: string; resultado?: unknown; estado: EstadoSistema };
}

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [activeTab, setActiveTab] = useState<NavTab>('dashboard');
  const [estado, setEstado] = useState<EstadoSistema | null>(null);
  const [conexao, setConexao] = useState<Conexao>('carregando');

  const [selectedMotoId, setSelectedMotoId] = useState<string | null>(null);
  const [selectedClienteId, setSelectedClienteId] = useState<string | null>(null);
  const [selectedContratoId, setSelectedContratoId] = useState<string | null>(null);
  const [whatsAppTargetCliente, setWhatsAppTargetCliente] = useState<Cliente | null>(null);

  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const showToast = useCallback((text: string, subtext?: string, erro?: boolean) => {
    const id = `toast-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    setToasts((prev) => [...prev, { id, text, subtext, erro }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, erro ? 6000 : 3800);
  }, []);

  const dismissToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  // ---------------------------------------------------------------- sincronização com o servidor
  const carregar = useCallback(async () => {
    try {
      const r = await fetch('/api/estado');
      if (!r.ok) throw new Error();
      setEstado(await r.json());
      setConexao('online');
    } catch {
      setConexao('offline');
    }
  }, []);

  const carregarRef = useRef(carregar);
  carregarRef.current = carregar;

  useEffect(() => {
    carregar();
    // Atualização em tempo real: o servidor avisa quando algo muda (GPS, outra pessoa, rotinas)
    const fonte = new EventSource('/api/eventos');
    fonte.addEventListener('atualizado', () => carregarRef.current());
    fonte.addEventListener('conectado', () => carregarRef.current());
    fonte.onerror = () => setConexao('offline');
    // Reserva: se o canal em tempo real cair, consulta a cada 30 s
    const intervalo = setInterval(() => carregarRef.current(), 30_000);
    return () => {
      fonte.close();
      clearInterval(intervalo);
    };
  }, [carregar]);

  const executar = useCallback(
    async (nome: string, payload: unknown): Promise<boolean> => {
      try {
        const r = await chamarApi(nome, payload);
        setEstado(r.estado);
        setConexao('online');
        if (r.mensagem) showToast(r.mensagem, r.sub);
        return true;
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        if (msg === 'Failed to fetch') {
          setConexao('offline');
          showToast('Sem conexão com o servidor', 'Verifique se o computador do sistema está ligado.', true);
        } else {
          showToast('Não foi possível concluir', msg, true);
        }
        return false;
      }
    },
    [showToast]
  );

  const alertas = useMemo(() => (estado ? calcularAlertas(estado) : []), [estado]);

  // ---------------------------------------------------------------- navegação
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
    setActiveTab('alugueis');
    setSelectedContratoId(contratoId);
  };

  if (!estado) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0B0B0B] text-white p-6">
        <div className="max-w-md text-center space-y-3">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-[#E50914] font-extrabold">MK</div>
          {conexao === 'offline' ? (
            <>
              <p className="text-lg font-bold">Servidor do sistema não encontrado</p>
              <p className="text-sm text-slate-300">
                Verifique se o computador onde o MK Motos está instalado está ligado e com o
                servidor aberto (arquivo <strong>iniciar-mk-motos.bat</strong>). Tentando de novo
                automaticamente…
              </p>
            </>
          ) : (
            <p className="text-sm text-slate-300">Carregando dados…</p>
          )}
        </div>
      </div>
    );
  }

  return (
    <AppContext.Provider
      value={{
        activeTab,
        setActiveTab,
        conexao,
        motos: estado.motos,
        clientes: estado.clientes,
        alugueis: estado.alugueis,
        contratos: estado.contratos,
        pagamentos: estado.pagamentos,
        manutencoes: estado.manutencoes,
        leads: estado.leads,
        campanhas: estado.campanhas,
        atividades: estado.atividades,
        alertas,
        config: estado.config,
        estado,
        selectedMotoId,
        setSelectedMotoId,
        selectedClienteId,
        setSelectedClienteId,
        selectedContratoId,
        setSelectedContratoId,
        whatsAppTargetCliente,
        setWhatsAppTargetCliente,
        showToast,
        toasts,
        dismissToast,
        navigateToMoto,
        navigateToCliente,
        navigateToContrato,
        updateMotoStatus: (motoId, status) => executar('updateMotoStatus', { motoId, status }),
        addMoto: (novaMoto) => executar('addMoto', novaMoto),
        updateMotoDetails: (motoId, updates) => executar('updateMotoDetails', { motoId, updates }),
        registrarLeituraKm: (motoId, kmAtual) => executar('registrarLeituraKm', { motoId, kmAtual }),
        addCliente: (novoCliente) => executar('addCliente', novoCliente),
        updateCliente: (clienteId, updates) => executar('updateCliente', { clienteId, updates }),
        createFullAluguel: (payload) => executar('createFullAluguel', payload),
        finalizarAluguel: (aluguelId, kmFinal) => executar('finalizarAluguel', { aluguelId, kmFinal }),
        registrarPagamento: (payload) => executar('registrarPagamento', payload),
        criarCobranca: (payload) => executar('criarCobranca', payload),
        cancelarCobranca: (pagamentoId) => executar('cancelarCobranca', { pagamentoId }),
        registrarManutencao: (payload) => executar('registrarManutencao', payload),
        concluirManutencao: (payload) => executar('concluirManutencao', payload),
        addLead: (novoLead) => executar('addLead', novoLead),
        moveLeadStage: (leadId, stage) => executar('moveLeadStage', { leadId, stage }),
        converterLeadEmCliente: (leadId) => executar('converterLeadEmCliente', { leadId }),
        assinarContrato: (contratoId) => executar('assinarContrato', { contratoId }),
        aprovarComprovante: (manutencaoId, comprovanteId, custo) =>
          executar('aprovarComprovante', { manutencaoId, comprovanteId, custo }),
        recusarComprovante: (manutencaoId, comprovanteId, motivo) =>
          executar('recusarComprovante', { manutencaoId, comprovanteId, motivo }),
        anexarComprovante: async (manutencaoId, arquivo) => {
          const base64 = await new Promise<string>((ok, falha) => {
            const leitor = new FileReader();
            leitor.onload = () => ok(String(leitor.result).split(',')[1] ?? '');
            leitor.onerror = () => falha(leitor.error);
            leitor.readAsDataURL(arquivo);
          });
          return executar(`/api/manutencoes/${manutencaoId}/comprovante`, { base64, mime: arquivo.type });
        },
        reenviarAvisoTroca: (manutencaoId) => executar('reenviarAvisoTroca', { manutencaoId }),
        enviarMensagemWhatsApp: (payload) => executar('enviarMensagemWhatsApp', payload),
        salvarConfig: (config) => executar('salvarConfig', { config }),
        limparDemonstracao: () => executar('limparDemonstracao', {}),
        restaurarDemonstracao: () => executar('restaurarDemonstracao', {}),
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
