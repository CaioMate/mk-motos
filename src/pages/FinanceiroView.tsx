import React, { useState } from 'react';
import { Plus, CheckCircle2, X, ArrowUpRight, MessageSquare, Trash2, Receipt } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { FormaPagamento, Pagamento } from '../types/mkMotos';
import { resumoFinanceiro, serieMensal } from '../lib/indicadores';
import { brl, brlCurto, linkWhatsApp, pct } from '../lib/formato';
import { competenciaDe, formatBR, parseBR, somarDias } from '../lib/datas';

type Filtro = 'Em aberto' | 'Atrasados' | 'Pagos' | 'Km e peças' | 'Todos';
const FORMAS: FormaPagamento[] = ['PIX', 'Boleto', 'Cartão', 'Transferência'];
const inputCls = 'w-full rounded-lg border border-slate-200 px-3 py-2 text-slate-900';

export const FinanceiroView: React.FC = () => {
  const {
    pagamentos,
    clientes,
    contratos,
    motos,
    estado,
    config,
    navigateToCliente,
    navigateToContrato,
    registrarPagamento,
    criarCobranca,
    cancelarCobranca,
  } = useApp();

  const [filtro, setFiltro] = useState<Filtro>('Em aberto');
  const [baixa, setBaixa] = useState<Pagamento | null>(null);
  const [formaBaixa, setFormaBaixa] = useState<FormaPagamento>('PIX');
  const [novaCobranca, setNovaCobranca] = useState(false);
  const [recebAvulso, setRecebAvulso] = useState(false);
  const [form, setForm] = useState({
    clienteId: '',
    valor: 0,
    vencimento: formatBR(somarDias(new Date(), 3)),
    descricao: '',
    formaPagamento: 'PIX' as FormaPagamento,
  });
  const [salvando, setSalvando] = useState(false);

  const fin = resumoFinanceiro(estado);
  const serie = serieMensal(estado, 6);
  const maxValor = Math.max(...serie.map((m) => Math.max(m.receita, m.despesas)), 1);
  const competenciaAtual = competenciaDe(new Date());

  const kpis = [
    { label: 'Recebido no mês', value: brlCurto(fin.recebidoMes), sub: competenciaAtual, accent: 'blue' },
    { label: 'Previsto no mês', value: brlCurto(fin.previstoMes), sub: 'Cobranças com vencimento no mês' },
    { label: 'A receber', value: brlCurto(fin.aReceber), sub: 'Dentro do prazo' },
    {
      label: 'Atrasado',
      value: brlCurto(fin.atrasado),
      sub: fin.clientesAtrasados ? `${fin.clientesAtrasados} cliente(s) em cobrança` : 'Ninguém em atraso',
      accent: 'red',
    },
    { label: 'Despesas do mês', value: brlCurto(fin.despesasMes), sub: 'Manutenções concluídas' },
    { label: 'Cobranças km/peças', value: brlCurto(fin.totalCobrancasKm), sub: 'Geradas pelo GPS (total)' },
  ];

  const ordenados = [...pagamentos].sort((a, b) => {
    const ordem = { Atrasado: 0, Pendente: 1, Pago: 2 } as const;
    if (ordem[a.status] !== ordem[b.status]) return ordem[a.status] - ordem[b.status];
    const va = parseBR(a.vencimento)?.getTime() ?? 0;
    const vb = parseBR(b.vencimento)?.getTime() ?? 0;
    return a.status === 'Pago' ? vb - va : va - vb;
  });
  const lista = ordenados.filter((p) => {
    if (filtro === 'Em aberto') return p.status !== 'Pago';
    if (filtro === 'Atrasados') return p.status === 'Atrasado';
    if (filtro === 'Pagos') return p.status === 'Pago';
    if (filtro === 'Km e peças') return p.tipo === 'Km rodado' || p.tipo === 'Peças / Manutenção';
    return true;
  });

  const mensagemCobranca = (p: Pagamento) => {
    const cli = clientes.find((c) => c.id === p.clienteId);
    const primeiroNome = cli?.nome.split(' ')[0] ?? '';
    return `Olá ${primeiroNome}! Aqui é da ${config.empresa.nome || 'MK Motos'}. ${
      p.status === 'Atrasado' ? 'Consta em aberto' : 'Lembrete de'
    } ${p.descricao ?? p.tipo ?? 'cobrança'} no valor de ${brl(p.valor)}, vencimento ${p.vencimento}.${
      config.empresa.pix ? ` Chave PIX: ${config.empresa.pix}.` : ''
    } Qualquer dúvida estamos à disposição.`;
  };

  const confirmarBaixa = async () => {
    if (!baixa) return;
    setSalvando(true);
    const ok = await registrarPagamento({
      pagamentoId: baixa.id,
      clienteId: baixa.clienteId,
      contratoId: baixa.contratoId,
      valor: baixa.valor,
      vencimento: baixa.vencimento,
      formaPagamento: formaBaixa,
    });
    setSalvando(false);
    if (ok) setBaixa(null);
  };

  const salvarForm = async (e: React.FormEvent) => {
    e.preventDefault();
    setSalvando(true);
    const ok = novaCobranca
      ? await criarCobranca({ ...form, valor: Number(form.valor) })
      : await registrarPagamento({ ...form, valor: Number(form.valor) });
    setSalvando(false);
    if (ok) {
      setNovaCobranca(false);
      setRecebAvulso(false);
    }
  };

  const abrirForm = (tipo: 'cobranca' | 'recebimento') => {
    setForm({
      clienteId: clientes.find((c) => c.contratoAtualId)?.id ?? clientes[0]?.id ?? '',
      valor: 0,
      vencimento: tipo === 'cobranca' ? formatBR(somarDias(new Date(), 3)) : formatBR(new Date()),
      descricao: '',
      formaPagamento: 'PIX',
    });
    setNovaCobranca(tipo === 'cobranca');
    setRecebAvulso(tipo === 'recebimento');
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
            Mensalidades geradas automaticamente, cobranças por km do GPS, peças e inadimplência.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            data-dica="Cria uma cobrança para um cliente (ex.: multa, dano, valor combinado). Ele pode ser avisado pelo WhatsApp."
            onClick={() => abrirForm('cobranca')}
            className="flex items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-xs font-semibold text-slate-800 hover:bg-slate-50 whitespace-nowrap"
          >
            <Receipt className="h-4 w-4" />
            Nova cobrança
          </button>
          <button
            data-dica="Registra um dinheiro que você recebeu e que não tinha cobrança criada."
            onClick={() => abrirForm('recebimento')}
            className="flex items-center justify-center gap-2 rounded-xl bg-[#E50914] px-4 py-2.5 text-xs font-semibold text-white hover:bg-red-700 transition-colors whitespace-nowrap shadow-xs"
          >
            <Plus className="h-4 w-4" />
            Recebimento avulso
          </button>
        </div>
      </div>

      {/* 6 INDICADORES FINANCEIROS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-4">
        {kpis.map((item, idx) => (
          <div key={idx} className="rounded-xl border border-slate-200 bg-white p-4 flex flex-col justify-between">
            <span className="text-xs font-semibold text-slate-500">{item.label}</span>
            <p
              className={`mt-2 text-xl font-extrabold font-mono-tabular ${
                item.accent === 'red' ? 'text-[#E50914]' : item.accent === 'blue' ? 'text-[#087BFF]' : 'text-[#0B0B0B]'
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
            <h2 className="text-base font-bold text-slate-900">Receita recebida vs. despesas de manutenção</h2>
            <p className="text-xs text-slate-500">
              Margem do mês: {pct(fin.margemMes)} · Inadimplência da carteira: {pct(fin.inadimplencia)}
            </p>
          </div>
          <div className="flex items-center gap-4 text-xs font-medium">
            <span className="flex items-center gap-1.5 text-slate-700">
              <span className="h-2.5 w-2.5 rounded-xs bg-[#087BFF]" />
              Receita
            </span>
            <span className="flex items-center gap-1.5 text-slate-700">
              <span className="h-2.5 w-2.5 rounded-xs bg-[#0B0B0B]" />
              Despesas
            </span>
          </div>
        </div>

        <div className="mt-6 grid grid-cols-6 gap-4 items-end h-44 border-b border-slate-200 pb-2">
          {serie.map((m) => (
            <div key={`${m.mes}-${m.ano}`} className="flex flex-col items-center justify-end h-full">
              <span className="mb-1 text-[11px] font-mono-tabular font-bold text-slate-800">
                {(m.receita / 1000).toFixed(1)}k
              </span>
              <div className="w-full flex items-end justify-center gap-1.5 h-full">
                <div
                  style={{ height: `${Math.round((m.receita / maxValor) * 100)}%` }}
                  className="w-5 sm:w-7 rounded-t-md bg-[#087BFF]"
                  title={`Receita ${m.rotulo}: ${brl(m.receita)}`}
                />
                <div
                  style={{ height: `${Math.round((m.despesas / maxValor) * 100)}%` }}
                  className="w-4 sm:w-5 rounded-t-md bg-[#0B0B0B]"
                  title={`Despesas ${m.rotulo}: ${brl(m.despesas)}`}
                />
              </div>
            </div>
          ))}
        </div>
        <div className="grid grid-cols-6 gap-4 pt-2 text-center">
          {serie.map((m) => (
            <span key={`${m.mes}-${m.ano}`} className="text-xs font-mono-tabular font-semibold text-slate-500">
              {m.rotulo}/{String(m.ano).slice(2)}
            </span>
          ))}
        </div>
      </div>

      {/* TABELA DE COBRANÇAS */}
      <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <h3 className="text-sm font-bold text-slate-900">Cobranças por cliente e contrato</h3>
          <div className="flex items-center gap-1 p-1 bg-slate-200/70 rounded-xl overflow-x-auto">
            {(['Em aberto', 'Atrasados', 'Km e peças', 'Pagos', 'Todos'] as Filtro[]).map((f) => (
              <button
                data-dica="Filtra os lançamentos pela situação."
                key={f}
                onClick={() => setFiltro(f)}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg whitespace-nowrap ${
                  filtro === f ? 'bg-[#0B0B0B] text-white' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {f}
              </button>
            ))}
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/80 text-[11px] font-semibold text-slate-500">
                <th className="py-3.5 px-5">Cliente</th>
                <th className="py-3.5 px-4">Descrição</th>
                <th className="py-3.5 px-4">Contrato / Moto</th>
                <th className="py-3.5 px-4 text-right">Valor</th>
                <th className="py-3.5 px-4">Vencimento</th>
                <th className="py-3.5 px-4">Status</th>
                <th className="py-3.5 px-5 text-right">Ação</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs">
              {lista.map((pag) => {
                const cli = clientes.find((c) => c.id === pag.clienteId);
                const ctr = contratos.find((c) => c.id === pag.contratoId);
                const moto = motos.find((m) => m.id === pag.motoId);
                const automatica = pag.tipo === 'Km rodado' || pag.tipo === 'Peças / Manutenção';

                const statusClass =
                  pag.status === 'Pago' ? 'text-emerald-600' : pag.status === 'Atrasado' ? 'text-[#E50914]' : 'text-amber-600';

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

                    <td className="py-3.5 px-4">
                      <span className={`font-semibold ${automatica ? 'text-[#087BFF]' : 'text-slate-800'}`}>
                        {pag.tipo ?? 'Mensalidade'}
                      </span>
                      <span className="block text-[11px] text-slate-500 max-w-[260px] truncate" title={pag.descricao}>
                        {pag.descricao ?? pag.competencia}
                      </span>
                    </td>

                    <td className="py-3.5 px-4 whitespace-nowrap">
                      {ctr ? (
                        <button
                          data-dica="Abrir o contrato ligado a esta cobrança."
                          onClick={() => navigateToContrato(ctr.id)}
                          className="inline-flex items-center gap-1 font-mono-tabular font-semibold text-[#087BFF] hover:underline"
                        >
                          <span>{ctr.numero}</span>
                          {moto && <span className="text-slate-500 font-normal">· {moto.placa}</span>}
                          <ArrowUpRight className="h-3 w-3" />
                        </button>
                      ) : (
                        '—'
                      )}
                    </td>

                    <td className="py-3.5 px-4 text-right font-mono-tabular font-bold text-slate-900 whitespace-nowrap">
                      {brl(pag.valor)}
                    </td>

                    <td className="py-3.5 px-4 font-mono-tabular text-slate-700 whitespace-nowrap">
                      {pag.vencimento}
                      {pag.dataPagamento && (
                        <span className="block text-[11px] text-slate-400">pago {pag.dataPagamento} · {pag.formaPagamento}</span>
                      )}
                    </td>

                    <td className="py-3.5 px-4 whitespace-nowrap">
                      <span className={`font-bold ${statusClass}`}>{pag.status}</span>
                    </td>

                    <td className="py-3.5 px-5 text-right whitespace-nowrap">
                      {pag.status !== 'Pago' ? (
                        <div className="inline-flex items-center gap-1.5">
                          {cli && (
                            <a
                              href={linkWhatsApp(cli.telefone, mensagemCobranca(pag))}
                              target="_blank"
                              rel="noreferrer"
                              title="Cobrar pelo WhatsApp"
                              className="inline-flex items-center rounded-lg border border-emerald-200 bg-emerald-50 p-1.5 text-emerald-700 hover:bg-emerald-100"
                            >
                              <MessageSquare className="h-3.5 w-3.5" />
                            </a>
                          )}
                          <button
                            data-dica="Marca esta cobrança como paga (dar baixa) quando o cliente pagar."
                            onClick={() => {
                              setFormaBaixa(pag.formaPagamento);
                              setBaixa(pag);
                            }}
                            className="inline-flex items-center gap-1 rounded-lg bg-[#0B0B0B] px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-600 transition-colors"
                          >
                            <CheckCircle2 className="h-3.5 w-3.5" />
                            Dar baixa
                          </button>
                          <button
                            onClick={() => {
                              if (window.confirm(`Cancelar a cobrança "${pag.descricao ?? pag.tipo}" de ${brl(pag.valor)}?`)) {
                                cancelarCobranca(pag.id);
                              }
                            }}
                            title="Cancelar cobrança"
                            className="inline-flex items-center rounded-lg border border-slate-200 p-1.5 text-slate-500 hover:border-[#E50914] hover:text-[#E50914]"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      ) : (
                        <span className="text-[11px] font-mono-tabular text-slate-400">Quitado ✓</span>
                      )}
                    </td>
                  </tr>
                );
              })}
              {lista.length === 0 && (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-slate-500">
                    Nenhuma cobrança neste filtro.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* MODAL: DAR BAIXA */}
      {baixa && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-xs">
          <div className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between bg-[#0B0B0B] px-6 py-4 text-white">
              <h2 className="text-base font-bold">Confirmar recebimento</h2>
              <button onClick={() => setBaixa(null)} className="text-slate-400 hover:text-white">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="p-6 space-y-4 text-xs">
              <p className="text-slate-700">
                <strong>{clientes.find((c) => c.id === baixa.clienteId)?.nome}</strong> — {baixa.descricao ?? baixa.tipo}
                <br />
                <span className="text-lg font-extrabold font-mono-tabular text-slate-900">{brl(baixa.valor)}</span>
              </p>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Forma de recebimento</label>
                <select value={formaBaixa} onChange={(e) => setFormaBaixa(e.target.value as FormaPagamento)} className={inputCls}>
                  {FORMAS.map((f) => (
                    <option key={f} value={f}>{f}</option>
                  ))}
                </select>
              </div>
              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button onClick={() => setBaixa(null)} className="rounded-lg border border-slate-200 px-4 py-2 font-semibold text-slate-700">
                  Cancelar
                </button>
                <button onClick={confirmarBaixa} disabled={salvando} className="rounded-lg bg-emerald-600 px-4 py-2 font-semibold text-white hover:bg-emerald-500 disabled:opacity-50">
                  Confirmar recebimento ✓
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: NOVA COBRANÇA / RECEBIMENTO AVULSO */}
      {(novaCobranca || recebAvulso) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between bg-[#0B0B0B] px-6 py-4 text-white">
              <h2 className="text-base font-bold">{novaCobranca ? 'Lançar nova cobrança' : 'Registrar recebimento avulso'}</h2>
              <button onClick={() => { setNovaCobranca(false); setRecebAvulso(false); }} className="text-slate-400 hover:text-white">
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={salvarForm} className="p-6 space-y-4 text-xs">
              <p className="text-slate-500">
                {novaCobranca
                  ? 'Ex.: multa, avaria, franquia de km extra. Fica em aberto até dar baixa.'
                  : 'Para mensalidades já lançadas, use "Dar baixa" na tabela.'}
              </p>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Cliente</label>
                <select required value={form.clienteId} onChange={(e) => setForm({ ...form, clienteId: e.target.value })} className={inputCls}>
                  {clientes.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.nome} ({c.status})
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Descrição</label>
                <input required value={form.descricao} onChange={(e) => setForm({ ...form, descricao: e.target.value })} className={inputCls} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Valor (R$)</label>
                  <input type="number" min={0.01} step="0.01" required value={form.valor || ''} onChange={(e) => setForm({ ...form, valor: Number(e.target.value) })} className={`${inputCls} font-mono-tabular font-bold`} />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">{novaCobranca ? 'Vencimento' : 'Data'} (dd/mm/aaaa)</label>
                  <input required value={form.vencimento} onChange={(e) => setForm({ ...form, vencimento: e.target.value })} className={`${inputCls} font-mono-tabular`} />
                </div>
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Forma de pagamento</label>
                <select value={form.formaPagamento} onChange={(e) => setForm({ ...form, formaPagamento: e.target.value as FormaPagamento })} className={inputCls}>
                  {FORMAS.map((f) => (
                    <option key={f} value={f}>{f}</option>
                  ))}
                </select>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button type="button" onClick={() => { setNovaCobranca(false); setRecebAvulso(false); }} className="rounded-lg border border-slate-200 px-4 py-2 font-semibold text-slate-700">
                  Cancelar
                </button>
                <button type="submit" disabled={salvando} className="rounded-lg bg-[#E50914] px-4 py-2 font-semibold text-white hover:bg-red-700 disabled:opacity-50">
                  {novaCobranca ? 'Lançar cobrança' : 'Confirmar recebimento ✓'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
