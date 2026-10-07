import React, { useState } from 'react';
import { Plus, Wrench, X, ArrowUpRight } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { ManutencaoItem } from '../types/mkMotos';

export const ManutencaoView: React.FC = () => {
  const { motos, manutencoes, navigateToMoto, registrarManutencao } = useApp();

  const [modalOpen, setModalOpen] = useState(false);
  const [selectedMotoId, setSelectedMotoId] = useState(motos[0]?.id || 'moto-1');
  const [tipo, setTipo] = useState<ManutencaoItem['tipo']>('Troca de óleo');
  const [km, setKm] = useState(10000);
  const [custo, setCusto] = useState(140);
  const [oficina, setOficina] = useState('Oficina Central MK Motos');
  const [observacao, setObservacao] = useState(
    'Troca de óleo 10W30 + inspeção preventiva de freios e relação.'
  );
  const [colocarEmManutencao, setColocarEmManutencao] = useState(true);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    registrarManutencao({
      motoId: selectedMotoId,
      tipo,
      kmNaManutencao: Number(km),
      custo: Number(custo),
      oficina,
      observacao,
      colocarEmManutencao,
    });
    setModalOpen(false);
  };

  return (
    <div className="space-y-6">
      {/* HEADER */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <p className="text-xs font-semibold text-[#E50914] tracking-wide">
            ENGENHARIA PREVENTIVA E CONTROLE DE OFICINA
          </p>
          <h1 className="mt-1 text-2xl sm:text-3xl font-extrabold tracking-tight text-[#0B0B0B]">
            Manutenção da frota
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            Monitoramento por quilometragem, alertas de revisão preventiva e histórico de serviços.
          </p>
        </div>

        <button
          onClick={() => setModalOpen(true)}
          className="flex items-center justify-center gap-2 rounded-xl bg-[#E50914] px-4 py-2.5 text-xs font-semibold text-white hover:bg-red-700 transition-colors whitespace-nowrap shadow-xs"
        >
          <Plus className="h-4 w-4" />
          + Registrar manutenção
        </button>
      </div>

      {/* 4 INDICADORES DE MANUTENÇÃO */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <span className="text-xs font-semibold text-slate-500">Em dia</span>
          <p className="mt-2 text-2xl sm:text-3xl font-extrabold text-emerald-600 font-mono-tabular">
            34
          </p>
          <p className="mt-1 text-xs text-slate-500">Revisões preventivas dentro do ciclo</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <span className="text-xs font-semibold text-slate-500">Próximas revisões</span>
          <p className="mt-2 text-2xl sm:text-3xl font-extrabold text-[#087BFF] font-mono-tabular">
            2
          </p>
          <p className="mt-1 text-xs text-slate-500">Faltam menos de 400 km (ex: CG 160)</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <span className="text-xs font-semibold text-slate-500">Em manutenção</span>
          <p className="mt-2 text-2xl sm:text-3xl font-extrabold text-amber-600 font-mono-tabular">
            3
          </p>
          <p className="mt-1 text-xs text-slate-500">Na Oficina Central MK Motos hoje</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <span className="text-xs font-semibold text-slate-500">Manutenções atrasadas</span>
          <p className="mt-2 text-2xl sm:text-3xl font-extrabold text-[#E50914] font-mono-tabular">
            1
          </p>
          <p className="mt-1 text-xs text-slate-500">Convocação imediata do condutor</p>
        </div>
      </div>

      {/* TABELA DE MONITORAMENTO DE QUILOMETRAGEM POR MOTO */}
      <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
          <h2 className="text-sm font-bold text-slate-900">
            Status de Revisão por Motocicleta da Frota
          </h2>
          <span className="text-xs text-slate-500">Ciclo preventivo a cada 5.000 km</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/80 text-[11px] font-semibold text-slate-500">
                <th className="py-3.5 px-5">Moto</th>
                <th className="py-3.5 px-4 text-right">Quilometragem</th>
                <th className="py-3.5 px-4">Última manutenção</th>
                <th className="py-3.5 px-4 text-right">Próxima manutenção</th>
                <th className="py-3.5 px-5">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs">
              {motos.map((m) => {
                const diffKm = m.proximaRevisaoKm - m.kmAtual;
                const statusLabel =
                  m.status === 'MANUTENÇÃO'
                    ? 'Em manutenção na oficina'
                    : diffKm <= 0
                    ? `Revisão atrasada (${Math.abs(diffKm)} km)`
                    : diffKm <= 500
                    ? `Revisão em ${diffKm.toLocaleString('pt-BR')} km`
                    : `Em dia (faltam ${diffKm.toLocaleString('pt-BR')} km)`;

                const statusColor =
                  m.status === 'MANUTENÇÃO' || diffKm <= 0
                    ? 'text-[#E50914]'
                    : diffKm <= 500
                    ? 'text-amber-600'
                    : 'text-emerald-600';

                return (
                  <tr key={m.id} className="hover:bg-slate-50/90 transition-colors">
                    <td className="py-3.5 px-5 whitespace-nowrap">
                      <button
                        onClick={() => navigateToMoto(m.id)}
                        className="inline-flex items-center gap-1.5 font-bold text-slate-900 hover:text-[#087BFF]"
                      >
                        <span>{m.modelo}</span>
                        <span className="font-mono-tabular text-slate-400">({m.placa})</span>
                        <ArrowUpRight className="h-3.5 w-3.5 text-[#087BFF]" />
                      </button>
                    </td>

                    <td className="py-3.5 px-4 text-right font-mono-tabular font-bold text-slate-900 whitespace-nowrap">
                      {m.kmAtual.toLocaleString('pt-BR')} km
                    </td>

                    <td className="py-3.5 px-4 font-mono-tabular text-slate-600 whitespace-nowrap">
                      {m.ultimaManutencaoData} ({m.ultimaRevisaoKm.toLocaleString('pt-BR')} km)
                    </td>

                    <td className="py-3.5 px-4 text-right font-mono-tabular font-bold text-slate-900 whitespace-nowrap">
                      {m.proximaRevisaoKm.toLocaleString('pt-BR')} km
                    </td>

                    <td className="py-3.5 px-5 font-mono-tabular whitespace-nowrap">
                      <span className={`font-bold ${statusColor}`}>{statusLabel}</span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* HISTÓRICO DE SERVIÇOS REALIZADOS */}
      <div className="rounded-xl border border-slate-200 bg-white p-6">
        <div className="flex items-center justify-between border-b border-slate-100 pb-4">
          <div>
            <h3 className="text-base font-bold text-slate-900">
              Histórico de Ordens de Serviço (Troca de óleo, Pneu, Freio, Revisão, Preventiva)
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Rastreabilidade completa de peças e mão de obra por placa
            </p>
          </div>
          <Wrench className="h-4 w-4 text-slate-400" />
        </div>

        <div className="mt-3 divide-y divide-slate-100 text-xs">
          {manutencoes.map((item) => {
            const moto = motos.find((m) => m.id === item.motoId);
            return (
              <div
                key={item.id}
                className="py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-slate-900">{item.tipo}</span>
                    <span>·</span>
                    <button
                      onClick={() => moto && navigateToMoto(moto.id)}
                      className="font-semibold text-[#087BFF] hover:underline"
                    >
                      {moto?.modelo} ({moto?.placa})
                    </button>
                    <span>·</span>
                    <span className="font-mono-tabular text-slate-500">
                      {item.kmNaManutencao.toLocaleString('pt-BR')} km
                    </span>
                  </div>
                  <p className="text-slate-500 mt-0.5">
                    {item.observacao} — <strong>{item.oficina}</strong>
                  </p>
                </div>

                <div className="sm:text-right font-mono-tabular shrink-0">
                  <p className="font-bold text-slate-900">
                    R$ {item.custo.toLocaleString('pt-BR')}
                  </p>
                  <p className="text-[11px] text-slate-400">{item.data}</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* MODAL: + REGISTRAR MANUTENÇÃO */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-xs">
          <div className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between bg-[#0B0B0B] px-6 py-4 text-white">
              <h2 className="text-base font-bold">Registrar Ordem de Manutenção</h2>
              <button
                onClick={() => setModalOpen(false)}
                className="text-slate-400 hover:text-white"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Motocicleta</label>
                  <select
                    value={selectedMotoId}
                    onChange={(e) => {
                      setSelectedMotoId(e.target.value);
                      const m = motos.find((x) => x.id === e.target.value);
                      if (m) setKm(m.kmAtual);
                    }}
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-slate-900"
                  >
                    {motos.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.modelo} ({m.placa})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Tipo de Serviço
                  </label>
                  <select
                    value={tipo}
                    onChange={(e) => setTipo(e.target.value as ManutencaoItem['tipo'])}
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-slate-900"
                  >
                    <option value="Troca de óleo">Troca de óleo</option>
                    <option value="Pneu">Pneu</option>
                    <option value="Freio">Freio</option>
                    <option value="Revisão">Revisão</option>
                    <option value="Manutenção preventiva">Manutenção preventiva</option>
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Quilometragem (km)
                  </label>
                  <input
                    type="number"
                    required
                    value={km}
                    onChange={(e) => setKm(Number(e.target.value))}
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 font-mono-tabular"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Custo (R$)</label>
                  <input
                    type="number"
                    required
                    value={custo}
                    onChange={(e) => setCusto(Number(e.target.value))}
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 font-mono-tabular"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Observações</label>
                <input
                  type="text"
                  value={observacao}
                  onChange={(e) => setObservacao(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2"
                />
              </div>

              <label className="flex items-center gap-2.5 p-3 rounded-xl border border-slate-200 bg-slate-50 cursor-pointer">
                <input
                  type="checkbox"
                  checked={colocarEmManutencao}
                  onChange={(e) => setColocarEmManutencao(e.target.checked)}
                  className="h-4 w-4 accent-[#E50914]"
                />
                <span className="font-semibold text-slate-800">
                  Alterar status da motocicleta na Frota para MANUTENÇÃO
                </span>
              </label>

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
                  Salvar Manutenção ✓
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
