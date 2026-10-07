import React from 'react';
import {
  ArrowUpRight,
  AlertCircle,
  Play,
  Layers,
  ChevronRight,
  Lock,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { RECEITA_SEMESTRAL } from '../data/mockData';
import { NavTab } from '../types/mkMotos';

const PROXIMAS_EVOLUCOES = [
  {
    titulo: 'Automação de WhatsApp',
    desc: 'Envio automático de cobranças PIX, lembretes de vencimento e agendamento de revisão.',
  },
  {
    titulo: 'Integração com Instagram',
    desc: 'Captura automática de leads vindos de Direct e campanhas de tráfego pago direto no CRM.',
  },
  {
    titulo: 'Notificações automáticas',
    desc: 'Alertas preventivos por quilometragem e avisos de renovação contratual.',
  },
  {
    titulo: 'Assinatura digital',
    desc: 'Validação jurídica de contratos e termos de vistoria pelo celular do locatário.',
  },
  {
    titulo: 'Pagamentos online',
    desc: 'Baixa automática via PIX QR Code Dinâmico e recorrência no cartão.',
  },
  {
    titulo: 'Relatórios avançados',
    desc: 'Rentabilidade individual por placa (ROI por moto) e depreciação da frota.',
  },
  {
    titulo: 'Aplicativo',
    desc: 'App exclusivo do condutor MK Motos para informar quilometragem e acessar 2ª via.',
  },
  {
    titulo: 'Controle de documentos',
    desc: 'Alerta automático de vencimento de CNH dos condutores e licenciamento anual.',
  },
  {
    titulo: 'Integrações externas',
    desc: 'Conexão com rastreadores GPS, bloqueio remoto e consulta automática de multas.',
  },
];

export const DashboardView: React.FC = () => {
  const {
    setActiveTab,
    atividades,
    alertas,
    navigateToMoto,
    navigateToCliente,
    setDemoTourActive,
    setDemoStep,
  } = useApp();

  const kpiCards: Array<{
    label: string;
    value: string;
    detail: string;
    accent?: 'red' | 'blue' | 'dark';
    targetTab: NavTab;
  }> = [
    {
      label: 'MOTOS DA FROTA',
      value: '40',
      detail: '100% rastreadas · 2024/2025',
      accent: 'dark',
      targetTab: 'frota',
    },
    {
      label: 'MOTOS ALUGADAS',
      value: '32',
      detail: '80% de taxa de ocupação',
      accent: 'blue',
      targetTab: 'frota',
    },
    {
      label: 'DISPONÍVEIS',
      value: '5',
      detail: 'Prontas para retirada imediata',
      targetTab: 'frota',
    },
    {
      label: 'EM MANUTENÇÃO',
      value: '3',
      detail: 'Revisão preventiva na oficina',
      accent: 'red',
      targetTab: 'manutencao',
    },
    {
      label: 'CLIENTES ATIVOS',
      value: '127',
      detail: '+14 novos nos últimos 30 dias',
      targetTab: 'clientes',
    },
    {
      label: 'CONTRATOS ATIVOS',
      value: '32',
      detail: '1 aguardando assinatura',
      targetTab: 'contratos',
    },
    {
      label: 'RECEITA DO MÊS',
      value: 'R$ 28.450',
      detail: '+12,4% vs. mês anterior',
      accent: 'blue',
      targetTab: 'financeiro',
    },
    {
      label: 'A RECEBER',
      value: 'R$ 4.200',
      detail: '3 faturas vencem nos próximos dias',
      accent: 'red',
      targetTab: 'financeiro',
    },
  ];

  const maxReceita = 30000;

  return (
    <div className="space-y-8">
      {/* CABEÇALHO DO DASHBOARD */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 border-b border-slate-200 pb-6">
        <div>
          <p className="text-xs font-semibold text-[#E50914] tracking-wide">
            PAINEL EXECUTIVO · OPERAÇÃO EM TEMPO REAL
          </p>
          <h1 className="mt-1 text-2xl sm:text-3xl font-extrabold tracking-tight text-[#0B0B0B]">
            Bom dia, administrador 👋
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            Acompanhe a operação da MK Motos em tempo real.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => {
              setDemoTourActive(true);
              setDemoStep(0);
            }}
            className="flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-xs font-semibold text-slate-800 hover:bg-slate-50 transition-colors whitespace-nowrap"
          >
            <Play className="h-3.5 w-3.5 text-[#087BFF] fill-current" />
            Apresentação Guiada
          </button>
          <button
            onClick={() => setActiveTab('alugueis')}
            className="flex items-center gap-2 rounded-xl bg-[#E50914] px-4 py-2.5 text-xs font-semibold text-white hover:bg-red-700 transition-colors whitespace-nowrap shadow-xs"
          >
            + Novo Aluguel
          </button>
        </div>
      </div>

      {/* GRID DE 8 INDICADORES PRINCIPAIS (KPIs) */}
      <section aria-label="Indicadores principais">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {kpiCards.map((card, idx) => (
            <button
              key={idx}
              onClick={() => setActiveTab(card.targetTab)}
              className="group text-left rounded-xl border border-slate-200 bg-white p-5 hover:border-slate-300 hover:shadow-sm transition-all flex flex-col justify-between"
            >
              <div className="flex items-center justify-between w-full">
                <span className="text-xs font-semibold text-slate-500 tracking-wide">
                  {card.label}
                </span>
                <ArrowUpRight className="h-4 w-4 text-slate-300 group-hover:text-[#087BFF] transition-colors" />
              </div>

              <div className="mt-3">
                <p
                  className={`text-2xl sm:text-3xl font-extrabold font-mono-tabular tracking-tight ${
                    card.accent === 'red'
                      ? 'text-[#E50914]'
                      : card.accent === 'blue'
                      ? 'text-[#087BFF]'
                      : 'text-[#0B0B0B]'
                  }`}
                >
                  {card.value}
                </p>
                <p className="mt-1.5 text-xs text-slate-500">{card.detail}</p>
              </div>
            </button>
          ))}
        </div>
      </section>

      {/* SEÇÃO DE 3 GRÁFICOS: RECEITA 6 MESES + MOTOS ALUGADAS POR MÊS + DISTRIBUIÇÃO DA FROTA */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* 1. Receita dos últimos 6 meses */}
        <div className="lg:col-span-5 rounded-xl border border-slate-200 bg-white p-6 flex flex-col justify-between">
          <div className="flex items-start justify-between gap-2">
            <div>
              <h2 className="text-base font-bold text-slate-900">
                Receita dos últimos 6 meses
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Crescimento recorrente de locações (Mai – Out)
              </p>
            </div>
            <span className="font-mono-tabular text-xs font-bold text-emerald-600">
              +43,6% no semestre
            </span>
          </div>

          <div className="mt-6 pt-2">
            <div className="grid grid-cols-6 gap-3 items-end h-44 border-b border-slate-200 pb-2">
              {RECEITA_SEMESTRAL.map((item, i) => {
                const heightPct = Math.round((item.receita / maxReceita) * 100);
                const isCurrent = i === RECEITA_SEMESTRAL.length - 1;
                return (
                  <div
                    key={item.mes}
                    className="flex flex-col items-center justify-end h-full group"
                  >
                    <span className="mb-1.5 text-[10px] font-mono-tabular font-semibold text-slate-600">
                      {(item.receita / 1000).toFixed(1)}k
                    </span>
                    <div
                      style={{ height: `${heightPct}%` }}
                      className={`w-full max-w-[38px] rounded-t-lg transition-all ${
                        isCurrent
                          ? 'bg-[#E50914]'
                          : 'bg-[#0B0B0B] group-hover:bg-[#087BFF]'
                      }`}
                    />
                  </div>
                );
              })}
            </div>
            <div className="grid grid-cols-6 gap-3 pt-2 text-center">
              {RECEITA_SEMESTRAL.map((item) => (
                <span
                  key={item.mes}
                  className="text-xs font-medium text-slate-500 font-mono-tabular"
                >
                  {item.mes}
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* 2. Quantidade de motos alugadas por mês */}
        <div className="lg:col-span-4 rounded-xl border border-slate-200 bg-white p-6 flex flex-col justify-between">
          <div className="flex items-start justify-between gap-2">
            <div>
              <h2 className="text-base font-bold text-slate-900">
                Motos alugadas por mês
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Evolução de unidades ativas na rua
              </p>
            </div>
            <span className="font-mono-tabular text-xs font-bold text-[#087BFF]">
              32 / 40 motos
            </span>
          </div>

          <div className="mt-6 pt-2">
            <div className="grid grid-cols-6 gap-2.5 items-end h-44 border-b border-slate-200 pb-2">
              {RECEITA_SEMESTRAL.map((item, i) => {
                const heightPct = Math.round((item.motosAlugadas / 40) * 100);
                const isLast = i === RECEITA_SEMESTRAL.length - 1;
                return (
                  <div
                    key={item.mes}
                    className="flex flex-col items-center justify-end h-full"
                  >
                    <span className="mb-1.5 text-[11px] font-mono-tabular font-bold text-slate-800">
                      {item.motosAlugadas}
                    </span>
                    <div
                      style={{ height: `${heightPct}%` }}
                      className={`w-full max-w-[32px] rounded-t-lg transition-all ${
                        isLast ? 'bg-[#087BFF]' : 'bg-slate-200 hover:bg-slate-300'
                      }`}
                    />
                  </div>
                );
              })}
            </div>
            <div className="grid grid-cols-6 gap-2.5 pt-2 text-center">
              {RECEITA_SEMESTRAL.map((item) => (
                <span
                  key={item.mes}
                  className="text-xs font-medium text-slate-500 font-mono-tabular"
                >
                  {item.mes}
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* 3. Distribuição da frota */}
        <div className="lg:col-span-3 rounded-xl border border-slate-200 bg-white p-6 flex flex-col justify-between">
          <div>
            <h2 className="text-base font-bold text-slate-900">Distribuição da frota</h2>
            <p className="text-xs text-slate-500 mt-0.5">Status das 40 motocicletas</p>
          </div>

          {/* Visual Donut SVG + Legend */}
          <div className="my-4 flex items-center justify-center">
            <div className="relative h-36 w-36 flex items-center justify-center">
              <svg viewBox="0 0 36 36" className="h-full w-full -rotate-90">
                <circle
                  cx="18"
                  cy="18"
                  r="15.915"
                  fill="transparent"
                  stroke="#E2E8F0"
                  strokeWidth="3.8"
                />
                {/* Alugadas: 80% */}
                <circle
                  cx="18"
                  cy="18"
                  r="15.915"
                  fill="transparent"
                  stroke="#087BFF"
                  strokeWidth="3.8"
                  strokeDasharray="80 20"
                  strokeDashoffset="0"
                />
                {/* Disponíveis: 12.5% */}
                <circle
                  cx="18"
                  cy="18"
                  r="15.915"
                  fill="transparent"
                  stroke="#0B0B0B"
                  strokeWidth="3.8"
                  strokeDasharray="12.5 87.5"
                  strokeDashoffset="-80"
                />
                {/* Manutenção: 7.5% */}
                <circle
                  cx="18"
                  cy="18"
                  r="15.915"
                  fill="transparent"
                  stroke="#E50914"
                  strokeWidth="3.8"
                  strokeDasharray="7.5 92.5"
                  strokeDashoffset="-92.5"
                />
              </svg>
              <div className="absolute text-center">
                <span className="block text-2xl font-extrabold text-slate-900 font-mono-tabular">
                  40
                </span>
                <span className="text-[11px] text-slate-500">Motos</span>
              </div>
            </div>
          </div>

          <div className="space-y-2 text-xs border-t border-slate-100 pt-3">
            <div className="flex items-center justify-between">
              <span className="text-slate-700 font-medium">Alugadas (Ativas)</span>
              <span className="font-mono-tabular font-bold text-[#087BFF]">32 (80%)</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-700 font-medium">Disponíveis no Pátio</span>
              <span className="font-mono-tabular font-bold text-[#0B0B0B]">5 (12,5%)</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-700 font-medium">Em Manutenção</span>
              <span className="font-mono-tabular font-bold text-[#E50914]">3 (7,5%)</span>
            </div>
          </div>
        </div>
      </section>

      {/* SEÇÃO DUPLA: ATIVIDADES RECENTES + ALERTAS IMPORTANTES */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Atividades recentes */}
        <div className="lg:col-span-7 rounded-xl border border-slate-200 bg-white p-6">
          <div className="flex items-center justify-between border-b border-slate-100 pb-4">
            <div>
              <h2 className="text-base font-bold text-slate-900">Atividades recentes</h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Últimas movimentações operacionais da MK Motos
              </p>
            </div>
            <button
              onClick={() => setActiveTab('alugueis')}
              className="text-xs font-semibold text-[#087BFF] hover:underline"
            >
              Ver todas →
            </button>
          </div>

          <div className="mt-2 divide-y divide-slate-100">
            {atividades.slice(0, 5).map((ativ) => (
              <div
                key={ativ.id}
                onClick={() => {
                  if (ativ.referenciaId?.startsWith('moto-')) {
                    navigateToMoto(ativ.referenciaId);
                  } else if (ativ.referenciaId?.startsWith('cli-')) {
                    navigateToCliente(ativ.referenciaId);
                  }
                }}
                className="py-3.5 flex items-center justify-between gap-4 hover:bg-slate-50/80 px-2 rounded-lg cursor-pointer transition-colors"
              >
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-slate-900 truncate">{ativ.titulo}</p>
                  <p className="text-xs text-slate-500 truncate mt-0.5">{ativ.subtitulo}</p>
                </div>
                <span className="text-xs text-slate-400 font-mono-tabular shrink-0">
                  {ativ.horario}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Alertas importantes */}
        <div className="lg:col-span-5 rounded-xl border border-slate-200 bg-white p-6 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div>
                <h2 className="text-base font-bold text-slate-900">Alertas importantes</h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Ações prioritárias que exigem atenção hoje
                </p>
              </div>
              <AlertCircle className="h-4 w-4 text-[#E50914]" />
            </div>

            <div className="mt-4 space-y-3">
              {alertas.map((alerta) => (
                <button
                  key={alerta.id}
                  onClick={() => setActiveTab(alerta.destinoTab)}
                  className="w-full text-left rounded-xl border border-slate-200 p-4 hover:border-slate-300 hover:bg-slate-50 transition-all flex items-center justify-between gap-3"
                >
                  <div>
                    <p
                      className={`text-sm font-bold ${
                        alerta.severidade === 'alta'
                          ? 'text-[#E50914]'
                          : alerta.severidade === 'media'
                          ? 'text-amber-600'
                          : 'text-[#087BFF]'
                      }`}
                    >
                      {alerta.titulo}
                    </p>
                    <p className="mt-0.5 text-xs text-slate-600">{alerta.detalhe}</p>
                  </div>
                  <ChevronRight className="h-4 w-4 text-slate-400 shrink-0" />
                </button>
              ))}
            </div>
          </div>

          <div className="mt-4 pt-4 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
            <span>Clique em qualquer alerta para resolver</span>
            <button
              onClick={() => navigateToMoto('moto-1')}
              className="font-semibold text-[#0B0B0B] hover:text-[#E50914] transition-colors"
            >
              Inspecionar CG 160 (João Silva) →
            </button>
          </div>
        </div>
      </section>

      {/* SEÇÃO 21: DEMONSTRAÇÃO COMERCIAL — MK MOTOS CENTRAL DE OPERAÇÕES & PRÓXIMAS EVOLUÇÕES */}
      <section className="rounded-2xl bg-[#0B0B0B] text-white p-6 sm:p-8 border border-white/10">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-white/10 pb-6">
          <div>
            <div className="flex items-center gap-2 text-xs font-mono-tabular font-semibold text-[#E50914]">
              <Layers className="h-3.5 w-3.5" />
              <span>ARQUITETURA DE EXPANSÃO DO ECOSSISTEMA</span>
            </div>
            <h2 className="mt-1 text-xl sm:text-2xl font-extrabold tracking-tight text-white">
              MK MOTOS — CENTRAL DE OPERAÇÕES
            </h2>
            <p className="mt-1 text-sm text-slate-300">
              Frota, clientes, contratos, financeiro e comercial em um único lugar.
            </p>
          </div>

          <div className="text-left md:text-right">
            <span className="inline-block text-xs font-mono-tabular font-bold tracking-wider text-[#087BFF]">
              PRÓXIMAS EVOLUÇÕES (FASE 2 & 3)
            </span>
            <p className="text-xs text-slate-400 mt-0.5">
              Módulos planejados para expansão futura da plataforma
            </p>
          </div>
        </div>

        <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {PROXIMAS_EVOLUCOES.map((evo, i) => (
            <div
              key={i}
              className="rounded-xl border border-white/10 bg-white/[0.03] p-4 flex flex-col justify-between hover:border-white/20 transition-colors"
            >
              <div>
                <div className="flex items-center justify-between gap-2">
                  <h3 className="text-sm font-bold text-white">{evo.titulo}</h3>
                  <Lock className="h-3.5 w-3.5 text-slate-500 shrink-0" />
                </div>
                <p className="mt-1.5 text-xs text-slate-400 leading-relaxed">{evo.desc}</p>
              </div>
              <div className="mt-3 pt-2 border-t border-white/5 flex items-center justify-between text-[11px] font-mono-tabular text-slate-400">
                <span>Status: Planejado</span>
                <span className="text-[#087BFF]">PRÓXIMAS EVOLUÇÕES</span>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
};
