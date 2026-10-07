import React, { useState } from 'react';
import { FileText, CheckCircle2, ArrowUpRight } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { ContratoStatus } from '../types/mkMotos';

export const ContratosView: React.FC = () => {
  const {
    contratos,
    clientes,
    motos,
    setSelectedContratoId,
    navigateToCliente,
    navigateToMoto,
    assinarContrato,
  } = useApp();

  const [statusFilter, setStatusFilter] = useState<'Todos' | ContratoStatus>('Todos');

  const filtered = contratos.filter((c) =>
    statusFilter === 'Todos' ? true : c.status === statusFilter
  );

  return (
    <div className="space-y-6">
      {/* HEADER */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <p className="text-xs font-semibold text-[#E50914] tracking-wide">
            GESTÃO JURÍDICA E INSTRUMENTOS DE LOCAÇÃO
          </p>
          <h1 className="mt-1 text-2xl sm:text-3xl font-extrabold tracking-tight text-[#0B0B0B]">
            Contratos
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            Visualize minutas formais, status de assinatura, vigências e valores acordados.
          </p>
        </div>

        <div className="flex items-center gap-1 p-1 bg-slate-200/70 rounded-xl overflow-x-auto">
          {(
            ['Todos', 'Ativo', 'Aguardando assinatura', 'Finalizado', 'Vencido'] as Array<
              'Todos' | ContratoStatus
            >
          ).map((st) => (
            <button
              key={st}
              onClick={() => setStatusFilter(st)}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap ${
                statusFilter === st
                  ? 'bg-[#0B0B0B] text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {st}
            </button>
          ))}
        </div>
      </div>

      {/* TABELA DE CONTRATOS */}
      <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/80 text-[11px] font-semibold text-slate-500">
                <th className="py-3.5 px-5">Número</th>
                <th className="py-3.5 px-4">Cliente</th>
                <th className="py-3.5 px-4">Moto</th>
                <th className="py-3.5 px-4">Data / Vigência</th>
                <th className="py-3.5 px-4 text-right">Valor</th>
                <th className="py-3.5 px-4">Status</th>
                <th className="py-3.5 px-5 text-right">Ação</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs">
              {filtered.map((ctr) => {
                const cli = clientes.find((c) => c.id === ctr.clienteId);
                const moto = motos.find((m) => m.id === ctr.motoId);

                const statusClass =
                  ctr.status === 'Ativo'
                    ? 'text-emerald-600'
                    : ctr.status === 'Aguardando assinatura'
                    ? 'text-[#087BFF]'
                    : ctr.status === 'Vencido'
                    ? 'text-[#E50914]'
                    : 'text-slate-400';

                return (
                  <tr key={ctr.id} className="hover:bg-slate-50/90 transition-colors">
                    <td className="py-3.5 px-5 font-mono-tabular font-bold text-slate-900 whitespace-nowrap">
                      {ctr.numero}
                    </td>

                    <td className="py-3.5 px-4 whitespace-nowrap">
                      <button
                        onClick={() => cli && navigateToCliente(cli.id)}
                        className="font-bold text-slate-900 hover:text-[#087BFF] transition-colors"
                      >
                        {cli?.nome || 'Cliente'}
                      </button>
                    </td>

                    <td className="py-3.5 px-4 whitespace-nowrap">
                      {moto ? (
                        <button
                          onClick={() => navigateToMoto(moto.id)}
                          className="inline-flex items-center gap-1 font-medium text-slate-700 hover:text-[#087BFF]"
                        >
                          <span>{moto.modelo}</span>
                          <span className="font-mono-tabular text-slate-400">({moto.placa})</span>
                          <ArrowUpRight className="h-3 w-3 text-[#087BFF]" />
                        </button>
                      ) : (
                        '—'
                      )}
                    </td>

                    <td className="py-3.5 px-4 font-mono-tabular text-slate-600 whitespace-nowrap">
                      {ctr.dataEmissao} → {ctr.dataVencimento}
                    </td>

                    <td className="py-3.5 px-4 text-right font-mono-tabular font-bold text-slate-900 whitespace-nowrap">
                      R$ {ctr.valorMensal.toLocaleString('pt-BR')}
                    </td>

                    <td className="py-3.5 px-4 whitespace-nowrap">
                      <span className={`font-semibold ${statusClass}`}>{ctr.status}</span>
                    </td>

                    <td className="py-3.5 px-5 text-right whitespace-nowrap">
                      <div className="inline-flex items-center gap-2">
                        {ctr.status === 'Aguardando assinatura' && (
                          <button
                            onClick={() => assinarContrato(ctr.id)}
                            className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-emerald-500"
                          >
                            <CheckCircle2 className="h-3.5 w-3.5" />
                            Assinar
                          </button>
                        )}
                        <button
                          onClick={() => setSelectedContratoId(ctr.id)}
                          className="inline-flex items-center gap-1.5 rounded-lg bg-[#0B0B0B] px-3 py-1.5 text-xs font-semibold text-white hover:bg-slate-800 transition-colors"
                        >
                          <FileText className="h-3.5 w-3.5 text-[#087BFF]" />
                          Visualizar contrato
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
