import React, { useState } from 'react';
import {
  Search,
  Plus,
  MessageSquare,
  Eye,
  X,
  ArrowUpRight,
  Edit3,
  AlertTriangle,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { Cliente, LeadOrigin } from '../types/mkMotos';
import { brl, cpfValido, formatarCpf } from '../lib/formato';
import { cadastroIncompleto } from '../lib/indicadores';

type ClienteFilter = 'Todos' | 'Ativos' | 'Inativos' | 'Com pagamento pendente' | 'Cadastro incompleto';

const FORM_VAZIO = {
  nome: '',
  telefone: '',
  cpf: '',
  cnh: '',
  email: '',
  endereco: '',
  cidade: '',
  origemLead: 'Instagram' as LeadOrigin,
  campanhaOrigem: '',
  observacoes: '',
};

const inputCls = 'w-full rounded-lg border border-slate-200 px-3 py-2 text-slate-900';

export const ClientesView: React.FC = () => {
  const {
    clientes,
    motos,
    contratos,
    setSelectedClienteId,
    setWhatsAppTargetCliente,
    navigateToMoto,
    navigateToContrato,
    addCliente,
    updateCliente,
  } = useApp();

  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<ClienteFilter>('Todos');
  const [modalOpen, setModalOpen] = useState(false);
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [form, setForm] = useState(FORM_VAZIO);
  const [salvando, setSalvando] = useState(false);

  const filteredClientes = clientes.filter((c) => {
    const q = search.toLowerCase();
    const matchesSearch =
      c.nome.toLowerCase().includes(q) ||
      c.telefone.toLowerCase().includes(q) ||
      c.cpf.toLowerCase().includes(q);
    if (!matchesSearch) return false;

    if (filter === 'Todos') return true;
    if (filter === 'Ativos') return c.status === 'Ativo';
    if (filter === 'Inativos') return c.status === 'Inativo';
    if (filter === 'Com pagamento pendente')
      return c.status === 'Pagamento Pendente' || c.status === 'Em Atraso';
    if (filter === 'Cadastro incompleto') return cadastroIncompleto(c);
    return true;
  });

  const abrirNovo = () => {
    setEditandoId(null);
    setForm(FORM_VAZIO);
    setModalOpen(true);
  };

  const abrirEdicao = (c: Cliente) => {
    setEditandoId(c.id);
    setForm({
      nome: c.nome,
      telefone: c.telefone,
      cpf: c.cpf,
      cnh: c.cnh,
      email: c.email,
      endereco: c.endereco,
      cidade: c.cidade,
      origemLead: c.origemLead,
      campanhaOrigem: c.campanhaOrigem ?? '',
      observacoes: c.observacoes,
    });
    setModalOpen(true);
  };

  const handleSalvar = async (e: React.FormEvent) => {
    e.preventDefault();
    setSalvando(true);
    const ok = editandoId ? await updateCliente(editandoId, form) : await addCliente(form);
    setSalvando(false);
    if (ok) {
      setForm(FORM_VAZIO);
      setModalOpen(false);
    }
  };

  const cpfDigitado = form.cpf.replace(/\D/g, '').length === 11;

  const filters: ClienteFilter[] = [
    'Todos',
    'Ativos',
    'Inativos',
    'Com pagamento pendente',
    'Cadastro incompleto',
  ];

  return (
    <div className="space-y-6">
      {/* HEADER */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <p className="text-xs font-semibold text-[#E50914] tracking-wide">
            GESTÃO DE CONDUTORES E LOCATÁRIOS
          </p>
          <h1 className="mt-1 text-2xl sm:text-3xl font-extrabold tracking-tight text-[#0B0B0B]">
            Clientes
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            Prontuário completo de condutores, motos alocadas, contratos e histórico de pagamentos.
          </p>
        </div>

        <button
          data-dica="Cadastrar um cliente novo (nome, CPF, CNH, telefone, endereço)."
          onClick={abrirNovo}
          className="flex items-center justify-center gap-2 rounded-xl bg-[#E50914] px-4 py-2.5 text-xs font-semibold text-white hover:bg-red-700 transition-colors whitespace-nowrap shadow-xs"
        >
          <Plus className="h-4 w-4" />
          Novo cliente
        </button>
      </div>

      {/* SEARCH + FILTERS */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar cliente..."
            className="w-full rounded-xl border border-slate-200 bg-white pl-10 pr-4 py-2.5 text-xs sm:text-sm text-slate-900 placeholder:text-slate-400 focus:border-[#087BFF] focus:outline-none"
          />
        </div>

        <div className="flex items-center gap-1 p-1 bg-slate-200/70 rounded-xl overflow-x-auto">
          {filters.map((f) => (
            <button
              data-dica="Filtra os clientes pela situação."
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

      {/* TABELA DE CLIENTES DE ALTA DENSIDADE */}
      <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/80 text-[11px] font-semibold text-slate-500">
                <th className="py-3.5 px-5">Nome</th>
                <th className="py-3.5 px-4">Telefone</th>
                <th className="py-3.5 px-4">Moto</th>
                <th className="py-3.5 px-4">Contrato</th>
                <th className="py-3.5 px-4">Status</th>
                <th className="py-3.5 px-4 text-right">Próximo pagamento</th>
                <th className="py-3.5 px-5 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs">
              {filteredClientes.length === 0 && (
                <tr>
                  <td colSpan={12} className="py-10 px-4 text-center text-sm text-slate-500">
                    Nenhum cliente por aqui ainda. Use o botão de novo cliente para cadastrar o primeiro.
                  </td>
                </tr>
              )}
              {filteredClientes.map((cli) => {
                const moto = motos.find((m) => m.id === cli.motoAtualId);
                const ctr = contratos.find((c) => c.id === cli.contratoAtualId);

                const statusTextClass =
                  cli.status === 'Ativo'
                    ? 'text-emerald-600'
                    : cli.status === 'Em Atraso'
                    ? 'text-[#E50914]'
                    : cli.status === 'Pagamento Pendente'
                    ? 'text-amber-600'
                    : 'text-slate-400';

                return (
                  <tr
                    key={cli.id}
                    className="hover:bg-slate-50/90 transition-colors group"
                  >
                    <td className="py-3.5 px-5">
                      <button
                        onClick={() => setSelectedClienteId(cli.id)}
                        className="text-left group-hover:text-[#087BFF] transition-colors"
                      >
                        <p className="font-bold text-slate-900 text-sm">{cli.nome}</p>
                        <p className="text-[11px] text-slate-500">
                          Origem: {cli.origemLead} · CPF {cli.cpf || '—'}
                        </p>
                        {cadastroIncompleto(cli) && (
                          <p className="mt-0.5 flex items-center gap-1 text-[11px] font-semibold text-amber-600">
                            <AlertTriangle className="h-3 w-3" /> Cadastro incompleto
                          </p>
                        )}
                      </button>
                    </td>

                    <td className="py-3.5 px-4 font-mono-tabular text-slate-700 whitespace-nowrap">
                      {cli.telefone}
                    </td>

                    <td className="py-3.5 px-4 whitespace-nowrap">
                      {moto ? (
                        <button
                          data-dica="Abrir a ficha da moto que está com este cliente."
                          onClick={() => navigateToMoto(moto.id)}
                          className="inline-flex items-center gap-1 font-semibold text-slate-900 hover:text-[#087BFF] transition-colors"
                        >
                          <span>{moto.modelo}</span>
                          <span className="text-slate-400 font-mono-tabular">({moto.placa})</span>
                          <ArrowUpRight className="h-3 w-3 text-[#087BFF]" />
                        </button>
                      ) : (
                        <span className="text-slate-400">Sem moto ativa</span>
                      )}
                    </td>

                    <td className="py-3.5 px-4 font-mono-tabular whitespace-nowrap">
                      {ctr ? (
                        <button
                          data-dica="Abrir o contrato deste cliente."
                          onClick={() => navigateToContrato(ctr.id)}
                          className="font-semibold text-[#087BFF] hover:underline"
                        >
                          {ctr.numero}
                        </button>
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </td>

                    <td className="py-3.5 px-4 whitespace-nowrap">
                      <span className={`font-semibold ${statusTextClass}`}>{cli.status}</span>
                    </td>

                    <td className="py-3.5 px-4 text-right font-mono-tabular whitespace-nowrap">
                      {cli.proximoPagamentoValor > 0 ? (
                        <div>
                          <span className="font-bold text-slate-900">
                            {brl(cli.proximoPagamentoValor)}
                          </span>
                          <span className="text-slate-500"> · {cli.proximoPagamentoData}</span>
                        </div>
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </td>

                    <td className="py-3.5 px-5 text-right whitespace-nowrap">
                      <div className="inline-flex items-center justify-end gap-2">
                        <button
                          data-dica="Mandar uma mensagem de WhatsApp para este cliente."
                          onClick={() => setWhatsAppTargetCliente(cli)}
                          className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50/70 px-2.5 py-1.5 text-xs font-semibold text-emerald-800 hover:bg-emerald-100 transition-colors"
                        >
                          <MessageSquare className="h-3.5 w-3.5" />
                          WhatsApp
                        </button>
                        <button
                          data-dica="Alterar os dados do cadastro do cliente."
                          onClick={() => abrirEdicao(cli)}
                          className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
                        >
                          <Edit3 className="h-3.5 w-3.5" />
                          Editar
                        </button>
                        <button
                          onClick={() => setSelectedClienteId(cli.id)}
                          className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
                        >
                          <Eye className="h-3.5 w-3.5" />
                          Detalhes
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

      {/* MODAL: NOVO / EDITAR CLIENTE */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-xs">
          <div className="w-full max-w-2xl max-h-[92vh] overflow-y-auto rounded-2xl border border-slate-200 bg-white shadow-2xl">
            <div className="sticky top-0 flex items-center justify-between bg-[#0B0B0B] px-6 py-4 text-white">
              <h2 className="text-base font-bold">
                {editandoId ? 'Editar cadastro do cliente' : 'Cadastrar novo cliente'}
              </h2>
              <button onClick={() => setModalOpen(false)} className="text-slate-400 hover:text-white">
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSalvar} className="p-6 space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="sm:col-span-2">
                  <label className="block font-semibold text-slate-700 mb-1">Nome completo *</label>
                  <input required minLength={3} value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} className={inputCls} />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">CPF *</label>
                  <input
                    required
                    value={form.cpf}
                    onChange={(e) => setForm({ ...form, cpf: formatarCpf(e.target.value) })}
                    placeholder="000.000.000-00"
                    className={`${inputCls} font-mono-tabular ${cpfDigitado && !cpfValido(form.cpf) ? 'border-red-400 bg-red-50' : ''}`}
                  />
                  {cpfDigitado && !cpfValido(form.cpf) && (
                    <p className="mt-1 text-[11px] font-semibold text-[#E50914]">CPF inválido</p>
                  )}
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">CNH (número e categoria)</label>
                  <input value={form.cnh} onChange={(e) => setForm({ ...form, cnh: e.target.value })} placeholder="00000000000 (Cat. A)" className={`${inputCls} font-mono-tabular`} />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Telefone / WhatsApp *</label>
                  <input required value={form.telefone} onChange={(e) => setForm({ ...form, telefone: e.target.value })} placeholder="(11) 99999-9999" className={`${inputCls} font-mono-tabular`} />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">E-mail</label>
                  <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className={inputCls} />
                </div>
                <div className="sm:col-span-2">
                  <label className="block font-semibold text-slate-700 mb-1">Endereço (rua, número, bairro)</label>
                  <input value={form.endereco} onChange={(e) => setForm({ ...form, endereco: e.target.value })} className={inputCls} />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Cidade - UF</label>
                  <input value={form.cidade} onChange={(e) => setForm({ ...form, cidade: e.target.value })} placeholder="São Paulo - SP" className={inputCls} />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Como conheceu a MK Motos</label>
                  <select value={form.origemLead} onChange={(e) => setForm({ ...form, origemLead: e.target.value as LeadOrigin })} className={inputCls}>
                    <option value="Instagram">Instagram</option>
                    <option value="WhatsApp">WhatsApp</option>
                    <option value="Google">Google</option>
                    <option value="Indicação">Indicação</option>
                    <option value="Anúncios">Anúncios</option>
                  </select>
                </div>
                <div className="sm:col-span-2">
                  <label className="block font-semibold text-slate-700 mb-1">Observações internas</label>
                  <textarea rows={2} value={form.observacoes} onChange={(e) => setForm({ ...form, observacoes: e.target.value })} className={inputCls} />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button type="button" onClick={() => setModalOpen(false)} className="rounded-lg border border-slate-200 px-4 py-2 font-semibold text-slate-700">
                  Cancelar
                </button>
                <button type="submit" disabled={salvando} className="rounded-lg bg-[#E50914] px-4 py-2 font-semibold text-white hover:bg-red-700 disabled:opacity-50">
                  {editandoId ? 'Salvar alterações' : 'Salvar cliente'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
