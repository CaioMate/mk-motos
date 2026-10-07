import React, { useState } from 'react';
import { FileDown, FileSpreadsheet, BarChart3 } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { RECEITA_SEMESTRAL, ORIGEM_LEADS_STATS } from '../data/mockData';

const REPORT_TYPES = [
  {
    id: 'frota',
    title: 'Relatório de frota',
    subtitle: 'Ocupação de 80% (32/40 motos alugadas), depreciação e receita por placa.',
    metric: '80,0% Ocupação Média',
    highlight: 'Honda CG 160 representa 55% da demanda de locação.',
  },
  {
    id: 'financeiro',
    title: 'Relatório financeiro',
    subtitle: 'Receita bruta de R$ 28.450, despesas operacionais de R$ 7.450 e margem líquida.',
    metric: 'R$ 21.000 Lucro Operacional',
    highlight: 'Inadimplência controlada em apenas 3,1% da carteira.',
  },
  {
    id: 'clientes',
    title: 'Relatório de clientes',
    subtitle: '127 clientes ativos cadastrados, tempo médio de permanência de 7,4 meses.',
    metric: '127 Condutores Ativos',
    highlight: '94% dos pagamentos realizados via PIX até a data de vencimento.',
  },
  {
    id: 'alugueis',
    title: 'Relatório de aluguéis',
    subtitle: '32 locações ativas, renovações contratuais e ticket médio mensal de R$ 889.',
    metric: 'R$ 889 Ticket Médio',
    highlight: 'Planos mensais representam 84% dos contratos vigentes.',
  },
  {
    id: 'manutencao',
    title: 'Relatório de manutenção',
    subtitle: 'Custos de oficina por motocicleta, trocas preventivas de óleo, pneus e freios.',
    metric: 'R$ 186 Custo Médio / Moto',
    highlight: 'Manutenção preventiva reduziu quebras corretivas em 62%.',
  },
  {
    id: 'comercial',
    title: 'Relatório comercial',
    subtitle: 'Performance do funil Instagram → WhatsApp → Contrato e custo por aquisição.',
    metric: '29,1% Taxa de Conversão',
    highlight: 'Campanha "Alugue sua moto para trabalhar" gerou 24 leads e 7 locações.',
  },
];

