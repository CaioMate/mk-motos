import React, { useState } from 'react';
import {
  Plus,
  CheckCircle2,
  ChevronRight,
  ChevronLeft,
  FileText,
  X,
  ArrowUpRight,
  PenLine,
  Undo2,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { formatBR, somarMeses } from '../lib/datas';
import { brl } from '../lib/formato';
import { FotoMoto } from '../components/FotoMoto';
import { Aluguel, Contrato, FormaPagamento } from '../types/mkMotos';

type Filtro = 'Todos' | 'Ativos' | 'Atrasados' | 'Aguardando assinatura' | 'Próximos' | 'Vencidos' | 'Finalizados';

const FILTROS: Array<{ id: Filtro; dica: string }> = [
  { id: 'Todos', dica: 'Mostra todos os aluguéis e contratos.' },
  { id: 'Ativos', dica: 'Motos que estão com o cliente e com tudo em dia.' },
  { id: 'Atrasados', dica: 'Cliente com mensalidade atrasada ou que passou da data de devolução.' },
  { id: 'Aguardando assinatura', dica: 'Contratos gerados que o cliente ainda não assinou.' },
  { id: 'Próximos', dica: 'Aluguéis com data de início no futuro (reservas).' },
  { id: 'Vencidos', dica: 'Contratos que passaram da data final e precisam ser renovados ou encerrados.' },
  { id: 'Finalizados', dica: 'Aluguéis encerrados: a moto já foi devolvida.' },
];

/** Uma linha da tela = um aluguel com o seu contrato (ou um contrato antigo sem aluguel). */
interface Linha {
  id: string;
  alu?: Aluguel;
  ctr?: Contrato;
}

function passaNoFiltro(l: Linha, f: Filtro) {
  const a = l.alu?.status;
  const c = l.ctr?.status;
  switch (f) {
    case 'Todos':
      return true;
    case 'Ativos':
      return a === 'Ativo';
    case 'Atrasados':
      return a === 'Atrasado';
    case 'Aguardando assinatura':
      return c === 'Aguardando assinatura';
    case 'Próximos':
      return a === 'Próximo';
    case 'Vencidos':
      return c === 'Vencido';
    case 'Finalizados':
      return a ? a === 'Finalizado' : c === 'Finalizado';
  }
}

const WIZARD_STEPS = [
  { num: 1, label: 'Selecionar cliente', dica: 'Escolha quem vai alugar. Só aparecem clientes sem moto no momento.' },
  { num: 2, label: 'Selecionar moto', dica: 'Escolha a moto. Só aparecem motos disponíveis.' },
  { num: 3, label: 'Definir período', dica: 'Plano (semanal, mensal ou anual) e as datas de início e fim.' },
  { num: 4, label: 'Definir valor', dica: 'Valor do aluguel e do caução (garantia). Já vem preenchido com o valor da moto.' },
  { num: 5, label: 'Gerar contrato', dica: 'Confira o resumo do contrato que será criado.' },
  { num: 6, label: 'Registrar pagamento', dica: 'Como o cliente pagou a primeira parcela e se o dinheiro já entrou.' },
  { num: 7, label: 'Confirmar aluguel', dica: 'Confirma tudo: a moto fica alugada, o contrato e a cobrança são criados.' },
];

export const AlugueisView: React.FC = () => {
  const {
    alugueis,
    contratos,
    clientes,
    motos,
    navigateToCliente,
    navigateToMoto,
    setSelectedContratoId,
    assinarContrato,
    createFullAluguel,
    finalizarAluguel,
    config,
  } = useApp();

  const [filtro, setFiltro] = useState<Filtro>('Todos');
  const [wizardOpen, setWizardOpen] = useState(false);
  const [step, setStep] = useState(1);
  const [salvando, setSalvando] = useState(false);

  // Wizard State (7 etapas)
  const clientesLivres = clientes.filter((c) => !c.contratoAtualId);
  const availableMotos = motos.filter((m) => m.status === 'DISPONÍVEL');
  const [selectedClienteId, setSelectedClienteId] = useState<string>('');
  const [selectedMotoId, setSelectedMotoId] = useState<string>('');
  const [plano, setPlano] = useState<'Semanal' | 'Mensal' | 'Anual'>('Mensal');
  const [dataInicio, setDataInicio] = useState(formatBR(new Date()));
  const [dataPrevista, setDataPrevista] = useState(formatBR(somarMeses(new Date(), 6)));
  const [valorMensal, setValorMensal] = useState(0);
  const [caucao, setCaucao] = useState(config.caucaoPadrao);
  const [formaPagamento, setFormaPagamento] = useState<FormaPagamento>('PIX');
  const [pagamentoConfirmado, setPagamentoConfirmado] = useState(true);

  const valorDoPlano = (motoId: string, p: typeof plano) => {
    const m = motos.find((x) => x.id === motoId);
    if (!m) return 0;
    return p === 'Semanal' ? m.valorSemanal : m.valorMensal;
  };

  const abrirWizard = () => {
    const moto = availableMotos[0];
    setSelectedClienteId(clientesLivres[0]?.id ?? '');
    setSelectedMotoId(moto?.id ?? '');
    setPlano('Mensal');
    setValorMensal(moto?.valorMensal ?? 0);
    setDataInicio(formatBR(new Date()));
    setDataPrevista(formatBR(somarMeses(new Date(), 6)));
    setCaucao(config.caucaoPadrao);
    setPagamentoConfirmado(true);
    setStep(1);
    setWizardOpen(true);
  };

  const handleFinalizar = async (aluguelId: string, motoId: string) => {
    const moto = motos.find((m) => m.id === motoId);
    const resposta = window.prompt(
      'Finalizar aluguel e liberar a moto.\n\nKm no painel da moto na devolução (deixe como está se não souber):',
      moto ? String(Math.round(moto.kmAtual)) : ''
    );
    if (resposta === null) return;
    const km = Number(resposta.replace(/\D/g, ''));
    await finalizarAluguel(aluguelId, resposta.trim() && km > 0 ? km : undefined);
  };

  const ctrPorId = new Map(contratos.map((c) => [c.id, c]));
  const usados = new Set(alugueis.map((a) => a.contratoId));
  const linhas: Linha[] = [
    ...alugueis.map((alu) => ({ id: alu.id, alu, ctr: ctrPorId.get(alu.contratoId) })),
    ...contratos.filter((c) => !usados.has(c.id)).map((ctr) => ({ id: ctr.id, ctr })),
  ];
  const linhasFiltradas = linhas.filter((l) => passaNoFiltro(l, filtro));
  const contar = (f: Filtro) => linhas.filter((l) => passaNoFiltro(l, f)).length;

  const emAndamento = alugueis.filter((a) => a.status === 'Ativo' || a.status === 'Atrasado');
  const kmEmAndamento = emAndamento.reduce((t, a) => t + (ctrPorId.get(a.contratoId)?.kmRodados ?? 0), 0);
  const resumo: Array<{ rotulo: string; valor: string; cor: string; filtro: Filtro; dica: string }> = [
    {
      rotulo: 'EM ANDAMENTO',
      valor: String(emAndamento.length),
      cor: 'text-[#0B0B0B]',
      filtro: 'Ativos',
      dica: 'Motos que estão com clientes agora (em dia + atrasados).',
    },
    {
      rotulo: 'ATRASADOS',
      valor: String(contar('Atrasados')),
      cor: 'text-[#E50914]',
      filtro: 'Atrasados',
      dica: 'Aluguéis com pagamento ou devolução atrasada. Clique para ver só eles.',
    },
    {
      rotulo: 'AGUARDANDO ASSINATURA',
      valor: String(contar('Aguardando assinatura')),
      cor: 'text-[#087BFF]',
      filtro: 'Aguardando assinatura',
      dica: 'Contratos que ainda precisam ser assinados pelo cliente. Clique para ver só eles.',
    },
    {
      rotulo: 'KM COM OS CLIENTES',
      valor: `${Math.round(kmEmAndamento).toLocaleString('pt-BR')} km`,
      cor: 'text-[#0B0B0B]',
      filtro: 'Ativos',
      dica: 'Soma dos km rodados pelos clientes nos aluguéis em andamento (GPS ou leitura do painel).',
    },
  ];

  const handleSaveAluguel = async () => {
    setSalvando(true);
    const ok = await createFullAluguel({
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
    setSalvando(false);
    if (ok) {
      setWizardOpen(false);
      setStep(1);
    }
  };

  const chosenCli = clientes.find((c) => c.id === selectedClienteId);
  const chosenMoto = motos.find((m) => m.id === selectedMotoId);

  return (
    <div className="space-y-6">
      {/* HEADER */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <p className="text-xs font-semibold text-[#E50914] tracking-wide">
            LOCAÇÕES, CONTRATOS E QUILOMETRAGEM
          </p>
          <h1 className="mt-1 text-2xl sm:text-3xl font-extrabold tracking-tight text-[#0B0B0B]">
            Aluguéis e Contratos
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            Cada aluguel já vem com o seu contrato: alugue, assine, acompanhe os km e receba a moto de volta.
          </p>
        </div>

        <button
          onClick={abrirWizard}
          data-dica="Passo a passo para alugar uma moto: escolha o cliente e a moto, defina período e valor — o contrato e a cobrança são criados sozinhos."
          className="flex items-center justify-center gap-2 rounded-xl bg-[#E50914] px-4 py-2.5 text-xs font-semibold text-white hover:bg-red-700 transition-colors whitespace-nowrap shadow-xs"
        >
          <Plus className="h-4 w-4" />
          Novo aluguel
        </button>
      </div>

      {/* RESUMO */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {resumo.map((r) => (
          <button
            key={r.rotulo}
            onClick={() => setFiltro(r.filtro)}
            data-dica={r.dica}
            className="text-left rounded-xl border border-slate-200 bg-white p-4 hover:border-slate-300 hover:shadow-sm transition-all"
          >
            <span className="text-[11px] font-semibold text-slate-500 tracking-wide">{r.rotulo}</span>
            <p className={`mt-1.5 text-xl sm:text-2xl font-extrabold font-mono-tabular ${r.cor}`}>{r.valor}</p>
          </button>
        ))}
      </div>

      {/* FILTROS DE SITUAÇÃO */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-1 p-1 bg-slate-200/70 rounded-xl overflow-x-auto max-w-full">
          {FILTROS.map((f) => (
            <button
              key={f.id}
              onClick={() => setFiltro(f.id)}
              data-dica={f.dica}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap ${
                filtro === f.id
                  ? 'bg-[#0B0B0B] text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {f.id}
            </button>
          ))}
        </div>

        <span className="text-xs text-slate-500 font-mono-tabular">
          Exibindo {linhasFiltradas.length} de {linhas.length}
        </span>
      </div>

      {linhasFiltradas.length === 0 && (
        <div className="rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-500">
          Nada neste filtro. Para alugar uma moto, clique em <strong>Novo aluguel</strong>.
        </div>
      )}

      {/* TABELA ÚNICA: ALUGUEL + CONTRATO */}
      {linhasFiltradas.length > 0 && (
        <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/80 text-[11px] font-semibold text-slate-500">
                  <th className="py-3.5 px-5">
                    <span data-dica="Número do contrato e nome do cliente. Clique no nome para abrir o cadastro.">
                      Contrato / Cliente
                    </span>
                  </th>
                  <th className="py-3.5 px-4">
                    <span data-dica="Moto alugada. Clique para abrir a ficha da moto.">Moto</span>
                  </th>
                  <th className="py-3.5 px-4">
                    <span data-dica="Data em que o cliente pegou a moto → data prevista para terminar o contrato.">
                      Período
                    </span>
                  </th>
                  <th className="py-3.5 px-4 text-right">
                    <span data-dica="Valor do aluguel (por semana ou por mês) e o caução deixado como garantia.">
                      Valor
                    </span>
                  </th>
                  <th className="py-3.5 px-4 text-right">
                    <span data-dica="Quantos km o cliente já rodou com a moto neste contrato. A cada ciclo (ex.: 1.000 km) o sistema cobra automaticamente.">
                      Km com o cliente
                    </span>
                  </th>
                  <th className="py-3.5 px-4">
                    <span data-dica="Situação do aluguel (em dia, atrasado, finalizado) e do contrato (assinado ou não).">
                      Situação
                    </span>
                  </th>
                  <th className="py-3.5 px-5 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
              {linhasFiltradas.length === 0 && (
                <tr>
                  <td colSpan={12} className="py-10 px-4 text-center text-sm text-slate-500">
                    Nenhum aluguel ainda. Cadastre uma moto e um cliente e depois use Novo aluguel.
                  </td>
                </tr>
              )}
                {linhasFiltradas.map(({ id, alu, ctr }) => {
                  const cli = clientes.find((c) => c.id === (alu?.clienteId ?? ctr?.clienteId));
                  const moto = motos.find((m) => m.id === (alu?.motoId ?? ctr?.motoId));
                  const plano = alu?.plano ?? ctr?.plano;
                  const valor = alu?.valorMensal ?? ctr?.valorMensal ?? 0;
                  const caucaoLinha = alu?.caucao ?? ctr?.caucao ?? 0;

                  const situacao = alu?.status ?? ctr?.status ?? '—';
                  const corSituacao =
                    situacao === 'Ativo'
                      ? 'text-emerald-600'
                      : situacao === 'Atrasado' || situacao === 'Vencido'
                      ? 'text-[#E50914]'
                      : situacao === 'Próximo' || situacao === 'Aguardando assinatura'
                      ? 'text-[#087BFF]'
                      : 'text-slate-400';
                  const aguardandoAssinatura = ctr?.status === 'Aguardando assinatura';
                  const contratoVencido = ctr?.status === 'Vencido' && alu && alu.status !== 'Finalizado';

                  return (
                    <tr key={id} className="hover:bg-slate-50/90 transition-colors">
                      <td className="py-3.5 px-5">
                        <span className="font-mono-tabular text-[11px] text-slate-400 block">
                          {ctr?.numero ?? '—'}
                          {alu && <span className="text-slate-300"> · {alu.codigo}</span>}
                        </span>
                        <button
                          onClick={() => cli && navigateToCliente(cli.id)}
                          data-dica="Abrir o cadastro deste cliente"
                          className="font-bold text-slate-900 text-sm hover:text-[#087BFF] transition-colors"
                        >
                          {cli?.nome || 'Cliente'}
                        </button>
                      </td>

                      <td className="py-3.5 px-4 whitespace-nowrap">
                        {moto ? (
                          <button
                            onClick={() => navigateToMoto(moto.id)}
                            data-dica="Abrir a ficha desta moto (km, GPS, manutenções)"
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
                        {alu?.dataInicio ?? ctr?.dataEmissao} → {alu?.dataPrevista ?? ctr?.dataVencimento}
                        {plano && <span className="block text-[11px] text-slate-400">Plano {plano}</span>}
                      </td>

                      <td className="py-3.5 px-4 text-right font-mono-tabular font-bold text-slate-900 whitespace-nowrap">
                        {brl(valor)}/{plano === 'Semanal' ? 'semana' : 'mês'}
                        {caucaoLinha > 0 && (
                          <span className="block text-[11px] font-normal text-slate-400">caução {brl(caucaoLinha)}</span>
                        )}
                      </td>

                      <td className="py-3.5 px-4 text-right font-mono-tabular text-slate-700 whitespace-nowrap">
                        {Math.round(ctr?.kmRodados ?? 0).toLocaleString('pt-BR')} km
                        {(ctr?.kmCiclosCobrados ?? 0) > 0 && (
                          <span className="block text-[11px] text-[#087BFF]">
                            {ctr?.kmCiclosCobrados} ciclo(s) cobrado(s)
                          </span>
                        )}
                      </td>

                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <span className={`font-semibold ${corSituacao}`}>{situacao}</span>
                        {aguardandoAssinatura && alu && (
                          <span className="block text-[11px] font-semibold text-[#087BFF]">Contrato não assinado</span>
                        )}
                        {contratoVencido && (
                          <span className="block text-[11px] font-semibold text-[#E50914]">Contrato vencido</span>
                        )}
                      </td>

                      <td className="py-3.5 px-5 text-right whitespace-nowrap">
                        <div className="inline-flex items-center gap-2">
                          {aguardandoAssinatura && ctr && (
                            <button
                              onClick={() => assinarContrato(ctr.id)}
                              data-dica="Marca o contrato como assinado. Clique depois que o cliente assinar o papel."
                              className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-emerald-500"
                            >
                              <PenLine className="h-3.5 w-3.5" />
                              Assinar
                            </button>
                          )}
                          {ctr && (
                            <button
                              onClick={() => setSelectedContratoId(ctr.id)}
                              data-dica="Abre o contrato completo para conferir ou imprimir."
                              className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                            >
                              <FileText className="h-3.5 w-3.5 text-[#087BFF]" />
                              Ver contrato
                            </button>
                          )}
                          {alu && alu.status !== 'Finalizado' && (
                            <button
                              onClick={() => handleFinalizar(alu.id, alu.motoId)}
                              data-dica="Use quando o cliente devolver a moto: encerra o aluguel e o contrato e deixa a moto livre para alugar de novo."
                              className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-semibold text-slate-600 hover:border-[#E50914] hover:text-[#E50914] transition-colors"
                            >
                              <Undo2 className="h-3.5 w-3.5" />
                              Devolver moto
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
      )}

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
                    data-dica={s.dica}
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
                  {clientesLivres.length === 0 && (
                    <p className="rounded-lg bg-amber-50 border border-amber-200 p-3 text-xs text-amber-800">
                      Nenhum cliente sem aluguel ativo. Cadastre um cliente em Clientes primeiro.
                    </p>
                  )}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-56 overflow-y-auto">
                    {clientesLivres.map((c) => (
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
                          {c.telefone} · CNH {c.cnh || '—'}
                        </p>
                        {!c.cpf && (
                          <p className="text-[11px] font-semibold text-amber-600 mt-0.5">
                            Sem CPF — complete o cadastro antes
                          </p>
                        )}
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
                  {availableMotos.length === 0 && (
                    <p className="rounded-lg bg-amber-50 border border-amber-200 p-3 text-xs text-amber-800">
                      Nenhuma moto disponível no momento.
                    </p>
                  )}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-56 overflow-y-auto">
                    {availableMotos.map((m) => (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => {
                          setSelectedMotoId(m.id);
                          setValorMensal(valorDoPlano(m.id, plano));
                        }}
                        className={`p-3 rounded-xl border text-left flex items-center gap-3 transition-all ${
                          selectedMotoId === m.id
                            ? 'border-[#087BFF] bg-blue-50/40'
                            : 'border-slate-200 hover:border-slate-300'
                        }`}
                      >
                        <FotoMoto
                          foto={m.foto}
                          alt={m.modelo}
                          iconeClassName="h-5 w-5"
                          className="h-12 w-16 rounded-lg object-cover shrink-0"
                        />
                        <div className="min-w-0">
                          <p className="text-xs font-bold text-slate-900 truncate">{m.modelo}</p>
                          <p className="text-[11px] text-slate-500 font-mono-tabular">
                            {m.placa} · {brl(m.valorMensal)}/mês · {Math.round(m.kmAtual).toLocaleString('pt-BR')} km
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
                        onChange={(e) => {
                          const p = e.target.value as 'Semanal' | 'Mensal' | 'Anual';
                          setPlano(p);
                          setValorMensal(valorDoPlano(selectedMotoId, p));
                        }}
                        className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-slate-900"
                      >
                        <option value="Semanal">Semanal</option>
                        <option value="Mensal">Mensal</option>
                        <option value="Anual">Anual Fidelidade</option>
                      </select>
                    </div>
                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">
                        Data de Início (dd/mm/aaaa)
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
                        Valor da locação por {plano === 'Semanal' ? 'semana' : 'mês'} (R$)
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
                        Cobrança por km: {config.cobrancaKm.ativo ? `${brl(config.cobrancaKm.valorPorCiclo)} a cada ${config.cobrancaKm.kmPorCiclo.toLocaleString('pt-BR')} km` : 'desligada'}
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
                      Vigência: {dataInicio} a {dataPrevista} · {plano} {brl(valorMensal)} · Caução {brl(caucao)}
                    </p>
                    <p className="text-slate-600">
                      Km de saída: <strong>{chosenMoto ? Math.round(chosenMoto.kmAtual).toLocaleString('pt-BR') : '—'} km</strong>
                      {chosenMoto?.gpsImei ? ' · rastreador GPS ativo' : ' · moto sem GPS (lançar km manualmente)'}
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
                        onChange={(e) => setFormaPagamento(e.target.value as FormaPagamento)}
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
                      ) será vinculada a <strong>{chosenCli?.nome}</strong>, o contrato aparecerá
                      nesta tela e o lançamento será registrado no Financeiro.
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
                      disabled={salvando || !selectedClienteId || !selectedMotoId}
                      className="rounded-lg bg-[#E50914] px-5 py-2 text-xs font-semibold text-white hover:bg-red-700 shadow-xs disabled:opacity-50"
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
