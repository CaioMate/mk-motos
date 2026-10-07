import React, { useState } from 'react';
import { Search, Plus, Eye, Edit3, Gauge, X, User, Satellite, SatelliteDish } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { Moto } from '../types/mkMotos';
import { tempoRelativo } from '../lib/datas';
import { brl } from '../lib/formato';

type FrotaFilter = 'Todas' | 'Disponíveis' | 'Alugadas' | 'Manutenção' | 'Atrasadas' | 'Sem GPS';

const FORM_VAZIO = {
  modelo: '',
  marca: 'Honda' as 'Honda' | 'Yamaha',
  ano: new Date().getFullYear(),
  placa: '',
  cor: '',
  chassi: '',
  kmAtual: 0,
  valorMensal: 850,
  valorSemanal: 240,
  gpsImei: '',
};

const inputCls = 'w-full rounded-lg border border-slate-200 px-3 py-2 text-slate-900';

export const FrotaView: React.FC = () => {
  const { motos, clientes, setSelectedMotoId, navigateToCliente, addMoto, updateMotoDetails, registrarLeituraKm } =
    useApp();

  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<FrotaFilter>('Todas');
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [editingMoto, setEditingMoto] = useState<Moto | null>(null);
  const [kmMoto, setKmMoto] = useState<Moto | null>(null);
  const [kmLeitura, setKmLeitura] = useState(0);
  const [form, setForm] = useState(FORM_VAZIO);
  const [salvando, setSalvando] = useState(false);

  const q = search.toLowerCase();
  const filteredMotos = motos.filter((m) => {
    const matchesSearch =
      m.modelo.toLowerCase().includes(q) ||
      m.placa.toLowerCase().includes(q) ||
      m.codigo.toLowerCase().includes(q) ||
      (m.gpsImei ?? '').includes(q);

    if (!matchesSearch) return false;
    if (filter === 'Todas') return true;
    if (filter === 'Disponíveis') return m.status === 'DISPONÍVEL';
    if (filter === 'Alugadas') return m.status === 'ALUGADA';
    if (filter === 'Manutenção') return m.status === 'MANUTENÇÃO';
    if (filter === 'Atrasadas') return m.status === 'ATRASADA';
    if (filter === 'Sem GPS') return !m.gpsImei;
    return true;
  });

  const handleCreateMoto = async (e: React.FormEvent) => {
    e.preventDefault();
    setSalvando(true);
    const ok = await addMoto({
      ...form,
      placa: form.placa.toUpperCase(),
      ano: Number(form.ano),
      kmAtual: Number(form.kmAtual),
      valorMensal: Number(form.valorMensal),
      valorSemanal: Number(form.valorSemanal),
    });
    setSalvando(false);
    if (ok) {
      setAddModalOpen(false);
      setForm(FORM_VAZIO);
    }
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingMoto) return;
    setSalvando(true);
    const ok = await updateMotoDetails(editingMoto.id, {
      modelo: editingMoto.modelo,
      placa: editingMoto.placa,
      ano: editingMoto.ano,
      cor: editingMoto.cor,
      chassi: editingMoto.chassi,
      kmAtual: editingMoto.kmAtual,
      valorMensal: editingMoto.valorMensal,
      valorSemanal: editingMoto.valorSemanal,
      gpsImei: editingMoto.gpsImei ?? '',
    });
    setSalvando(false);
    if (ok) setEditingMoto(null);
  };

  const handleKm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!kmMoto) return;
    setSalvando(true);
    const ok = await registrarLeituraKm(kmMoto.id, Number(kmLeitura));
    setSalvando(false);
    if (ok) setKmMoto(null);
  };

  const filters: FrotaFilter[] = ['Todas', 'Disponíveis', 'Alugadas', 'Manutenção', 'Atrasadas', 'Sem GPS'];

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
            Disponibilidade, quilometragem por GPS, revisões e condutores vinculados.
          </p>
        </div>

        <button
          data-dica="Cadastra uma moto nova na frota (modelo, placa, km, valor do aluguel e rastreador GPS)."
          onClick={() => setAddModalOpen(true)}
          className="flex items-center justify-center gap-2 rounded-xl bg-[#E50914] px-4 py-2.5 text-xs font-semibold text-white hover:bg-red-700 transition-colors whitespace-nowrap shadow-xs"
        >
          <Plus className="h-4 w-4" />
          Adicionar moto
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
            placeholder="Buscar por modelo, placa, código ou IMEI..."
            className="w-full rounded-xl border border-slate-200 bg-white pl-10 pr-4 py-2.5 text-xs sm:text-sm text-slate-900 placeholder:text-slate-400 focus:border-[#087BFF] focus:outline-none"
          />
        </div>

        <div className="flex items-center gap-1 p-1 bg-slate-200/70 rounded-xl overflow-x-auto">
          {filters.map((f) => (
            <button
              data-dica="Filtra as motos pela situação."
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap ${
                filter === f ? 'bg-[#0B0B0B] text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      {filteredMotos.length === 0 && (
        <div className="rounded-xl border border-dashed border-slate-300 bg-white p-10 text-center text-sm text-slate-500">
          Nenhuma moto encontrada. Use “Adicionar moto” para cadastrar a frota.
        </div>
      )}

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
          const sinal = moto.gpsUltimaPosicao?.dataHora;
          const sinalRecente = sinal && Date.now() - new Date(sinal).getTime() < 30 * 60_000;

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
                    <span className="font-mono-tabular text-xs font-bold tracking-wider">{moto.placa}</span>
                    <span className="font-mono-tabular text-xs text-slate-200">
                      {moto.codigo} · {moto.ano}
                    </span>
                  </div>
                  <div className="absolute top-3 right-3 flex items-center gap-1 rounded-md bg-black/60 px-2 py-1 text-[10px] font-semibold text-white">
                    {moto.gpsImei ? (
                      <>
                        <Satellite className={`h-3 w-3 ${sinalRecente ? 'text-emerald-400' : 'text-amber-400'}`} />
                        {sinal ? tempoRelativo(sinal) : 'GPS aguardando sinal'}
                      </>
                    ) : (
                      <>
                        <SatelliteDish className="h-3 w-3 text-slate-400" />
                        Sem GPS
                      </>
                    )}
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

                  <div className="mt-2 flex items-center gap-2 text-xs text-slate-600 font-mono-tabular">
                    <span>Ano {moto.ano}</span>
                    <span>·</span>
                    <span>{Math.round(moto.kmAtual).toLocaleString('pt-BR')} km</span>
                    <span>·</span>
                    <span className="font-semibold text-slate-900">{brl(moto.valorMensal)}/mês</span>
                  </div>

                  <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
                    {condutor ? (
                      <button
                        data-dica="Abrir o cadastro do cliente que está com esta moto."
                        onClick={() => navigateToCliente(condutor.id)}
                        className="flex items-center gap-1.5 text-slate-700 hover:text-[#087BFF] font-medium truncate"
                      >
                        <User className="h-3.5 w-3.5 text-[#087BFF] shrink-0" />
                        <span className="truncate">Condutor: {condutor.nome}</span>
                      </button>
                    ) : (
                      <span className="text-slate-400">
                        {moto.status === 'MANUTENÇÃO' ? 'Na oficina' : 'Disponível no pátio'}
                      </span>
                    )}
                    <span className="font-mono-tabular text-[11px] text-slate-400 shrink-0">
                      Rev. {moto.proximaRevisaoKm.toLocaleString('pt-BR')} km
                    </span>
                  </div>
                </div>
              </div>

              {/* Ações do card */}
              <div className="grid grid-cols-3 border-t border-slate-100 bg-slate-50/60 divide-x divide-slate-200/70 text-xs font-semibold">
                <button
                  data-dica="Ficha completa da moto: km, posição do GPS, manutenções e quem está com ela."
                  onClick={() => setSelectedMotoId(moto.id)}
                  className="py-2.5 px-2 flex items-center justify-center gap-1.5 text-slate-700 hover:bg-slate-100 hover:text-[#087BFF] transition-colors whitespace-nowrap"
                >
                  <Eye className="h-3.5 w-3.5" />
                  Detalhes
                </button>
                <button
                  data-dica="Alterar dados da moto, valores do aluguel e o número (IMEI) do rastreador GPS."
                  onClick={() => setEditingMoto({ ...moto })}
                  className="py-2.5 px-2 flex items-center justify-center gap-1.5 text-slate-700 hover:bg-slate-100 hover:text-slate-900 transition-colors whitespace-nowrap"
                >
                  <Edit3 className="h-3.5 w-3.5" />
                  Editar / GPS
                </button>
                <button
                  data-dica="Para moto sem GPS: digite o km que aparece no painel. O sistema calcula os km rodados e as cobranças."
                  onClick={() => {
                    setKmMoto(moto);
                    setKmLeitura(Math.round(moto.kmAtual));
                  }}
                  className="py-2.5 px-2 flex items-center justify-center gap-1.5 text-slate-700 hover:bg-slate-100 hover:text-[#E50914] transition-colors whitespace-nowrap"
                >
                  <Gauge className="h-3.5 w-3.5" />
                  Lançar km
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* MODAL: ADICIONAR MOTO */}
      {addModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-xs">
          <div className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between bg-[#0B0B0B] px-6 py-4 text-white">
              <h2 className="text-base font-bold">Adicionar Nova Motocicleta à Frota</h2>
              <button onClick={() => setAddModalOpen(false)} className="text-slate-400 hover:text-white">
                <X className="h-5 w-5" />
              </button>
            </div>
            <form onSubmit={handleCreateMoto} className="p-6 space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2 sm:col-span-1">
                  <label className="block font-semibold text-slate-700 mb-1">Modelo *</label>
                  <input required value={form.modelo} placeholder="Ex: Honda CG 160 Fan" onChange={(e) => setForm({ ...form, modelo: e.target.value })} className={inputCls} />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Marca</label>
                  <select value={form.marca} onChange={(e) => setForm({ ...form, marca: e.target.value as 'Honda' | 'Yamaha' })} className={inputCls}>
                    <option value="Honda">Honda</option>
                    <option value="Yamaha">Yamaha</option>
                  </select>
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Placa *</label>
                  <input required value={form.placa} placeholder="ABC1D23" onChange={(e) => setForm({ ...form, placa: e.target.value })} className={`${inputCls} font-mono-tabular uppercase`} />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Ano *</label>
                  <input type="number" required value={form.ano} onChange={(e) => setForm({ ...form, ano: Number(e.target.value) })} className={`${inputCls} font-mono-tabular`} />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Cor</label>
                  <input value={form.cor} onChange={(e) => setForm({ ...form, cor: e.target.value })} className={inputCls} />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Chassi</label>
                  <input value={form.chassi} onChange={(e) => setForm({ ...form, chassi: e.target.value })} className={`${inputCls} font-mono-tabular uppercase`} />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Km atual (hodômetro) *</label>
                  <input type="number" min={0} required value={form.kmAtual} onChange={(e) => setForm({ ...form, kmAtual: Number(e.target.value) })} className={`${inputCls} font-mono-tabular`} />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Valor mensal (R$) *</label>
                  <input type="number" min={1} step="0.01" required value={form.valorMensal} onChange={(e) => setForm({ ...form, valorMensal: Number(e.target.value) })} className={`${inputCls} font-mono-tabular`} />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Valor semanal (R$)</label>
                  <input type="number" min={0} step="0.01" value={form.valorSemanal} onChange={(e) => setForm({ ...form, valorSemanal: Number(e.target.value) })} className={`${inputCls} font-mono-tabular`} />
                </div>
                <div className="col-span-2">
                  <label className="block font-semibold text-slate-700 mb-1">IMEI / ID do rastreador GPS</label>
                  <input value={form.gpsImei} placeholder="Ex: 864893030000001 (deixe vazio se ainda não instalou)" onChange={(e) => setForm({ ...form, gpsImei: e.target.value.trim() })} className={`${inputCls} font-mono-tabular`} />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button type="button" onClick={() => setAddModalOpen(false)} className="rounded-lg border border-slate-200 px-4 py-2 font-semibold text-slate-700 hover:bg-slate-50">
                  Cancelar
                </button>
                <button type="submit" disabled={salvando} className="rounded-lg bg-[#E50914] px-4 py-2 font-semibold text-white hover:bg-red-700 disabled:opacity-50">
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
              <button onClick={() => setEditingMoto(null)} className="text-slate-400 hover:text-white">
                <X className="h-5 w-5" />
              </button>
            </div>
            <form onSubmit={handleSaveEdit} className="p-6 space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Modelo</label>
                  <input value={editingMoto.modelo} onChange={(e) => setEditingMoto({ ...editingMoto, modelo: e.target.value })} className={inputCls} />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Placa</label>
                  <input value={editingMoto.placa} onChange={(e) => setEditingMoto({ ...editingMoto, placa: e.target.value.toUpperCase() })} className={`${inputCls} font-mono-tabular`} />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Ano</label>
                  <input type="number" value={editingMoto.ano} onChange={(e) => setEditingMoto({ ...editingMoto, ano: Number(e.target.value) })} className={`${inputCls} font-mono-tabular`} />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Cor</label>
                  <input value={editingMoto.cor} onChange={(e) => setEditingMoto({ ...editingMoto, cor: e.target.value })} className={inputCls} />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Chassi</label>
                  <input value={editingMoto.chassi} onChange={(e) => setEditingMoto({ ...editingMoto, chassi: e.target.value })} className={`${inputCls} font-mono-tabular uppercase`} />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Km atual</label>
                  <input type="number" value={editingMoto.kmAtual} onChange={(e) => setEditingMoto({ ...editingMoto, kmAtual: Number(e.target.value) })} className={`${inputCls} font-mono-tabular`} />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Valor mensal (R$)</label>
                  <input type="number" step="0.01" value={editingMoto.valorMensal} onChange={(e) => setEditingMoto({ ...editingMoto, valorMensal: Number(e.target.value) })} className={`${inputCls} font-mono-tabular`} />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Valor semanal (R$)</label>
                  <input type="number" step="0.01" value={editingMoto.valorSemanal} onChange={(e) => setEditingMoto({ ...editingMoto, valorSemanal: Number(e.target.value) })} className={`${inputCls} font-mono-tabular`} />
                </div>
                <div className="col-span-2 rounded-xl border border-blue-200 bg-blue-50/60 p-3">
                  <label className="block font-semibold text-slate-800 mb-1">IMEI / ID do rastreador GPS</label>
                  <input value={editingMoto.gpsImei ?? ''} placeholder="Número que aparece na etiqueta do rastreador" onChange={(e) => setEditingMoto({ ...editingMoto, gpsImei: e.target.value.trim() })} className={`${inputCls} font-mono-tabular bg-white`} />
                  <p className="mt-1.5 text-[11px] text-slate-600">
                    Com o IMEI cadastrado, o sistema soma sozinho os km rodados, cobra o cliente a cada ciclo de km e avisa as trocas de óleo e peças.
                    Veja como conectar em Configurações → GPS.
                  </p>
                </div>
              </div>
              <p className="text-[11px] text-slate-500">
                Para mudar o status (alugada/disponível/manutenção), use Aluguéis ou Manutenção — assim contrato e cobranças ficam corretos.
              </p>
              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button type="button" onClick={() => setEditingMoto(null)} className="rounded-lg border border-slate-200 px-4 py-2 font-semibold text-slate-700">
                  Cancelar
                </button>
                <button type="submit" disabled={salvando} className="rounded-lg bg-[#087BFF] px-4 py-2 font-semibold text-white hover:bg-blue-600 disabled:opacity-50">
                  Salvar Alterações
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: LANÇAR KM MANUAL */}
      {kmMoto && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-xs">
          <div className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between bg-[#0B0B0B] px-6 py-4 text-white">
              <h2 className="text-base font-bold">Lançar leitura do hodômetro</h2>
              <button onClick={() => setKmMoto(null)} className="text-slate-400 hover:text-white">
                <X className="h-5 w-5" />
              </button>
            </div>
            <form onSubmit={handleKm} className="p-6 space-y-4 text-xs">
              <p className="text-slate-600">
                {kmMoto.modelo} ({kmMoto.placa}) — atual: <strong>{Math.round(kmMoto.kmAtual).toLocaleString('pt-BR')} km</strong>.
                Use quando a moto não tem GPS ou para conferir. Os km a mais entram no contrato e nas cobranças automáticas.
              </p>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Km no painel da moto</label>
                <input type="number" min={Math.floor(kmMoto.kmAtual)} required value={kmLeitura} onChange={(e) => setKmLeitura(Number(e.target.value))} className={`${inputCls} font-mono-tabular text-base font-bold`} />
              </div>
              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button type="button" onClick={() => setKmMoto(null)} className="rounded-lg border border-slate-200 px-4 py-2 font-semibold text-slate-700">
                  Cancelar
                </button>
                <button type="submit" disabled={salvando} className="rounded-lg bg-[#E50914] px-4 py-2 font-semibold text-white hover:bg-red-700 disabled:opacity-50">
                  Registrar km
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
