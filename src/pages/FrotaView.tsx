import React, { useState } from 'react';
import {
  Search,
  Plus,
  Eye,
  Edit3,
  RefreshCw,
  X,
  User,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { Moto, MotoStatus } from '../types/mkMotos';

type FrotaFilter = 'Todas' | 'Disponíveis' | 'Alugadas' | 'Manutenção' | 'Atrasadas';

export const FrotaView: React.FC = () => {
  const {
    motos,
    clientes,
    setSelectedMotoId,
    navigateToCliente,
    updateMotoStatus,
    addMoto,
    updateMotoDetails,
  } = useApp();

  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<FrotaFilter>('Todas');
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [editingMoto, setEditingMoto] = useState<Moto | null>(null);

  // Form states for "+ Adicionar moto"
  const [novoModelo, setNovoModelo] = useState('Honda CG 160 Titan');
  const [novaMarca, setNovaMarca] = useState<'Honda' | 'Yamaha'>('Honda');
  const [novoAno, setNovoAno] = useState(2025);
  const [novaPlaca, setNovaPlaca] = useState('MKT-2026');
  const [novaCor, setNovaCor] = useState('Vermelho Racing');
  const [novoKm, setNovoKm] = useState(0);
  const [novoValorMensal, setNovoValorMensal] = useState(850);

  const filteredMotos = motos.filter((m) => {
    const matchesSearch =
      m.modelo.toLowerCase().includes(search.toLowerCase()) ||
      m.placa.toLowerCase().includes(search.toLowerCase()) ||
      m.codigo.toLowerCase().includes(search.toLowerCase());

    if (!matchesSearch) return false;
    if (filter === 'Todas') return true;
    if (filter === 'Disponíveis') return m.status === 'DISPONÍVEL';
    if (filter === 'Alugadas') return m.status === 'ALUGADA';
    if (filter === 'Manutenção') return m.status === 'MANUTENÇÃO';
    if (filter === 'Atrasadas') return m.status === 'ATRASADA';
    return true;
  });

  const cycleStatus = (moto: Moto) => {
    const order: MotoStatus[] = ['DISPONÍVEL', 'ALUGADA', 'MANUTENÇÃO', 'ATRASADA'];
    const next = order[(order.indexOf(moto.status) + 1) % order.length];
    updateMotoStatus(moto.id, next);
  };

  const handleCreateMoto = (e: React.FormEvent) => {
    e.preventDefault();
    addMoto({
      modelo: novoModelo,
      marca: novaMarca,
      ano: Number(novoAno),
      placa: novaPlaca.toUpperCase(),
      cor: novaCor,
      chassi: `9C2KC${Math.floor(100000000 + Math.random() * 900000000)}`,
      kmAtual: Number(novoKm),
      ultimaRevisaoKm: Number(novoKm),
      proximaRevisaoKm: Number(novoKm) + 5000,
      ultimaManutencaoData: '29/09/2026',
      valorSemanal: Math.round(Number(novoValorMensal) / 3.5),
      valorMensal: Number(novoValorMensal),
      status: 'DISPONÍVEL',
    });
    setAddModalOpen(false);
  };

  const handleSaveEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingMoto) return;
    updateMotoDetails(editingMoto.id, {
      modelo: editingMoto.modelo,
      placa: editingMoto.placa,
      ano: editingMoto.ano,
      kmAtual: editingMoto.kmAtual,
      valorMensal: editingMoto.valorMensal,
      status: editingMoto.status,
    });
    setEditingMoto(null);
  };

  const filters: FrotaFilter[] = [
    'Todas',
    'Disponíveis',
    'Alugadas',
    'Manutenção',
    'Atrasadas',
  ];

  return (
    <div className="space-y-6">
      {/* HEADER */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <p className="text-xs font-semibold text-[#E50914] tracking-wide">
            CONTROLE PATRIMONIAL E OPERACIONAL
          </p>
          <h1 className="mt-1 text-2xl sm:text-3xl font-extrabold tracking-tight text-[#0B0B0B]">
            Frota
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            Gerencie disponibilidade, quilometragem, revisões e condutores vinculados.
          </p>
        </div>

        <button
          onClick={() => setAddModalOpen(true)}
          className="flex items-center justify-center gap-2 rounded-xl bg-[#E50914] px-4 py-2.5 text-xs font-semibold text-white hover:bg-red-700 transition-colors whitespace-nowrap shadow-xs"
        >
          <Plus className="h-4 w-4" />
          + Adicionar moto
        </button>
      </div>

      {/* BARRA DE PESQUISA + FILTROS INTERATIVOS */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por modelo, placa ou código..."
            className="w-full rounded-xl border border-slate-200 bg-white pl-10 pr-4 py-2.5 text-xs sm:text-sm text-slate-900 placeholder:text-slate-400 focus:border-[#087BFF] focus:outline-none"
          />
        </div>

        <div className="flex items-center gap-1 p-1 bg-slate-200/70 rounded-xl overflow-x-auto">
          {filters.map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap ${
                filter === f
                  ? 'bg-[#0B0B0B] text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      {/* GRID DE CARDS DE MOTOCICLETAS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredMotos.map((moto) => {
          const condutor = clientes.find((c) => c.id === moto.clienteAtualId);
          const statusColor =
            moto.status === 'ALUGADA'
              ? 'text-[#087BFF]'
              : moto.status === 'DISPONÍVEL'
              ? 'text-emerald-600'
              : moto.status === 'MANUTENÇÃO'
              ? 'text-amber-600'
              : 'text-[#E50914]';

          return (
            <div
              key={moto.id}
              className="group rounded-xl border border-slate-200 bg-white overflow-hidden hover:border-slate-300 hover:shadow-md transition-all flex flex-col justify-between"
            >
              <div>
                {/* Foto da motocicleta */}
                <div
                  onClick={() => setSelectedMotoId(moto.id)}
                  className="relative aspect-4/3 bg-slate-900 overflow-hidden cursor-pointer"
                >
                  <img
                    src={moto.foto}
                    alt={moto.modelo}
                    referrerPolicy="no-referrer"
                    className="h-full w-full object-cover group-hover:scale-105 transition-transform duration-300"
                  />
                  <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent p-4 flex items-end justify-between text-white">
                    <span className="font-mono-tabular text-xs font-bold tracking-wider">
                      {moto.placa}
                    </span>
                    <span className="font-mono-tabular text-xs text-slate-200">
                      {moto.codigo} · {moto.ano}
                    </span>
                  </div>
                </div>

                {/* Corpo do card */}
                <div className="p-5">
                  <div className="flex items-start justify-between gap-2">
                    <h3
                      onClick={() => setSelectedMotoId(moto.id)}
                      className="text-base font-bold text-slate-900 hover:text-[#087BFF] cursor-pointer transition-colors"
                    >
                      {moto.modelo}
                    </h3>
                    <span className={`text-xs font-mono-tabular font-bold shrink-0 ${statusColor}`}>
                      {moto.status}
                    </span>
                  </div>

                  {/* Metadata sem pills — linha limpa com separadores */}
                  <div className="mt-2 flex items-center gap-2 text-xs text-slate-600 font-mono-tabular">
                    <span>Ano {moto.ano}</span>
                    <span>·</span>
                    <span>{moto.kmAtual.toLocaleString('pt-BR')} km</span>
                    <span>·</span>
                    <span className="font-semibold text-slate-900">
                      R$ {moto.valorMensal}/mês
                    </span>
                  </div>

                  {/* Relacionamento com Cliente Atual */}
                  <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
                    {condutor ? (
                      <button
                        onClick={() => navigateToCliente(condutor.id)}
                        className="flex items-center gap-1.5 text-slate-700 hover:text-[#087BFF] font-medium truncate"
                      >
                        <User className="h-3.5 w-3.5 text-[#087BFF] shrink-0" />
                        <span className="truncate">Condutor: {condutor.nome}</span>
                      </button>
                    ) : (
                      <span className="text-slate-400">
                        {moto.status === 'MANUTENÇÃO'
                          ? 'Na Oficina Central MK'
                          : 'Disponível no pátio MK'}
                      </span>
                    )}
                    <span className="font-mono-tabular text-[11px] text-slate-400 shrink-0">
                      Rev. {moto.proximaRevisaoKm.toLocaleString('pt-BR')} km
                    </span>
                  </div>
                </div>
              </div>

              {/* Ações do card: Ver detalhes | Editar | Alterar status */}
              <div className="grid grid-cols-3 border-t border-slate-100 bg-slate-50/60 divide-x divide-slate-200/70 text-xs font-semibold">
                <button
                  onClick={() => setSelectedMotoId(moto.id)}
                  className="py-2.5 px-2 flex items-center justify-center gap-1.5 text-slate-700 hover:bg-slate-100 hover:text-[#087BFF] transition-colors whitespace-nowrap"
                >
                  <Eye className="h-3.5 w-3.5" />
                  Ver detalhes
                </button>
                <button
                  onClick={() => setEditingMoto(moto)}
                  className="py-2.5 px-2 flex items-center justify-center gap-1.5 text-slate-700 hover:bg-slate-100 hover:text-slate-900 transition-colors whitespace-nowrap"
                >
                  <Edit3 className="h-3.5 w-3.5" />
                  Editar
                </button>
                <button
                  onClick={() => cycleStatus(moto)}
                  className="py-2.5 px-2 flex items-center justify-center gap-1.5 text-slate-700 hover:bg-slate-100 hover:text-[#E50914] transition-colors whitespace-nowrap"
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                  Alterar status
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* MODAL: + ADICIONAR MOTO */}
      {addModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-xs">
          <div className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between bg-[#0B0B0B] px-6 py-4 text-white">
              <h2 className="text-base font-bold">Adicionar Nova Motocicleta à Frota</h2>
              <button
                onClick={() => setAddModalOpen(false)}
                className="text-slate-400 hover:text-white"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <form onSubmit={handleCreateMoto} className="p-6 space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Modelo</label>
                  <input
                    type="text"
                    required
                    value={novoModelo}
                    onChange={(e) => setNovoModelo(e.target.value)}
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-slate-900"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Marca</label>
                  <select
                    value={novaMarca}
                    onChange={(e) => setNovaMarca(e.target.value as 'Honda' | 'Yamaha')}
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-slate-900"
                  >
                    <option value="Honda">Honda</option>
                    <option value="Yamaha">Yamaha</option>
                  </select>
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Placa</label>
                  <input
                    type="text"
                    required
                    value={novaPlaca}
                    onChange={(e) => setNovaPlaca(e.target.value)}
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-slate-900 font-mono-tabular uppercase"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Ano</label>
                  <input
                    type="number"
                    required
                    value={novoAno}
                    onChange={(e) => setNovoAno(Number(e.target.value))}
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-slate-900 font-mono-tabular"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Quilometragem Inicial (km)
                  </label>
                  <input
                    type="number"
                    required
                    value={novoKm}
                    onChange={(e) => setNovoKm(Number(e.target.value))}
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-slate-900 font-mono-tabular"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Valor Mensal (R$)
                  </label>
                  <input
                    type="number"
                    required
                    value={novoValorMensal}
                    onChange={(e) => setNovoValorMensal(Number(e.target.value))}
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-slate-900 font-mono-tabular"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setAddModalOpen(false)}
                  className="rounded-lg border border-slate-200 px-4 py-2 font-semibold text-slate-700 hover:bg-slate-50"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="rounded-lg bg-[#E50914] px-4 py-2 font-semibold text-white hover:bg-red-700"
                >
                  Salvar Motocicleta
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: EDITAR MOTO */}
      {editingMoto && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-xs">
          <div className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between bg-[#0B0B0B] px-6 py-4 text-white">
              <h2 className="text-base font-bold">Editar {editingMoto.modelo}</h2>
              <button
                onClick={() => setEditingMoto(null)}
                className="text-slate-400 hover:text-white"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <form onSubmit={handleSaveEdit} className="p-6 space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Modelo</label>
                  <input
                    type="text"
                    value={editingMoto.modelo}
                    onChange={(e) =>
                      setEditingMoto({ ...editingMoto, modelo: e.target.value })
                    }
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-slate-900"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Placa</label>
                  <input
                    type="text"
                    value={editingMoto.placa}
                    onChange={(e) =>
                      setEditingMoto({ ...editingMoto, placa: e.target.value })
                    }
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-slate-900 font-mono-tabular"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Quilometragem Atual (km)
                  </label>
                  <input
                    type="number"
                    value={editingMoto.kmAtual}
                    onChange={(e) =>
                      setEditingMoto({ ...editingMoto, kmAtual: Number(e.target.value) })
                    }
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-slate-900 font-mono-tabular"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Status</label>
                  <select
                    value={editingMoto.status}
                    onChange={(e) =>
                      setEditingMoto({
                        ...editingMoto,
                        status: e.target.value as MotoStatus,
                      })
                    }
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-slate-900"
                  >
                    <option value="ALUGADA">ALUGADA</option>
                    <option value="DISPONÍVEL">DISPONÍVEL</option>
                    <option value="MANUTENÇÃO">MANUTENÇÃO</option>
                    <option value="ATRASADA">ATRASADA</option>
                  </select>
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setEditingMoto(null)}
                  className="rounded-lg border border-slate-200 px-4 py-2 font-semibold text-slate-700"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="rounded-lg bg-[#087BFF] px-4 py-2 font-semibold text-white hover:bg-blue-600"
                >
                  Salvar Alterações
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
