import React, { useState, useRef, useEffect } from 'react';
import {
  LayoutDashboard,
  Bike,
  Users,
  KeyRound,
  FileText,
  Wallet,
  Wrench,
  Megaphone,
  BarChart3,
  Settings,
  Bell,
  Search,
  Menu,
  X,
  Play,
  ChevronRight,
  ChevronLeft,
  CheckCircle2,
  ShieldCheck,
  AlertTriangle,
  MessageCircle,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { NavTab } from '../types/mkMotos';
import { GlobalModals } from './GlobalModals';

interface NavItemConfig {
  id: NavTab;
  label: string;
  icon: React.ElementType;
}

const NAV_ITEMS: NavItemConfig[] = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'frota', label: 'Frota', icon: Bike },
  { id: 'clientes', label: 'Clientes', icon: Users },
  { id: 'alugueis', label: 'Aluguéis', icon: KeyRound },
  { id: 'contratos', label: 'Contratos', icon: FileText },
  { id: 'financeiro', label: 'Financeiro', icon: Wallet },
  { id: 'manutencao', label: 'Manutenção', icon: Wrench },
  { id: 'comercial', label: 'Comercial', icon: Megaphone },
  { id: 'relatorios', label: 'Relatórios', icon: BarChart3 },
  { id: 'whatsapp', label: 'WhatsApp', icon: MessageCircle },
  { id: 'configuracoes', label: 'Configurações', icon: Settings },
];

const PRESENTATION_STEPS = [
  {
    step: 1,
    title: '1. Visão Geral no Dashboard',
    description: 'Mostre os indicadores em tempo real: motos na frota, alugadas, disponíveis, receita e alertas automáticos.',
    run: (ctx: ReturnType<typeof useApp>) => {
      ctx.setSelectedMotoId(null);
      ctx.setSelectedClienteId(null);
      ctx.setSelectedContratoId(null);
      ctx.setActiveTab('dashboard');
    },
  },
  {
    step: 2,
    title: '2. Entrar na Gestão de Frota',
    description: 'Visualize todas as motocicletas da MK Motos com fotos, placas, quilometragem e status operacional.',
    run: (ctx: ReturnType<typeof useApp>) => {
      ctx.setSelectedMotoId(null);
      ctx.setSelectedClienteId(null);
      ctx.setSelectedContratoId(null);
      ctx.setActiveTab('frota');
    },
  },
  {
    step: 3,
    title: '3. Selecionar Honda CG 160 (ABC-1234)',
    description: 'Abra a ficha técnica da Honda CG 160 e mostre que ela está alugada para João Silva e com revisão em 360 km.',
    run: (ctx: ReturnType<typeof useApp>) => {
      ctx.navigateToMoto('moto-1');
    },
  },
  {
    step: 4,
    title: '4. Abrir o Cliente João Silva',
    description: 'Da própria moto, navegue para o prontuário de João Silva: CNH, contato, moto vinculada e histórico.',
    run: (ctx: ReturnType<typeof useApp>) => {
      ctx.navigateToCliente('cli-1');
    },
  },
  {
    step: 5,
    title: '5. Visualizar o Contrato CTR-2026-001',
    description: 'Exiba o contrato formal gerado automaticamente vinculando João Silva e a Honda CG 160.',
    run: (ctx: ReturnType<typeof useApp>) => {
      ctx.navigateToContrato('ctr-1');
    },
  },
  {
    step: 6,
    title: '6. Conferir Pagamento no Financeiro',
    description: 'Mostre a mensalidade de R$ 850 do João Silva (Pago via PIX) e faturas pendentes/atrasadas.',
    run: (ctx: ReturnType<typeof useApp>) => {
      ctx.setSelectedMotoId(null);
      ctx.setSelectedClienteId(null);
      ctx.setSelectedContratoId(null);
      ctx.setActiveTab('financeiro');
    },
  },
  {
    step: 7,
    title: '7. Controle Preventivo de Manutenção',
    description: 'Mostre a Honda CG 160 com 9.640 km e alerta preventivo "Revisão em 360 km" (próxima aos 10.000 km).',
    run: (ctx: ReturnType<typeof useApp>) => {
      ctx.setSelectedMotoId(null);
      ctx.setSelectedClienteId(null);
      ctx.setSelectedContratoId(null);
      ctx.setActiveTab('manutencao');
    },
  },
  {
    step: 8,
    title: '8. Central Comercial & Origem Instagram',
    description: 'Mostre como o marketing no Instagram gerou o lead do João Silva e alimenta o pipeline Kanban de locação.',
    run: (ctx: ReturnType<typeof useApp>) => {
      ctx.setSelectedMotoId(null);
      ctx.setSelectedClienteId(null);
      ctx.setSelectedContratoId(null);
      ctx.setActiveTab('comercial');
    },
  },
  {
    step: 9,
    title: '9. Relatórios Executivos',
    description: 'Finalize apresentando os relatórios gerenciais de frota, receita, manutenção e conversão comercial.',
    run: (ctx: ReturnType<typeof useApp>) => {
      ctx.setSelectedMotoId(null);
      ctx.setSelectedClienteId(null);
      ctx.setSelectedContratoId(null);
      ctx.setActiveTab('relatorios');
    },
  },
];

