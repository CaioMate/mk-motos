import React, { useState } from 'react';
import {
  Plus,
  CheckCircle2,
  ChevronRight,
  ChevronLeft,
  FileText,
  X,
  ArrowUpRight,
} from 'lucide-react';
import { useApp } from '../context/AppContext';

type AluguelFilter = 'Todos' | 'Ativos' | 'Próximos' | 'Finalizados' | 'Atrasados';

const WIZARD_STEPS = [
  { num: 1, label: 'Selecionar cliente' },
  { num: 2, label: 'Selecionar moto' },
  { num: 3, label: 'Definir período' },
  { num: 4, label: 'Definir valor' },
  { num: 5, label: 'Gerar contrato' },
  { num: 6, label: 'Registrar pagamento' },
  { num: 7, label: 'Confirmar aluguel' },
];

export const AlugueisView: React.FC = () => {
  const {
    alugueis,
    clientes,
    motos,
    navigateToCliente,
    navigateToMoto,
    navigateToContrato,
    createFullAluguel,
    finalizarAluguel,
  } = useApp();

  const [filter, setFilter] = useState<AluguelFilter>('Todos');
  const [wizardOpen, setWizardOpen] = useState(false);
  const [step, setStep] = useState(1);

  // Wizard State (7 etapas)
  const [selectedClienteId, setSelectedClienteId] = useState<string>(clientes[0]?.id || 'cli-1');
  const availableMotos = motos.filter((m) => m.status === 'DISPONÍVEL');
  const [selectedMotoId, setSelectedMotoId] = useState<string>(
    availableMotos[0]?.id || motos[1]?.id || 'moto-2'
  );
  const [plano, setPlano] = useState<'Semanal' | 'Mensal' | 'Anual'>('Mensal');
  const [dataInicio, setDataInicio] = useState('01/10/2026');
  const [dataPrevista, setDataPrevista] = useState('01/04/2027');
  const [valorMensal, setValorMensal] = useState(780);
  const [caucao, setCaucao] = useState(500);
  const [formaPagamento, setFormaPagamento] = useState<
    'PIX' | 'Boleto' | 'Cartão' | 'Transferência'
  >('PIX');
  const [pagamentoConfirmado, setPagamentoConfirmado] = useState(true);

  const filteredAlugueis = alugueis.filter((a) => {
    if (filter === 'Todos') return true;
    if (filter === 'Ativos') return a.status === 'Ativo';
    if (filter === 'Próximos') return a.status === 'Próximo';
    if (filter === 'Finalizados') return a.status === 'Finalizado';
    if (filter === 'Atrasados') return a.status === 'Atrasado';
    return true;
  });

  const handleSaveAluguel = () => {
    createFullAluguel({
      clienteId: selectedClienteId,
      motoId: selectedMotoId,
      dataInicio,
      dataPrevista,
      plano,
      valorMensal: Number(valorMensal),
      caucao: Number(caucao),
      formaPagamento,
      pagamentoConfirmado,
    });
    setWizardOpen(false);
    setStep(1);
  };

  const chosenCli = clientes.find((c) => c.id === selectedClienteId);
  const chosenMoto = motos.find((m) => m.id === selectedMotoId);

  return (
    <div className="space-y-6">
      {/* HEADER */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <p className="text-xs font-semibold text-[#E50914] tracking-wide">
            OPERAÇÃO DE LOCAÇÃO E FLUXO CONTRATUAL
          </p>
          <h1 className="mt-1 text-2xl sm:text-3xl font-extrabold tracking-tight text-[#0B0B0B]">
            Aluguéis
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            Controle de locações em andamento, renovações e fluxo guiado de 7 etapas.
          </p>
        </div>

        <button
          onClick={() => {
            setStep(1);
            setWizardOpen(true);
          }}
          className="flex items-center justify-center gap-2 rounded-xl bg-[#E50914] px-4 py-2.5 text-xs font-semibold text-white hover:bg-red-700 transition-colors whitespace-nowrap shadow-xs"
        >
          <Plus className="h-4 w-4" />
          + Novo aluguel
        </button>
      </div>

      {/* FILTROS DE STATUS */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-1 p-1 bg-slate-200/70 rounded-xl overflow-x-auto">
          {(['Todos', 'Ativos', 'Próximos', 'Finalizados', 'Atrasados'] as AluguelFilter[]).map(
            (f) => (
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
            )
          )}
        </div>

        <span className="text-xs text-slate-500 font-mono-tabular">
          Exibindo {filteredAlugueis.length} locações registradas
        </span>
      </div>

      {/* TABELA DE ALUGUÉIS */}
      <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/80 text-[11px] font-semibold text-slate-500">
                <th className="py-3.5 px-5">Código / Cliente</th>
                <th className="py-3.5 px-4">Moto</th>
                <th className="py-3.5 px-4">Data de início</th>
                <th className="py-3.5 px-4">Data prevista</th>
                <th className="py-3.5 px-4 text-right">Valor</th>
                <th className="py-3.5 px-4">Status</th>
                <th className="py-3.5 px-5 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs">
              {filteredAlugueis.map((alu) => {
                const cli = clientes.find((c) => c.id === alu.clienteId);
                const moto = motos.find((m) => m.id === alu.motoId);

                const statusColor =
                  alu.status === 'Ativo'
                    ? 'text-emerald-600'
                    : alu.status === 'Atrasado'
                    ? 'text-[#E50914]'
                    : alu.status === 'Próximo'
                    ? 'text-[#087BFF]'
                    : 'text-slate-400';

                return (
                  <tr key={alu.id} className="hover:bg-slate-50/90 transition-colors">
                    <td className="py-3.5 px-5">
                      <span className="font-mono-tabular text-[11px] text-slate-400 block">
                        {alu.codigo}
                      </span>
                      <button
                        onClick={() => cli && navigateToCliente(cli.id)}
                        className="font-bold text-slate-900 text-sm hover:text-[#087BFF] transition-colors"
                      >
                        {cli?.nome || 'Cliente'}
                      </button>
                    </td>

                    <td className="py-3.5 px-4 whitespace-nowrap">
                      {moto ? (
                        <button
                          onClick={() => navigateToMoto(moto.id)}
                          className="inline-flex items-center gap-1 font-semibold text-slate-800 hover:text-[#087BFF]"
                        >
                          <span>{moto.modelo}</span>
                          <span className="text-slate-400 font-mono-tabular">({moto.placa})</span>
                          <ArrowUpRight className="h-3 w-3 text-[#087BFF]" />
                        </button>
                      ) : (
                        '—'
                      )}
                    </td>

                    <td className="py-3.5 px-4 font-mono-tabular text-slate-700 whitespace-nowrap">
                      {alu.dataInicio}
                    </td>

                    <td className="py-3.5 px-4 font-mono-tabular text-slate-700 whitespace-nowrap">
                      {alu.dataPrevista}
                    </td>

                    <td className="py-3.5 px-4 text-right font-mono-tabular font-bold text-slate-900 whitespace-nowrap">
                      R$ {alu.valorMensal.toLocaleString('pt-BR')}/mês
                    </td>

                    <td className="py-3.5 px-4 whitespace-nowrap">
                      <span className={`font-semibold ${statusColor}`}>{alu.status}</span>
                    </td>

                    <td className="py-3.5 px-5 text-right whitespace-nowrap">
                      <div className="inline-flex items-center gap-2">
                        <button
                          onClick={() => navigateToContrato(alu.contratoId)}
                          className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                        >
                          <FileText className="h-3.5 w-3.5 text-[#087BFF]" />
                          Contrato
                        </button>
                        {alu.status !== 'Finalizado' && (
                          <button
                            onClick={() => finalizarAluguel(alu.id)}
                            className="rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-semibold text-slate-600 hover:border-[#E50914] hover:text-[#E50914] transition-colors"
                          >
                            Finalizar aluguel
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* FLUXO VISUAL DE 7 ETAPAS PARA NOVO ALUGUEL */}
      {wizardOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-xs">
          <div className="w-full max-w-3xl rounded-2xl border border-slate-200 bg-white shadow-2xl overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between bg-[#0B0B0B] px-6 py-4 text-white">
              <div>
                <span className="text-xs text-[#E50914] font-mono-tabular font-bold">
                  ETAPA {step} DE 7 — {WIZARD_STEPS[step - 1].label.toUpperCase()}
                </span>
                <h2 className="text-lg font-bold text-white">
                  Novo Aluguel Integrado MK Motos
                </h2>
              </div>
              <button
                onClick={() => setWizardOpen(false)}
                className="text-slate-400 hover:text-white"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Stepper Barra de 7 Etapas */}
            <div className="grid grid-cols-7 border-b border-slate-200 bg-slate-50 text-[11px]">
              {WIZARD_STEPS.map((s) => {
                const isCurrent = s.num === step;
                const isDone = s.num < step;
                return (
                  <button
                    key={s.num}
                    onClick={() => setStep(s.num)}
                    className={`py-2.5 px-2 text-center border-r last:border-r-0 border-slate-200 transition-colors ${
                      isCurrent
                        ? 'bg-white font-bold text-[#087BFF] border-b-2 border-b-[#087BFF]'
                        : isDone
                        ? 'text-emerald-700 font-semibold'
                        : 'text-slate-400'
                    }`}
                  >
                    <span className="block font-mono-tabular text-[10px]">ETAPA {s.num}</span>
                    <span className="hidden sm:block truncate mt-0.5">{s.label}</span>
                  </button>
                );
              })}
            </div>

            {/* Conteúdo de cada Etapa */}
            <div className="p-6 min-h-[270px] flex flex-col justify-between">
              {step === 1 && (
                <div className="space-y-4">
                  <h3 className="text-sm font-bold text-slate-900">
                    ETAPA 1 — Selecionar cliente para a locação
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-56 overflow-y-auto">
                    {clientes.map((c) => (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => setSelectedClienteId(c.id)}
                        className={`p-3.5 rounded-xl border text-left transition-all ${
                          selectedClienteId === c.id
                            ? 'border-[#087BFF] bg-blue-50/40'
                            : 'border-slate-200 hover:border-slate-300'
                        }`}
                      >
                        <p className="text-xs font-bold text-slate-900">{c.nome}</p>
                        <p className="text-[11px] text-slate-500 font-mono-tabular mt-0.5">
                          {c.telefone} · CNH {c.cnh}
                        </p>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {step === 2 && (
                <div className="space-y-4">
                  <h3 className="text-sm font-bold text-slate-900">
                    ETAPA 2 — Selecionar motocicleta da frota
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-56 overflow-y-auto">
                    {motos.map((m) => (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => {
                          setSelectedMotoId(m.id);
                          setValorMensal(m.valorMensal);
                        }}
                        className={`p-3 rounded-xl border text-left flex items-center gap-3 transition-all ${
                          selectedMotoId === m.id
                            ? 'border-[#087BFF] bg-blue-50/40'
                            : 'border-slate-200 hover:border-slate-300'
                        }`}
                      >
                        <img
                          src={m.foto}
                          alt={m.modelo}
                          referrerPolicy="no-referrer"
                          className="h-12 w-16 rounded-lg object-cover shrink-0"
                        />
                        <div className="min-w-0">
                          <p className="text-xs font-bold text-slate-900 truncate">{m.modelo}</p>
                          <p className="text-[11px] text-slate-500 font-mono-tabular">
                            {m.placa} · R$ {m.valorMensal}/mês · {m.status}
                          </p>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {step === 3 && (
                <div className="space-y-4 text-xs">
                  <h3 className="text-sm font-bold text-slate-900">
                    ETAPA 3 — Definir período e modalidade
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">Plano</label>
                      <select
                        value={plano}
                        onChange={(e) =>
                          setPlano(e.target.value as 'Semanal' | 'Mensal' | 'Anual')
                        }
                        className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-slate-900"
                      >
                        <option value="Semanal">Semanal</option>
                        <option value="Mensal">Mensal</option>
                        <option value="Anual">Anual Fidelidade</option>
                      </select>
                    </div>
                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">
                        Data de Início
                      </label>
                      <input
                        type="text"
                        value={dataInicio}
                        onChange={(e) => setDataInicio(e.target.value)}
                        className="w-full rounded-lg border border-slate-200 px-3 py-2.5 font-mono-tabular"
                      />
                    </div>
                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">
                        Data Prevista de Término
                      </label>
                      <input
                        type="text"
                        value={dataPrevista}
                        onChange={(e) => setDataPrevista(e.target.value)}
                        className="w-full rounded-lg border border-slate-200 px-3 py-2.5 font-mono-tabular"
                      />
                    </div>
                  </div>
                </div>
              )}

              {step === 4 && (
                <div className="space-y-4 text-xs">
                  <h3 className="text-sm font-bold text-slate-900">
                    ETAPA 4 — Definir valor mensal e caução de garantia
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">
                        Valor Mensal da Locação (R$)
                      </label>
                      <input
                        type="number"
                        value={valorMensal}
                        onChange={(e) => setValorMensal(Number(e.target.value))}
                        className="w-full rounded-lg border border-slate-200 px-3 py-2.5 font-mono-tabular text-base font-bold text-slate-900"
                      />
                    </div>
                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">
                        Valor do Caução (R$)
                      </label>
                      <input
                        type="number"
                        value={caucao}
                        onChange={(e) => setCaucao(Number(e.target.value))}
                        className="w-full rounded-lg border border-slate-200 px-3 py-2.5 font-mono-tabular text-base font-bold text-slate-900"
                      />
                    </div>
                  </div>
                </div>
              )}

              {step === 5 && (
                <div className="space-y-3 text-xs">
                  <h3 className="text-sm font-bold text-slate-900">
                    ETAPA 5 — Gerar contrato automático MK Motos
                  </h3>
                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-slate-900">
                        Minuta Contratual Pronta para Emissão
                      </span>
                      <span className="font-mono-tabular text-[#087BFF] font-bold">
                        Franquia: 4.500 km/mês
                      </span>
                    </div>
                    <p className="text-slate-600">
                      Locatário: <strong>{chosenCli?.nome}</strong> (CPF {chosenCli?.cpf})
                    </p>
                    <p className="text-slate-600">
                      Motocicleta: <strong>{chosenMoto?.modelo}</strong> — Placa{' '}
                      <span className="font-mono-tabular">{chosenMoto?.placa}</span>
                    </p>
                    <p className="text-slate-600 font-mono-tabular">
                      Vigência: {dataInicio} a {dataPrevista} · Mensalidade R$ {valorMensal}
                    </p>
                  </div>
                </div>
              )}

              {step === 6 && (
                <div className="space-y-4 text-xs">
                  <h3 className="text-sm font-bold text-slate-900">
                    ETAPA 6 — Registrar pagamento inicial / caução
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">
                        Forma de Pagamento
                      </label>
                      <select
                        value={formaPagamento}
                        onChange={(e) =>
                          setFormaPagamento(
                            e.target.value as 'PIX' | 'Boleto' | 'Cartão' | 'Transferência'
                          )
                        }
                        className="w-full rounded-lg border border-slate-200 px-3 py-2.5"
                      >
                        <option value="PIX">PIX Instantâneo</option>
                        <option value="Cartão">Cartão de Crédito</option>
                        <option value="Boleto">Boleto Bancário</option>
                        <option value="Transferência">Transferência</option>
                      </select>
                    </div>
                    <div className="flex items-end">
                      <label className="flex items-center gap-2.5 cursor-pointer p-2.5 rounded-lg border border-slate-200 w-full">
                        <input
                          type="checkbox"
                          checked={pagamentoConfirmado}
                          onChange={(e) => setPagamentoConfirmado(e.target.checked)}
                          className="h-4 w-4 accent-[#E50914]"
                        />
                        <span className="font-semibold text-slate-800">
                          Confirmar recebimento imediato no Financeiro
                        </span>
                      </label>
                    </div>
                  </div>
                </div>
              )}

              {step === 7 && (
                <div className="space-y-4 text-xs">
                  <h3 className="text-sm font-bold text-slate-900">
                    ETAPA 7 — Confirmar aluguel e liberar motocicleta
                  </h3>
                  <div className="rounded-xl border border-emerald-200 bg-emerald-50/50 p-4 space-y-1.5">
                    <p className="font-bold text-emerald-950 text-sm flex items-center gap-1.5">
                      <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                      Tudo pronto para ativar a locação!
                    </p>
                    <p className="text-slate-700">
                      Ao confirmar, a moto <strong>{chosenMoto?.modelo}</strong> ({chosenMoto?.placa}
                      ) será vinculada a <strong>{chosenCli?.nome}</strong>, o contrato será criado
                      na aba Contratos e o lançamento será registrado no Financeiro.
                    </p>
                  </div>
                </div>
              )}

              {/* Rodapé do Wizard */}
              <div className="mt-6 pt-4 border-t border-slate-100 flex items-center justify-between">
                <button
                  type="button"
                  disabled={step === 1}
                  onClick={() => setStep((s) => Math.max(1, s - 1))}
                  className="flex items-center gap-1 rounded-lg border border-slate-200 px-3.5 py-2 text-xs font-semibold text-slate-700 disabled:opacity-40"
                >
                  <ChevronLeft className="h-3.5 w-3.5" />
                  Etapa Anterior
                </button>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleSaveAluguel}
                    className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-800 hover:bg-slate-50"
                  >
                    Salvar aluguel
                  </button>

                  {step < 7 ? (
                    <button
                      type="button"
                      onClick={() => setStep((s) => Math.min(7, s + 1))}
                      className="flex items-center gap-1 rounded-lg bg-[#087BFF] px-4 py-2 text-xs font-semibold text-white hover:bg-blue-600"
                    >
                      Próxima Etapa
                      <ChevronRight className="h-3.5 w-3.5" />
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={handleSaveAluguel}
                      className="rounded-lg bg-[#E50914] px-5 py-2 text-xs font-semibold text-white hover:bg-red-700 shadow-xs"
                    >
                      Confirmar e Ativar Aluguel ✓
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
