import React, { useState } from 'react';
import { Plus, CheckCircle2, X, ArrowUpRight } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { RECEITA_SEMESTRAL } from '../data/mockData';

export const FinanceiroView: React.FC = () => {
  const {
    pagamentos,
    clientes,
    contratos,
    motos,
    navigateToCliente,
    navigateToContrato,
    registrarPagamento,
  } = useApp();

  const [modalOpen, setModalOpen] = useState(false);
  const [selectedClienteId, setSelectedClienteId] = useState(clientes[1]?.id || 'cli-2');
  const [valor, setValor] = useState(850);
  const [vencimento, setVencimento] = useState('04/10');
  const [forma, setForma] = useState<'PIX' | 'Boleto' | 'Cartão' | 'Transferência'>('PIX');

  const kpis = [
    { label: 'Receita do mês', value: 'R$ 28.450', sub: 'Outubro/2026', accent: 'blue' },
    { label: 'Receita prevista', value: 'R$ 32.650', sub: '100% da carteira ativa' },
    { label: 'Recebido', value: 'R$ 24.250', sub: 'Confirmado em conta (PIX/Boleto)' },
    { label: 'A receber', value: 'R$ 4.200', sub: 'Faturas dentro do prazo' },
    { label: 'Atrasado', value: 'R$ 900', sub: '1 condutor em cobrança', accent: 'red' },
    { label: 'Despesas', value: 'R$ 7.450', sub: 'Oficina, peças e seguro frota' },
  ];

  const handleSubmitPayment = (e: React.FormEvent) => {
    e.preventDefault();
    const cli = clientes.find((c) => c.id === selectedClienteId);
    const pendingPag = pagamentos.find(
      (p) => p.clienteId === selectedClienteId && p.status !== 'Pago'
    );
    registrarPagamento({
      pagamentoId: pendingPag?.id,
      clienteId: selectedClienteId,
      contratoId: cli?.contratoAtualId || 'ctr-1',
      motoId: cli?.motoAtualId || 'moto-1',
      valor: Number(valor),
      vencimento,
      formaPagamento: forma,
    });
    setModalOpen(false);
  };

  return (
    <div className="space-y-6">
      {/* HEADER */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <p className="text-xs font-semibold text-[#E50914] tracking-wide">
            FLUXO DE CAIXA E FATURAMENTO RECORRENTE
          </p>
          <h1 className="mt-1 text-2xl sm:text-3xl font-extrabold tracking-tight text-[#0B0B0B]">
            Financeiro
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            Controle de mensalidades recebidas, faturas pendentes, inadimplência e despesas da frota.
          </p>
        </div>

        <button
          onClick={() => setModalOpen(true)}
          className="flex items-center justify-center gap-2 rounded-xl bg-[#E50914] px-4 py-2.5 text-xs font-semibold text-white hover:bg-red-700 transition-colors whitespace-nowrap shadow-xs"
        >
          <Plus className="h-4 w-4" />
          Registrar pagamento
        </button>
      </div>

      {/* 6 INDICADORES FINANCEIROS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-4">
        {kpis.map((item, idx) => (
          <div
            key={idx}
            className="rounded-xl border border-slate-200 bg-white p-4 flex flex-col justify-between"
          >
            <span className="text-xs font-semibold text-slate-500">{item.label}</span>
            <p
              className={`mt-2 text-xl font-extrabold font-mono-tabular ${
                item.accent === 'red'
                  ? 'text-[#E50914]'
                  : item.accent === 'blue'
                  ? 'text-[#087BFF]'
                  : 'text-[#0B0B0B]'
              }`}
            >
              {item.value}
            </p>
            <span className="mt-1 text-[11px] text-slate-400">{item.sub}</span>
          </div>
        ))}
      </div>

      {/* GRÁFICO DE RECEITA MENSAL VS DESPESAS */}
      <div className="rounded-xl border border-slate-200 bg-white p-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-4">
          <div>
            <h2 className="text-base font-bold text-slate-900">
              Evolução de Receita Mensal vs. Despesas Operacionais
            </h2>
            <p className="text-xs text-slate-500">
              Margem líquida operacional de 73,8% em Outubro/2026
            </p>
          </div>
          <div className="flex items-center gap-4 text-xs font-medium">
            <span className="flex items-center gap-1.5 text-slate-700">
              <span className="h-2.5 w-2.5 rounded-xs bg-[#087BFF]" />
              Receita Mensal
            </span>
            <span className="flex items-center gap-1.5 text-slate-700">
              <span className="h-2.5 w-2.5 rounded-xs bg-[#0B0B0B]" />
              Despesas
            </span>
          </div>
        </div>

        <div className="mt-6 grid grid-cols-6 gap-4 items-end h-44 border-b border-slate-200 pb-2">
          {RECEITA_SEMESTRAL.map((m) => {
            const recPct = Math.round((m.receita / 30000) * 100);
            const despPct = Math.round((m.despesas / 30000) * 100);
            return (
              <div key={m.mes} className="flex flex-col items-center justify-end h-full">
                <span className="mb-1 text-[11px] font-mono-tabular font-bold text-slate-800">
                  R$ {(m.receita / 1000).toFixed(1)}k
                </span>
                <div className="w-full flex items-end justify-center gap-1.5 h-full">
                  <div
                    style={{ height: `${recPct}%` }}
                    className="w-5 sm:w-7 rounded-t-md bg-[#087BFF]"
                    title={`Receita ${m.mes}: R$ ${m.receita}`}
                  />
                  <div
                    style={{ height: `${despPct}%` }}
                    className="w-4 sm:w-5 rounded-t-md bg-[#0B0B0B]"
                    title={`Despesas ${m.mes}: R$ ${m.despesas}`}
                  />
                </div>
              </div>
            );
          })}
        </div>
        <div className="grid grid-cols-6 gap-4 pt-2 text-center">
          {RECEITA_SEMESTRAL.map((m) => (
            <span key={m.mes} className="text-xs font-mono-tabular font-semibold text-slate-500">
              {m.mes}/26
            </span>
          ))}
        </div>
      </div>

      {/* TABELA DE LANÇAMENTOS E PAGAMENTOS */}
      <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
          <h3 className="text-sm font-bold text-slate-900">
            Controle de Mensalidades por Cliente e Contrato
          </h3>
          <span className="text-xs text-slate-500 font-mono-tabular">
            Competência Atual: Outubro/2026
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/80 text-[11px] font-semibold text-slate-500">
                <th className="py-3.5 px-5">Cliente</th>
                <th className="py-3.5 px-4">Contrato / Moto</th>
                <th className="py-3.5 px-4 text-right">Valor</th>
                <th className="py-3.5 px-4">Vencimento</th>
                <th className="py-3.5 px-4">Método</th>
                <th className="py-3.5 px-4">Status</th>
                <th className="py-3.5 px-5 text-right">Ação</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs">
              {pagamentos.map((pag) => {
                const cli = clientes.find((c) => c.id === pag.clienteId);
                const ctr = contratos.find((c) => c.id === pag.contratoId);
                const moto = motos.find((m) => m.id === pag.motoId);

                const statusClass =
                  pag.status === 'Pago'
                    ? 'text-emerald-600'
                    : pag.status === 'Atrasado'
                    ? 'text-[#E50914]'
                    : 'text-amber-600';

                return (
                  <tr key={pag.id} className="hover:bg-slate-50/90 transition-colors">
                    <td className="py-3.5 px-5 whitespace-nowrap">
                      <button
                        onClick={() => cli && navigateToCliente(cli.id)}
                        className="font-bold text-slate-900 hover:text-[#087BFF] transition-colors"
                      >
                        {cli?.nome || 'Cliente'}
                      </button>
                    </td>

                    <td className="py-3.5 px-4 whitespace-nowrap">
                      {ctr ? (
                        <button
                          onClick={() => navigateToContrato(ctr.id)}
                          className="inline-flex items-center gap-1 font-mono-tabular font-semibold text-[#087BFF] hover:underline"
                        >
                          <span>{ctr.numero}</span>
                          {moto && (
                            <span className="text-slate-500 font-normal">
                              · {moto.modelo} ({moto.placa})
                            </span>
                          )}
                          <ArrowUpRight className="h-3 w-3" />
                        </button>
                      ) : (
                        '—'
                      )}
                    </td>

                    <td className="py-3.5 px-4 text-right font-mono-tabular font-bold text-slate-900 whitespace-nowrap">
                      R$ {pag.valor.toLocaleString('pt-BR')}
                    </td>

                    <td className="py-3.5 px-4 font-mono-tabular text-slate-700 whitespace-nowrap">
                      {pag.vencimento}
                    </td>

                    <td className="py-3.5 px-4 text-slate-600 whitespace-nowrap">
                      {pag.formaPagamento}
                    </td>

                    <td className="py-3.5 px-4 whitespace-nowrap">
                      <span className={`font-bold ${statusClass}`}>{pag.status}</span>
                    </td>

                    <td className="py-3.5 px-5 text-right whitespace-nowrap">
                      {pag.status !== 'Pago' ? (
                        <button
                          onClick={() =>
                            registrarPagamento({
                              pagamentoId: pag.id,
                              clienteId: pag.clienteId,
                              contratoId: pag.contratoId,
                              motoId: pag.motoId,
                              valor: pag.valor,
                              vencimento: pag.vencimento,
                              formaPagamento: 'PIX',
                            })
                          }
                          className="inline-flex items-center gap-1 rounded-lg bg-[#0B0B0B] px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-600 transition-colors"
                        >
                          <CheckCircle2 className="h-3.5 w-3.5" />
                          Confirmar Baixa
                        </button>
                      ) : (
                        <span className="text-[11px] font-mono-tabular text-slate-400">
                          Quitado ✓
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* MODAL: REGISTRAR PAGAMENTO */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between bg-[#0B0B0B] px-6 py-4 text-white">
              <h2 className="text-base font-bold">Registrar Pagamento de Locação</h2>
              <button
                onClick={() => setModalOpen(false)}
                className="text-slate-400 hover:text-white"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSubmitPayment} className="p-6 space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Cliente</label>
                <select
                  value={selectedClienteId}
                  onChange={(e) => {
                    const cli = clientes.find((c) => c.id === e.target.value);
                    setSelectedClienteId(e.target.value);
                    if (cli && cli.proximoPagamentoValor > 0) {
                      setValor(cli.proximoPagamentoValor);
                    }
                  }}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-slate-900"
                >
                  {clientes.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.nome} ({c.status})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Valor (R$)</label>
                  <input
                    type="number"
                    required
                    value={valor}
                    onChange={(e) => setValor(Number(e.target.value))}
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 font-mono-tabular font-bold text-slate-900"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Vencimento</label>
                  <input
                    type="text"
                    required
                    value={vencimento}
                    onChange={(e) => setVencimento(e.target.value)}
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 font-mono-tabular text-slate-900"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Forma de Recebimento
                </label>
                <select
                  value={forma}
                  onChange={(e) =>
                    setForma(
                      e.target.value as 'PIX' | 'Boleto' | 'Cartão' | 'Transferência'
                    )
                  }
                  className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-slate-900"
                >
                  <option value="PIX">PIX</option>
                  <option value="Boleto">Boleto</option>
                  <option value="Cartão">Cartão</option>
                  <option value="Transferência">Transferência</option>
                </select>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="rounded-lg border border-slate-200 px-4 py-2 font-semibold text-slate-700"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="rounded-lg bg-[#E50914] px-4 py-2 font-semibold text-white hover:bg-red-700"
                >
                  Confirmar Recebimento ✓
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