export const LayoutShell: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const appCtx = useApp();
  const {
    activeTab,
    setActiveTab,
    motos,
    clientes,
    contratos,
    leads,
    navigateToMoto,
    navigateToCliente,
    navigateToContrato,
    demoTourActive,
    setDemoTourActive,
    demoStep,
    setDemoStep,
    toasts,
    dismissToast,
    showToast,
    alertas,
    conexao,
    config,
  } = appCtx;

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchFocused, setSearchFocused] = useState(false);

  const searchRef = useRef<HTMLDivElement>(null);
  const notifRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setSearchFocused(false);
      }
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) {
        setNotifOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const q = searchQuery.trim().toLowerCase();
  const matchedMotos = q
    ? motos.filter(
        (m) =>
          m.modelo.toLowerCase().includes(q) ||
          m.placa.toLowerCase().includes(q) ||
          m.codigo.toLowerCase().includes(q)
      )
    : [];
  const matchedClientes = q
    ? clientes.filter(
        (c) =>
          c.nome.toLowerCase().includes(q) ||
          c.telefone.toLowerCase().includes(q) ||
          c.cpf.toLowerCase().includes(q)
      )
    : [];
  const matchedContratos = q
    ? contratos.filter((c) => c.numero.toLowerCase().includes(q))
    : [];

  const hasSearchResults =
    matchedMotos.length > 0 || matchedClientes.length > 0 || matchedContratos.length > 0;

  const triggerStep = (index: number) => {
    const target = PRESENTATION_STEPS[index];
    if (!target) return;
    setDemoStep(index);
    target.run(appCtx);
  };

  return (
    <div className="min-h-screen flex bg-[#F8FAFC] text-[#0B0B0B]">
      {/* SIDEBAR FIXA (DESKTOP) */}
      <aside className="hidden lg:flex lg:w-64 lg:flex-col lg:fixed lg:inset-y-0 bg-[#0B0B0B] text-white border-r border-white/10 z-30 select-none">
        {/* LOGO MK MOTOS */}
        <div className="flex items-center justify-between h-16 px-6 border-b border-white/10">
          <button
            onClick={() => setActiveTab('dashboard')}
            className="flex items-center gap-3 text-left focus:outline-none group"
          >
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#E50914] text-white font-display font-extrabold text-base tracking-tighter shadow-sm">
              MK
            </div>
            <div>
              <span className="font-display text-lg font-extrabold tracking-tight text-white block leading-none">
                MK <span className="text-[#E50914]">MOTOS</span>
              </span>
              <span className="text-[11px] text-slate-400 tracking-wide block mt-0.5">
                Gestão & Locação
              </span>
            </div>
          </button>
        </div>

        {/* MENU DE NAVEGAÇÃO */}
        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all duration-150 whitespace-nowrap ${
                  isActive
                    ? 'bg-[#E50914] text-white font-semibold shadow-xs'
                    : 'text-slate-400 hover:bg-white/5 hover:text-white'
                }`}
              >
                <div className="flex items-center gap-3">
                  <Icon className={`h-4 w-4 ${isActive ? 'text-white' : 'text-slate-400'}`} />
                  <span>{item.label}</span>
                </div>
                {item.id === 'comercial' && (
                  <span
                    className={`text-[11px] font-mono-tabular ${
                      isActive ? 'text-white/90' : 'text-[#087BFF]'
                    }`}
                  >
                    CRM
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        {/* RODAPÉ DO MENU: MODO DEMONSTRAÇÃO + PERFIL ADMINISTRADOR */}
        <div className="p-4 border-t border-white/10 space-y-3 bg-[#0B0B0B]">
          {config.modoDemonstracao && (
          <button
            onClick={() => {
              const nextState = !demoTourActive;
              setDemoTourActive(nextState);
              if (nextState) {
                triggerStep(0);
                showToast(
                  'Modo demonstração ativado ✓',
                  'Use a barra superior para guiar a apresentação ao proprietário.'
                );
              } else {
                showToast('Modo demonstração recolhido ✓');
              }
            }}
            className={`w-full flex items-center justify-center gap-2 rounded-xl px-3.5 py-2.5 text-xs font-semibold transition-colors whitespace-nowrap ${
              demoTourActive
                ? 'bg-[#087BFF] text-white'
                : 'border border-white/15 bg-white/5 text-slate-200 hover:bg-white/10'
            }`}
          >
            <Play className="h-3.5 w-3.5 fill-current" />
            <span>{demoTourActive ? 'Roteiro Guiado Ativo' : 'Modo demonstração'}</span>
          </button>
          )}

          <div className="flex items-center gap-3 pt-1 px-1">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-white/10 text-xs font-bold text-white border border-white/15 shrink-0">
              MK
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold text-white truncate">Perfil</p>
              <p className="text-[11px] text-slate-400 truncate">Administrador</p>
            </div>
            <ShieldCheck className="h-4 w-4 text-[#087BFF] shrink-0" />
          </div>
        </div>
      </aside>

      {/* DRAWER MOBILE */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          <div
            className="fixed inset-0 bg-black/60 backdrop-blur-xs"
            onClick={() => setMobileMenuOpen(false)}
          />
          <aside className="relative w-72 max-w-[80vw] bg-[#0B0B0B] text-white flex flex-col h-full z-10">
            <div className="flex items-center justify-between h-16 px-5 border-b border-white/10">
              <span className="font-display text-lg font-extrabold tracking-tight text-white">
                MK <span className="text-[#E50914]">MOTOS</span>
              </span>
              <button
                onClick={() => setMobileMenuOpen(false)}
                className="p-2 text-slate-400 hover:text-white"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
              {NAV_ITEMS.map((item) => {
                const Icon = item.icon;
                const isActive = activeTab === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => {
                      setActiveTab(item.id);
                      setMobileMenuOpen(false);
                    }}
                    className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium ${
                      isActive
                        ? 'bg-[#E50914] text-white font-semibold'
                        : 'text-slate-400 hover:bg-white/5 hover:text-white'
                    }`}
                  >
                    <Icon className="h-4 w-4" />
                    <span>{item.label}</span>
                  </button>
                );
              })}
            </nav>
            <div className="p-4 border-t border-white/10 space-y-3">
              <button
                onClick={() => {
                  setDemoTourActive(!demoTourActive);
                  setMobileMenuOpen(false);
                }}
                className="w-full flex items-center justify-center gap-2 rounded-xl bg-[#087BFF] px-3.5 py-2.5 text-xs font-semibold text-white"
              >
                <Play className="h-3.5 w-3.5 fill-current" />
                <span>Modo demonstração</span>
              </button>
              <div className="flex items-center gap-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-white/10 text-xs font-bold">
                  MK
                </div>
                <div>
                  <p className="text-xs font-semibold text-white">Perfil</p>
                  <p className="text-[11px] text-slate-400">Administrador</p>
                </div>
              </div>
            </div>
          </aside>
        </div>
      )}

      {/* ÁREA DE CONTEÚDO PRINCIPAL */}
      <div className="flex-1 flex flex-col lg:pl-64 min-w-0">
        {/* TOP BAR (BUSCA GLOBAL + DEMONSTRAÇÃO + SINO DE NOTIFICAÇÕES) */}
        <header className="sticky top-0 z-20 h-16 bg-white/95 backdrop-blur-xs border-b border-slate-200 px-4 sm:px-8 flex items-center justify-between gap-4">
          {/* Left Zone: Mobile Menu + Global Search */}
          <div className="flex items-center gap-3 flex-1 max-w-xl" ref={searchRef}>
            <button
              onClick={() => setMobileMenuOpen(true)}
              className="lg:hidden p-2 rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-50"
              aria-label="Abrir menu"
            >
              <Menu className="h-5 w-5" />
            </button>

            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onFocus={() => setSearchFocused(true)}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setSearchFocused(true);
                }}
                placeholder="Buscar motos, clientes, contratos..."
                className="w-full rounded-xl border border-slate-200 bg-slate-50 pl-10 pr-4 py-2 text-xs sm:text-sm text-slate-900 placeholder:text-slate-400 focus:border-[#087BFF] focus:bg-white focus:outline-none transition-colors"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400 hover:text-slate-600"
                >
                  Limpar
                </button>
              )}

              {/* DROPDOWN DE RESULTADOS DA BUSCA GLOBAL */}
              {searchFocused && q.length > 0 && (
                <div className="absolute left-0 right-0 mt-2 rounded-xl border border-slate-200 bg-white shadow-xl overflow-hidden z-40 max-h-96 overflow-y-auto">
                  {!hasSearchResults ? (
                    <div className="p-4 text-xs text-slate-500 text-center">
                      Nenhum resultado encontrado para "{searchQuery}". Busque por modelo, placa,
                      nome, telefone, CPF ou número do contrato.
                    </div>
                  ) : (
                    <div className="divide-y divide-slate-100">
                      {matchedMotos.length > 0 && (
                        <div className="p-2">
                          <p className="px-2 py-1 text-[11px] font-semibold text-slate-400">
                            Motocicletas da Frota
                          </p>
                          {matchedMotos.map((m) => (
                            <button
                              key={m.id}
                              onClick={() => {
                                navigateToMoto(m.id);
                                setSearchFocused(false);
                              }}
                              className="w-full flex items-center justify-between px-2.5 py-2 rounded-lg hover:bg-slate-50 text-left text-xs"
                            >
                              <div>
                                <span className="font-bold text-slate-900">{m.modelo}</span>
                                <span className="text-slate-500 font-mono-tabular">
                                  {' '}
                                  · {m.placa} · {m.codigo}
                                </span>
                              </div>
                              <span className="font-mono-tabular text-[11px] font-semibold text-[#087BFF]">
                                {m.status}
                              </span>
                            </button>
                          ))}
                        </div>
                      )}

                      {matchedClientes.length > 0 && (
                        <div className="p-2">
                          <p className="px-2 py-1 text-[11px] font-semibold text-slate-400">
                            Clientes
                          </p>
                          {matchedClientes.map((c) => (
                            <button
                              key={c.id}
                              onClick={() => {
                                navigateToCliente(c.id);
                                setSearchFocused(false);
                              }}
                              className="w-full flex items-center justify-between px-2.5 py-2 rounded-lg hover:bg-slate-50 text-left text-xs"
                            >
                              <div>
                                <span className="font-bold text-slate-900">{c.nome}</span>
                                <span className="text-slate-500 font-mono-tabular">
                                  {' '}
                                  · {c.telefone}
                                </span>
                              </div>
                              <span className="text-[11px] text-slate-500">{c.status}</span>
                            </button>
                          ))}
                        </div>
                      )}

                      {matchedContratos.length > 0 && (
                        <div className="p-2">
                          <p className="px-2 py-1 text-[11px] font-semibold text-slate-400">
                            Contratos
                          </p>
                          {matchedContratos.map((ctr) => {
                            const cli = clientes.find((c) => c.id === ctr.clienteId);
                            return (
                              <button
                                key={ctr.id}
                                onClick={() => {
                                  navigateToContrato(ctr.id);
                                  setSearchFocused(false);
                                }}
                                className="w-full flex items-center justify-between px-2.5 py-2 rounded-lg hover:bg-slate-50 text-left text-xs"
                              >
                                <span className="font-bold text-slate-900 font-mono-tabular">
                                  {ctr.numero} — {cli?.nome}
                                </span>
                                <span className="text-[11px] text-[#087BFF]">{ctr.status}</span>
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Right Zone: Discreet DEMONSTRAÇÃO label + Notification Bell */}
          <div className="flex items-center gap-4">
            <span
              className={`hidden sm:inline-flex items-center gap-1.5 text-[11px] font-mono-tabular font-semibold tracking-wider select-none ${
                conexao === 'online' ? 'text-emerald-600' : 'text-[#E50914]'
              }`}
              title={conexao === 'online' ? 'Conectado ao servidor — dados atualizam sozinhos' : 'Sem conexão com o servidor'}
            >
              <span className={`h-2 w-2 rounded-full ${conexao === 'online' ? 'bg-emerald-500' : 'bg-[#E50914]'}`} />
              {conexao === 'online' ? 'ONLINE' : 'OFFLINE'}
              {config.modoDemonstracao && <span className="text-slate-400">· DEMONSTRAÇÃO</span>}
            </span>

            {/* SINO DE NOTIFICAÇÕES */}
            <div className="relative" ref={notifRef}>
              <button
                onClick={() => setNotifOpen(!notifOpen)}
                className="relative rounded-xl border border-slate-200 bg-white p-2.5 text-slate-700 hover:bg-slate-50 transition-colors"
                aria-label="Notificações do sistema"
              >
                <Bell className="h-4 w-4" />
                {alertas.length > 0 && (
                  <span className="absolute -top-1 -right-1 flex h-4 min-w-4 px-0.5 items-center justify-center rounded-full bg-[#E50914] text-[10px] font-bold text-white font-mono-tabular">
                    {alertas.length}
                  </span>
                )}
              </button>

              {notifOpen && (
                <div className="absolute right-0 mt-2 w-80 sm:w-96 rounded-2xl border border-slate-200 bg-white shadow-xl z-40 overflow-hidden">
                  <div className="flex items-center justify-between bg-[#0B0B0B] px-4 py-3 text-white">
                    <span className="text-xs font-bold">Notificações Operacionais</span>
                    <span className="text-[11px] text-slate-400 font-mono-tabular">{alertas.length} alertas</span>
                  </div>
                  <div className="divide-y divide-slate-100 max-h-[70vh] overflow-y-auto">
                    {alertas.map((a) => (
                      <button
                        key={a.id}
                        onClick={() => {
                          setActiveTab(a.destinoTab);
                          setNotifOpen(false);
                        }}
                        className="w-full p-4 text-left hover:bg-slate-50 transition-colors flex items-start justify-between gap-3"
                      >
                        <div>
                          <p className="text-xs font-bold text-slate-900">{a.titulo}</p>
                          <p className="mt-0.5 text-xs text-slate-500">{a.detalhe}</p>
                        </div>
                        <span
                          className={`text-[11px] font-semibold shrink-0 ${
                            a.severidade === 'alta' ? 'text-[#E50914]' : a.severidade === 'media' ? 'text-amber-600' : 'text-[#087BFF]'
                          }`}
                        >
                          {NAV_ITEMS.find((n) => n.id === a.destinoTab)?.label} →
                        </span>
                      </button>
                    ))}
                    {alertas.length === 0 && (
                      <p className="p-4 text-xs text-slate-500">Nenhum alerta no momento ✓</p>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* BARRA DE ROTEIRO GUIADO PARA APRESENTAÇÃO COMERCIAL (QUANDO ATIVO) */}
        {demoTourActive && (
          <div className="bg-[#0B0B0B] text-white border-b border-white/10 px-4 sm:px-8 py-3">
            <div className="max-w-7xl mx-auto flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-start sm:items-center gap-3">
                <span className="rounded-md bg-[#E50914] px-2 py-1 text-[11px] font-bold font-mono-tabular shrink-0">
                  PASSO {demoStep + 1}/{PRESENTATION_STEPS.length}
                </span>
                <div>
                  <p className="text-xs sm:text-sm font-bold text-white">
                    {PRESENTATION_STEPS[demoStep]?.title}
                  </p>
                  <p className="text-xs text-slate-300">
                    {PRESENTATION_STEPS[demoStep]?.description}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={() =>
                    triggerStep(
                      (demoStep - 1 + PRESENTATION_STEPS.length) % PRESENTATION_STEPS.length
                    )
                  }
                  className="flex items-center gap-1 rounded-lg border border-white/15 bg-white/5 px-3 py-1.5 text-xs font-semibold text-white hover:bg-white/10 transition-colors"
                >
                  <ChevronLeft className="h-3.5 w-3.5" />
                  Anterior
                </button>
                <button
                  onClick={() => triggerStep((demoStep + 1) % PRESENTATION_STEPS.length)}
                  className="flex items-center gap-1 rounded-lg bg-[#087BFF] px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-blue-600 transition-colors"
                >
                  Próximo Passo
                  <ChevronRight className="h-3.5 w-3.5" />
                </button>
                <button
                  onClick={() => setDemoTourActive(false)}
                  className="ml-1 rounded-lg p-1.5 text-slate-400 hover:text-white"
                  title="Fechar roteiro guiado"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>
        )}

        {/* VIEWPORT PRINCIPAL */}
        <main className="flex-1 p-4 sm:p-8 max-w-[1440px] w-full mx-auto">{children}</main>
      </div>

      {/* MODAIS CONECTADOS GLOBAIS */}
      <GlobalModals />

      {/* TOAST NOTIFICATIONS */}
      <div className="fixed bottom-5 right-5 z-50 flex flex-col gap-2 max-w-sm w-full pointer-events-none">
        {toasts.map((t) => (
          <div
            key={t.id}
            onClick={() => dismissToast(t.id)}
            className="pointer-events-auto flex items-start gap-3 rounded-xl border border-white/15 bg-[#0B0B0B] px-4 py-3 text-white shadow-xl cursor-pointer transition-all"
          >
            {t.erro ? (
              <AlertTriangle className="h-4 w-4 text-[#E50914] shrink-0 mt-0.5" />
            ) : (
              <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" />
            )}
            <div className="min-w-0 flex-1">
              <p className="text-xs font-bold text-white">{t.text}</p>
              {t.subtext && <p className="text-[11px] text-slate-300 mt-0.5">{t.subtext}</p>}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
