import React, { useState } from 'react';
import {
  Search,
  Plus,
  MessageSquare,
  Eye,
  X,
  ArrowUpRight,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { LeadOrigin } from '../types/mkMotos';

type ClienteFilter = 'Todos' | 'Ativos' | 'Inativos' | 'Com pagamento pendente';

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
  } = useApp();

  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<ClienteFilter>('Todos');
  const [modalOpen, setModalOpen] = useState(false);

  // Novo cliente form
  const [nome, setNome] = useState('');
  const [telefone, setTelefone] = useState('(11) 9');
  const [cpf, setCpf] = useState('');
  const [cnh, setCnh] = useState('');
  const [origem, setOrigem] = useState<LeadOrigin>('Instagram');

  const filteredClientes = clientes.filter((c) => {
    const matchesSearch =
      c.nome.toLowerCase().includes(search.toLowerCase()) ||
      c.telefone.toLowerCase().includes(search.toLowerCase()) ||
      c.cpf.toLowerCase().includes(search.toLowerCase());
    if (!matchesSearch) return false;

    if (filter === 'Todos') return true;
    if (filter === 'Ativos') return c.status === 'Ativo';
    if (filter === 'Inativos') return c.status === 'Inativo';
    if (filter === 'Com pagamento pendente')
      return c.status === 'Pagamento Pendente' || c.status === 'Em Atraso';
    return true;
  });

  const handleCreateCliente = (e: React.FormEvent) => {
    e.preventDefault();
    if (!nome.trim()) return;
    addCliente({
      nome,
      cpf: cpf || '419.882.104-29',
      cnh: cnh || '06819204912 (Cat. A)',
      telefone,
      email: `${nome.toLowerCase().replace(/\s+/g, '.')}@email.com`,
      endereco: 'Av. Paulista, 1500',
      cidade: 'São Paulo - SP',
      status: 'Ativo',
      proximoPagamentoData: '15/10/2026',
      proximoPagamentoValor: 850,
      origemLead: origem,
      campanhaOrigem: 'Alugue sua moto para trabalhar',
      observacoes: 'Cliente cadastrado manualmente pelo painel administrativo.',
    });
    setNome('');
    setCpf('');
    setCnh('');
    setModalOpen(false);
  };

  const filters: ClienteFilter[] = [
    'Todos',
    'Ativos',
    'Inativos',
    'Com pagamento pendente',
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
          onClick={() => setModalOpen(true)}
          className="flex items-center justify-center gap-2 rounded-xl bg-[#E50914] px-4 py-2.5 text-xs font-semibold text-white hover:bg-red-700 transition-colors whitespace-nowrap shadow-xs"
        >
          <Plus className="h-4 w-4" />
          + Novo cliente
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
                          Origem: {cli.origemLead} · CPF {cli.cpf}
                        </p>
                      </button>
                    </td>

                    <td className="py-3.5 px-4 font-mono-tabular text-slate-700 whitespace-nowrap">
                      {cli.telefone}
                    </td>

                    <td className="py-3.5 px-4 whitespace-nowrap">
                      {moto ? (
                        <button
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
                            R$ {cli.proximoPagamentoValor.toLocaleString('pt-BR')}
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
                          onClick={() => setWhatsAppTargetCliente(cli)}
                          className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50/70 px-2.5 py-1.5 text-xs font-semibold text-emerald-800 hover:bg-emerald-100 transition-colors"
                        >
                          <MessageSquare className="h-3.5 w-3.5" />
                          WhatsApp
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

      {/* MODAL: + NOVO CLIENTE */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-xs">
          <div className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between bg-[#0B0B0B] px-6 py-4 text-white">
              <h2 className="text-base font-bold">Cadastrar Novo Cliente MK Motos</h2>
              <button
                onClick={() => setModalOpen(false)}
                className="text-slate-400 hover:text-white"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleCreateCliente} className="p-6 space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Nome Completo</label>
                <input
                  type="text"
                  required
                  value={nome}
                  onChange={(e) => setNome(e.target.value)}
                  placeholder="Ex: Henrique Vasconcelos"
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-slate-900"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Telefone / WhatsApp</label>
                  <input
                    type="text"
                    required
                    value={telefone}
                    onChange={(e) => setTelefone(e.target.value)}
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-slate-900 font-mono-tabular"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Origem do Cliente</label>
                  <select
                    value={origem}
                    onChange={(e) => setOrigem(e.target.value as LeadOrigin)}
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-slate-900"
                  >
                    <option value="Instagram">Instagram</option>
                    <option value="WhatsApp">WhatsApp</option>
                    <option value="Google">Google</option>
                    <option value="Indicação">Indicação</option>
                    <option value="Anúncios">Anúncios</option>
                  </select>
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">CPF</label>
                  <input
                    type="text"
                    value={cpf}
                    onChange={(e) => setCpf(e.target.value)}
                    placeholder="000.000.000-00"
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-slate-900 font-mono-tabular"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Número da CNH</label>
                  <input
                    type="text"
                    value={cnh}
                    onChange={(e) => setCnh(e.target.value)}
                    placeholder="05918274911 (Cat. A)"
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-slate-900 font-mono-tabular"
                  />
                </div>
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
                  Salvar Cliente
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