export const RelatoriosView: React.FC = () => {
  const { showToast } = useApp();
  const [selectedReport, setSelectedReport] = useState('frota');

  const handleExport = (format: 'PDF' | 'Excel') => {
    showToast(
      'Função disponível na versão completa.',
      `Exportação de relatório gerencial em ${format} demonstrada com sucesso.`
    );
  };

  return (
    <div className="space-y-6">
      {/* HEADER */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <p className="text-xs font-semibold text-[#E50914] tracking-wide">
            INTELIGÊNCIA DE NEGÓCIOS E FECHAMENTO MENSAL
          </p>
          <h1 className="mt-1 text-2xl sm:text-3xl font-extrabold tracking-tight text-[#0B0B0B]">
            Relatórios
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            Análises consolidadas de frota, financeiro, clientes, aluguéis, manutenção e comercial.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={() => handleExport('PDF')}
            className="flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-xs font-semibold text-slate-800 hover:bg-slate-50 transition-colors whitespace-nowrap"
          >
            <FileDown className="h-4 w-4 text-[#E50914]" />
            Exportar PDF
          </button>
          <button
            onClick={() => handleExport('Excel')}
            className="flex items-center gap-2 rounded-xl bg-[#0B0B0B] px-4 py-2.5 text-xs font-semibold text-white hover:bg-slate-800 transition-colors whitespace-nowrap"
          >
            <FileSpreadsheet className="h-4 w-4 text-emerald-400" />
            Exportar Excel
          </button>
        </div>
      </div>

      {/* GRID DOS 6 RELATÓRIOS EXECUTIVOS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {REPORT_TYPES.map((rep) => {
          const isSelected = selectedReport === rep.id;
          return (
            <div
              key={rep.id}
              onClick={() => setSelectedReport(rep.id)}
              className={`cursor-pointer rounded-xl border p-5 transition-all flex flex-col justify-between ${
                isSelected
                  ? 'border-[#087BFF] bg-white shadow-sm'
                  : 'border-slate-200 bg-white hover:border-slate-300'
              }`}
            >
              <div>
                <div className="flex items-center justify-between">
                  <h2 className="text-base font-bold text-slate-900">{rep.title}</h2>
                  <BarChart3
                    className={`h-4 w-4 ${isSelected ? 'text-[#087BFF]' : 'text-slate-400'}`}
                  />
                </div>
                <p className="mt-1.5 text-xs text-slate-500 leading-relaxed">{rep.subtitle}</p>
              </div>

              <div className="mt-4 pt-3 border-t border-slate-100">
                <p className="text-sm font-extrabold font-mono-tabular text-[#0B0B0B]">
                  {rep.metric}
                </p>
                <p className="mt-0.5 text-[11px] text-slate-500">{rep.highlight}</p>
                <div className="mt-3 flex items-center gap-2">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleExport('PDF');
                    }}
                    className="text-[11px] font-semibold text-[#E50914] hover:underline"
                  >
                    Exportar PDF
                  </button>
                  <span className="text-slate-300">·</span>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleExport('Excel');
                    }}
                    className="text-[11px] font-semibold text-[#087BFF] hover:underline"
                  >
                    Exportar Excel
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* PAINEL GRÁFICO CONSOLIDADO */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-7 rounded-xl border border-slate-200 bg-white p-6">
          <div className="flex items-center justify-between border-b border-slate-100 pb-4">
            <div>
              <h3 className="text-base font-bold text-slate-900">
                Desempenho Financeiro & Crescimento da Frota Alugada
              </h3>
              <p className="text-xs text-slate-500">
                Comparativo semestral consolidado MK Motos
              </p>
            </div>
            <span className="font-mono-tabular text-xs font-bold text-[#087BFF]">
              R$ 146.050 Acumulado
            </span>
          </div>

          <div className="mt-6 grid grid-cols-6 gap-3 items-end h-44 border-b border-slate-200 pb-2">
            {RECEITA_SEMESTRAL.map((m) => {
              const pct = Math.round((m.receita / 30000) * 100);
              return (
                <div key={m.mes} className="flex flex-col items-center justify-end h-full">
                  <span className="mb-1 text-[11px] font-mono-tabular font-semibold text-slate-700">
                    {(m.receita / 1000).toFixed(1)}k
                  </span>
                  <div
                    style={{ height: `${pct}%` }}
                    className="w-full max-w-[36px] rounded-t-lg bg-[#0B0B0B] hover:bg-[#E50914] transition-colors"
                  />
                </div>
              );
            })}
          </div>
          <div className="grid grid-cols-6 gap-3 pt-2 text-center">
            {RECEITA_SEMESTRAL.map((m) => (
              <span key={m.mes} className="text-xs font-mono-tabular text-slate-500">
                {m.mes}
              </span>
            ))}
          </div>
        </div>

        <div className="lg:col-span-5 rounded-xl border border-slate-200 bg-white p-6">
          <div className="border-b border-slate-100 pb-4">
            <h3 className="text-base font-bold text-slate-900">
              Eficiência Comercial por Canal de Aquisição
            </h3>
            <p className="text-xs text-slate-500">
              Participação de cada origem nos novos contratos
            </p>
          </div>

          <div className="mt-5 space-y-3.5">
            {ORIGEM_LEADS_STATS.map((o) => (
              <div key={o.origem} className="space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-slate-800">{o.origem}</span>
                  <span className="font-mono-tabular text-slate-600">
                    {o.quantidade} leads · {o.percentual}%
                  </span>
                </div>
                <div className="h-2 w-full rounded-full bg-slate-100 overflow-hidden">
                  <div
                    style={{ width: `${o.percentual}%`, backgroundColor: o.cor }}
                    className="h-full rounded-full"
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
