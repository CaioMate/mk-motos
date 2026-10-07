import React from 'react';
import { ArrowUpRight, AlertCircle, ChevronRight, Satellite } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { NavTab } from '../types/mkMotos';
import { resumoFinanceiro, resumoFrota, serieMensal } from '../lib/indicadores';
import { brlCurto, pct } from '../lib/formato';
import { tempoRelativo } from '../lib/datas';

export const DashboardView: React.FC = () => {
  const {
    setActiveTab,
    atividades,
    alertas,
    motos,
    clientes,
    contratos,
    estado,
    navigateToMoto,
    navigateToCliente,
  } = useApp();

  const frota = resumoFrota(motos);
  const fin = resumoFinanceiro(estado);
  const serie = serieMensal(estado, 6);
  const clientesAtivos = clientes.filter((c) => c.contratoAtualId).length;
  const contratosAtivos = contratos.filter((c) => c.status === 'Ativo').length;
  const aguardando = contratos.filter((c) => c.status === 'Aguardando assinatura').length;
  const trintaDias = Date.now() - 30 * 86_400_000;
  const novosClientes = clientes.filter((c) => {
    const [d, m, a] = c.dataCadastro.split('/').map(Number);
    return new Date(a, m - 1, d).getTime() >= trintaDias;
  }).length;

  const atual = serie[serie.length - 1];
  const anterior = serie[serie.length - 2];
  const variacao = anterior?.receita ? ((atual.receita - anterior.receita) / anterior.receita) * 100 : 0;
  const maxReceita = Math.max(...serie.map((s) => s.receita), 1);
  const maxAlugadas = Math.max(...serie.map((s) => s.motosAlugadas), frota.total, 1);

  const kpiCards: Array<{
    label: string;
    value: string;
    detail: string;
    accent?: 'red' | 'blue' | 'dark';
    targetTab: NavTab;
    dica: string;
  }> = [
    {
      label: 'MOTOS DA FROTA',
      value: String(frota.total),
      detail: `${frota.comGps} com rastreador GPS`,
      accent: 'dark',
      targetTab: 'frota',
      dica: 'Quantas motos você tem cadastradas no total. Clique para ver a frota.',
    },
    {
      label: 'MOTOS ALUGADAS',
      value: String(frota.alugadas),
      detail: `${pct(frota.ocupacao)} de taxa de ocupação`,
      accent: 'blue',
      targetTab: 'frota',
      dica: 'Motos que estão com clientes agora. Ocupação = quanto da frota está gerando dinheiro.',
    },
    {
      label: 'DISPONÍVEIS',
      value: String(frota.disponiveis),
      detail: 'Prontas para retirada imediata',
      targetTab: 'frota',
      dica: 'Motos paradas, prontas para alugar hoje.',
    },
    {
      label: 'EM MANUTENÇÃO',
      value: String(frota.manutencao),
      detail: 'Na oficina neste momento',
      accent: 'red',
      targetTab: 'manutencao',
      dica: 'Motos na oficina, que não podem ser alugadas agora. Clique para ver as manutenções.',
    },
    {
      label: 'CLIENTES COM MOTO',
      value: String(clientesAtivos),
      detail: `${clientes.length} cadastrados · +${novosClientes} nos últimos 30 dias`,
      targetTab: 'clientes',
      dica: 'Clientes que estão com uma moto alugada neste momento.',
    },
    {
      label: 'CONTRATOS ATIVOS',
      value: String(contratosAtivos),
      detail: aguardando ? `${aguardando} aguardando assinatura` : 'Nenhum pendente de assinatura',
      targetTab: 'alugueis',
      dica: 'Contratos em vigor. Os que aguardam assinatura precisam ser assinados em Aluguéis e Contratos.',
    },
    {
      label: 'RECEBIDO NO MÊS',
      value: brlCurto(fin.recebidoMes),
      detail: anterior?.receita ? `${variacao >= 0 ? '+' : ''}${pct(variacao)} vs. mês anterior` : 'Pagamentos confirmados',
      accent: 'blue',
      targetTab: 'financeiro',
      dica: 'Dinheiro que já entrou este mês (pagamentos confirmados).',
    },
    {
      label: 'A RECEBER / ATRASADO',
      value: brlCurto(fin.aReceber + fin.atrasado),
      detail: fin.atrasado ? `${brlCurto(fin.atrasado)} em atraso` : 'Nenhuma cobrança atrasada',
      accent: 'red',
      targetTab: 'financeiro',
      dica: 'Cobranças que ainda não foram pagas, incluindo as atrasadas. Clique para cobrar.',
    },
  ];

  const pAlug = frota.total ? (frota.alugadas / frota.total) * 100 : 0;
  const pDisp = frota.total ? (frota.disponiveis / frota.total) * 100 : 0;
  const pMan = frota.total ? (frota.manutencao / frota.total) * 100 : 0;

  return (
    <div className="space-y-8">
      {/* CABEÇALHO DO DASHBOARD */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 border-b border-slate-200 pb-6">
        <div>
          <p className="text-xs font-semibold text-[#E50914] tracking-wide">
            PAINEL EXECUTIVO · OPERAÇÃO EM TEMPO REAL
          </p>
          <h1 className="mt-1 text-2xl sm:text-3xl font-extrabold tracking-tight text-[#0B0B0B]">
            {new Date().getHours() < 12 ? 'Bom dia' : new Date().getHours() < 18 ? 'Boa tarde' : 'Boa noite'}, administrador 👋
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            Acompanhe a operação da MK Motos em tempo real.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setActiveTab('alugueis')}
            data-dica="Abre a tela de Aluguéis e Contratos para alugar uma moto em poucos passos."
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
              data-dica={card.dica}
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
                Pagamentos confirmados ({serie[0].rotulo} – {atual.rotulo})
              </p>
            </div>
            <span className="font-mono-tabular text-xs font-bold text-emerald-600">
              {brlCurto(serie.reduce((s, m) => s + m.receita, 0))} no período
            </span>
          </div>

          <div className="mt-6 pt-2">
            <div className="grid grid-cols-6 gap-3 items-end h-44 border-b border-slate-200 pb-2">
              {serie.map((item, i) => {
                const heightPct = Math.round((item.receita / maxReceita) * 100);
                const isCurrent = i === serie.length - 1;
                return (
                  <div
                    key={`${item.mes}-${item.ano}`}
                    className="flex flex-col items-center justify-end h-full group"
                    title={`${item.rotulo}/${item.ano}: ${brlCurto(item.receita)}`}
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
              {serie.map((item) => (
                <span
                  key={`${item.mes}-${item.ano}`}
                  className="text-xs font-medium text-slate-500 font-mono-tabular"
                >
                  {item.rotulo}
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
                Locações ativas em cada mês
              </p>
            </div>
            <span className="font-mono-tabular text-xs font-bold text-[#087BFF]">
              {frota.alugadas} / {frota.total} motos
            </span>
          </div>

          <div className="mt-6 pt-2">
            <div className="grid grid-cols-6 gap-2.5 items-end h-44 border-b border-slate-200 pb-2">
              {serie.map((item, i) => {
                const heightPct = Math.round((item.motosAlugadas / maxAlugadas) * 100);
                const isLast = i === serie.length - 1;
                return (
                  <div
                    key={`${item.mes}-${item.ano}`}
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
              {serie.map((item) => (
                <span
                  key={`${item.mes}-${item.ano}`}
                  className="text-xs font-medium text-slate-500 font-mono-tabular"
                >
                  {item.rotulo}
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* 3. Distribuição da frota */}
        <div className="lg:col-span-3 rounded-xl border border-slate-200 bg-white p-6 flex flex-col justify-between">
          <div>
            <h2 className="text-base font-bold text-slate-900">Distribuição da frota</h2>
            <p className="text-xs text-slate-500 mt-0.5">Status das {frota.total} motocicletas</p>
          </div>

          <div className="my-4 flex items-center justify-center">
            <div className="relative h-36 w-36 flex items-center justify-center">
              <svg viewBox="0 0 36 36" className="h-full w-full -rotate-90">
                <circle cx="18" cy="18" r="15.915" fill="transparent" stroke="#E2E8F0" strokeWidth="3.8" />
                <circle
                  cx="18" cy="18" r="15.915" fill="transparent" stroke="#087BFF" strokeWidth="3.8"
                  strokeDasharray={`${pAlug} ${100 - pAlug}`}
                  strokeDashoffset="0"
                />
                <circle
                  cx="18" cy="18" r="15.915" fill="transparent" stroke="#0B0B0B" strokeWidth="3.8"
                  strokeDasharray={`${pDisp} ${100 - pDisp}`}
                  strokeDashoffset={-pAlug}
                />
                <circle
                  cx="18" cy="18" r="15.915" fill="transparent" stroke="#E50914" strokeWidth="3.8"
                  strokeDasharray={`${pMan} ${100 - pMan}`}
                  strokeDashoffset={-(pAlug + pDisp)}
                />
              </svg>
              <div className="absolute text-center">
                <span className="block text-2xl font-extrabold text-slate-900 font-mono-tabular">
                  {frota.total}
                </span>
                <span className="text-[11px] text-slate-500">Motos</span>
              </div>
            </div>
          </div>

          <div className="space-y-2 text-xs border-t border-slate-100 pt-3">
            <div className="flex items-center justify-between">
              <span className="text-slate-700 font-medium">Alugadas (Ativas)</span>
              <span className="font-mono-tabular font-bold text-[#087BFF]">{frota.alugadas} ({pct(pAlug)})</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-700 font-medium">Disponíveis no Pátio</span>
              <span className="font-mono-tabular font-bold text-[#0B0B0B]">{frota.disponiveis} ({pct(pDisp)})</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-700 font-medium">Em Manutenção</span>
              <span className="font-mono-tabular font-bold text-[#E50914]">{frota.manutencao} ({pct(pMan)})</span>
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
                Movimentações e automações do sistema (GPS, cobranças, manutenção)
              </p>
            </div>
          </div>

          <div className="mt-2 divide-y divide-slate-100 max-h-[420px] overflow-y-auto">
            {atividades.slice(0, 12).map((ativ) => (
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
                <div className="min-w-0 flex items-start gap-2">
                  {ativ.tipo === 'gps' && <Satellite className="h-4 w-4 text-[#087BFF] shrink-0 mt-0.5" />}
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-slate-900 truncate">{ativ.titulo}</p>
                    <p className="text-xs text-slate-500 truncate mt-0.5">{ativ.subtitulo}</p>
                  </div>
                </div>
                <span className="text-xs text-slate-400 font-mono-tabular shrink-0">
                  {ativ.criadoEm ? tempoRelativo(ativ.criadoEm) : ativ.horario}
                </span>
              </div>
            ))}
            {atividades.length === 0 && (
              <p className="py-6 text-center text-xs text-slate-500">Nenhuma atividade registrada ainda.</p>
            )}
          </div>
        </div>

        {/* Alertas importantes */}
        <div className="lg:col-span-5 rounded-xl border border-slate-200 bg-white p-6 flex flex-col">
          <div className="flex items-center justify-between border-b border-slate-100 pb-4">
            <div>
              <h2 className="text-base font-bold text-slate-900">Alertas importantes</h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Gerados automaticamente a partir dos dados
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
            {alertas.length === 0 && (
              <p className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-xs font-semibold text-emerald-800">
                Tudo em dia — nenhum alerta no momento ✓
              </p>
            )}
          </div>
        </div>
      </section>
    </div>
  );
};
