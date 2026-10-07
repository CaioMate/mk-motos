import React, { useState } from 'react';
import { Plus, Wrench, X, ArrowUpRight, CheckCircle2, Satellite, MessageSquare, Paperclip, XCircle } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { ManutencaoItem, Moto, TipoManutencao } from '../types/mkMotos';
import { situacaoRevisao } from '../lib/indicadores';
import { brl } from '../lib/formato';
import { tempoRelativo } from '../lib/datas';

const TIPOS: TipoManutencao[] = ['Troca de óleo', 'Pneu', 'Freio', 'Relação', 'Revisão', 'Manutenção preventiva'];
const inputCls = 'w-full rounded-lg border border-slate-200 px-3 py-2 text-slate-900';

export const ManutencaoView: React.FC = () => {
  const {
    motos,
    clientes,
    manutencoes,
    config,
    navigateToMoto,
    registrarManutencao,
    concluirManutencao,
    aprovarComprovante,
    recusarComprovante,
    anexarComprovante,
    reenviarAvisoTroca,
  } = useApp();

  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState({
    motoId: '',
    tipo: 'Troca de óleo' as TipoManutencao,
    pecaId: '',
    km: 0,
    custo: 0,
    oficina: '',
    observacao: '',
    colocarEmManutencao: false,
  });
  const [concluindo, setConcluindo] = useState<ManutencaoItem | null>(null);
  const [conclusao, setConclusao] = useState({ custo: 0, oficina: '', observacao: '' });
  const [salvando, setSalvando] = useState(false);

  // Comprovantes a conferir primeiro
  const abertas = manutencoes
    .filter((m) => !m.concluida)
    .sort((a, b) => Number(b.situacao === 'em_analise') - Number(a.situacao === 'em_analise'));
  const historico = manutencoes.filter((m) => m.concluida);
  const emOficina = motos.filter((m) => m.status === 'MANUTENÇÃO').length;
  const revisaoProxima = motos.filter((m) => situacaoRevisao(m).proxima).length;
  const revisaoVencida = motos.filter((m) => m.status !== 'MANUTENÇÃO' && situacaoRevisao(m).vencida).length;
  const emDia = motos.length - revisaoProxima - revisaoVencida - emOficina;
  const custoTotal = historico.reduce((s, m) => s + m.custo, 0);

  /** Quanto falta para cada peça do plano nesta moto. */
  const proximaPeca = (moto: Moto) => {
    const itens = config.planoPecas
      .map((pc) => {
        const base = moto.pecasUltimaTrocaKm?.[pc.id];
        if (base === undefined) return null;
        return { peca: pc, falta: pc.intervaloKm - (moto.kmAtual - base) };
      })
      .filter((x): x is { peca: (typeof config.planoPecas)[number]; falta: number } => !!x)
      .sort((a, b) => a.falta - b.falta);
    return itens[0];
  };

  const abrirNova = () => {
    const m = motos[0];
    setForm({
      motoId: m?.id ?? '',
      tipo: 'Troca de óleo',
      pecaId: config.planoPecas.find((p) => p.tipo === 'Troca de óleo')?.id ?? '',
      km: m ? Math.round(m.kmAtual) : 0,
      custo: 0,
      oficina: '',
      observacao: '',
      colocarEmManutencao: false,
    });
    setModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSalvando(true);
    const ok = await registrarManutencao({
      motoId: form.motoId,
      tipo: form.tipo,
      pecaId: form.pecaId || undefined,
      kmNaManutencao: Number(form.km),
      custo: Number(form.custo),
      oficina: form.oficina,
      observacao: form.observacao,
      colocarEmManutencao: form.colocarEmManutencao,
    });
    setSalvando(false);
    if (ok) setModalOpen(false);
  };

  const handleConcluir = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!concluindo) return;
    setSalvando(true);
    const ok = await concluirManutencao({ manutencaoId: concluindo.id, ...conclusao, custo: Number(conclusao.custo) });
    setSalvando(false);
    if (ok) setConcluindo(null);
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
            Trocas de óleo e peças calculadas pela quilometragem do GPS, revisões e histórico de serviços.
          </p>
        </div>

        <button
          onClick={abrirNova}
          className="flex items-center justify-center gap-2 rounded-xl bg-[#E50914] px-4 py-2.5 text-xs font-semibold text-white hover:bg-red-700 transition-colors whitespace-nowrap shadow-xs"
        >
          <Plus className="h-4 w-4" />
          Registrar manutenção
        </button>
      </div>

      {/* INDICADORES */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <span className="text-xs font-semibold text-slate-500">Revisão em dia</span>
          <p className="mt-2 text-2xl sm:text-3xl font-extrabold text-emerald-600 font-mono-tabular">{Math.max(emDia, 0)}</p>
          <p className="mt-1 text-xs text-slate-500">Mais de 500 km até a revisão</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <span className="text-xs font-semibold text-slate-500">Revisão próxima</span>
          <p className="mt-2 text-2xl sm:text-3xl font-extrabold text-[#087BFF] font-mono-tabular">{revisaoProxima}</p>
          <p className="mt-1 text-xs text-slate-500">Faltam menos de 500 km</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <span className="text-xs font-semibold text-slate-500">Revisão vencida</span>
          <p className="mt-2 text-2xl sm:text-3xl font-extrabold text-[#E50914] font-mono-tabular">{revisaoVencida}</p>
          <p className="mt-1 text-xs text-slate-500">Convocar o condutor</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <span className="text-xs font-semibold text-slate-500">Na oficina</span>
          <p className="mt-2 text-2xl sm:text-3xl font-extrabold text-amber-600 font-mono-tabular">{emOficina}</p>
          <p className="mt-1 text-xs text-slate-500">Status MANUTENÇÃO</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <span className="text-xs font-semibold text-slate-500">Gasto com oficina</span>
          <p className="mt-2 text-xl font-extrabold text-slate-900 font-mono-tabular">{brl(custoTotal)}</p>
          <p className="mt-1 text-xs text-slate-500">{historico.length} serviços concluídos</p>
        </div>
      </div>

      {/* ORDENS EM ABERTO (AUTOMÁTICAS E MANUAIS) */}
      <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
          <h2 className="text-sm font-bold text-slate-900">Trocas e serviços pendentes ({abertas.length})</h2>
          <span className="text-xs text-slate-500">O cliente troca na oficina credenciada e manda o comprovante pelo WhatsApp</span>
        </div>
        <div className="divide-y divide-slate-100 text-xs">
          {abertas.map((item) => {
            const moto = motos.find((m) => m.id === item.motoId);
            const cli = clientes.find((c) => c.id === moto?.clienteAtualId);
            const oficina = config.oficinas.find((o) => o.id === item.oficinaId);
            const kmAlem = moto ? Math.round(moto.kmAtual - item.kmNaManutencao) : 0;
            const situacao =
              item.situacao === 'em_analise'
                ? { rotulo: 'Comprovante recebido — conferir', cor: 'bg-blue-100 text-blue-800' }
                : item.situacao === 'aguardando_comprovante'
                ? { rotulo: `Aguardando comprovante${kmAlem > 0 ? ` (+${kmAlem} km)` : ''}`, cor: kmAlem >= config.trocas.toleranciaKm ? 'bg-red-100 text-red-800' : 'bg-amber-100 text-amber-800' }
                : { rotulo: 'Na oficina', cor: 'bg-slate-100 text-slate-700' };
            return (
              <div key={item.id} className="px-6 py-4 space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      {item.origem === 'automatica' && <Satellite className="h-3.5 w-3.5 text-[#087BFF]" />}
                      <span className="font-bold text-slate-900">{item.tipo}</span>
                      <span>·</span>
                      <button onClick={() => moto && navigateToMoto(moto.id)} className="font-semibold text-[#087BFF] hover:underline">
                        {moto?.modelo} ({moto?.placa})
                      </button>
                      <span className={`rounded-md px-2 py-0.5 text-[11px] font-semibold ${situacao.cor}`}>{situacao.rotulo}</span>
                    </div>
                    <p className="text-slate-500 mt-0.5">{item.observacao}</p>
                    <p className="text-slate-500 mt-0.5">
                      {cli ? `Cliente: ${cli.nome} · ` : ''}
                      {oficina ? `Oficina: ${oficina.nome} · ` : ''}desde {item.data}
                      {item.avisosEnviados ? ` · ${item.avisosEnviados} aviso(s) por WhatsApp` : ''}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-1.5 self-start">
                    {cli && item.situacao === 'aguardando_comprovante' && (
                      <button
                        onClick={() => reenviarAvisoTroca(item.id)}
                        className="inline-flex items-center gap-1 rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 py-1.5 font-semibold text-emerald-800 hover:bg-emerald-100 whitespace-nowrap"
                      >
                        <MessageSquare className="h-3.5 w-3.5" /> Reenviar aviso
                      </button>
                    )}
                    <label className="inline-flex cursor-pointer items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1.5 font-semibold text-slate-700 hover:bg-slate-50 whitespace-nowrap">
                      <Paperclip className="h-3.5 w-3.5" /> Anexar comprovante
                      <input
                        type="file"
                        accept="image/jpeg,image/png,image/webp,application/pdf"
                        className="hidden"
                        onChange={(e) => {
                          const f = e.target.files?.[0];
                          if (f) anexarComprovante(item.id, f);
                          e.target.value = '';
                        }}
                      />
                    </label>
                    <button
                      onClick={() => {
                        setConclusao({ custo: item.custo, oficina: item.oficina, observacao: '' });
                        setConcluindo(item);
                      }}
                      className="inline-flex items-center gap-1 rounded-lg bg-[#0B0B0B] px-3 py-1.5 font-semibold text-white hover:bg-emerald-600 whitespace-nowrap"
                    >
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      Concluir sem comprovante
                    </button>
                  </div>
                </div>

                {(item.comprovantes ?? []).map((comp) => (
                  <div key={comp.id} className={`flex flex-col sm:flex-row gap-3 rounded-xl border p-3 ${comp.status === 'pendente' ? 'border-blue-200 bg-blue-50/40' : 'border-slate-200 bg-slate-50/60'}`}>
                    <a href={`/api/comprovantes/${comp.arquivo}`} target="_blank" rel="noreferrer" className="shrink-0">
                      {comp.mime === 'application/pdf' ? (
                        <div className="flex h-24 w-20 items-center justify-center rounded-lg border border-slate-200 bg-white font-bold text-[#E50914]">PDF</div>
                      ) : (
                        <img src={`/api/comprovantes/${comp.arquivo}`} alt="Comprovante" className="h-24 w-20 rounded-lg border border-slate-200 object-cover" />
                      )}
                    </a>
                    <div className="flex-1 space-y-1">
                      <p className="font-semibold text-slate-900">
                        Comprovante via {comp.origem === 'whatsapp' ? 'WhatsApp' : 'sistema'} · {tempoRelativo(comp.recebidoEm)} ·{' '}
                        <span className={comp.status === 'aprovado' ? 'text-emerald-600' : comp.status === 'recusado' ? 'text-[#E50914]' : 'text-[#087BFF]'}>
                          {comp.status === 'pendente' ? 'aguardando sua conferência' : comp.status}
                        </span>
                      </p>
                      {comp.analise ? (
                        <div className="text-slate-600">
                          <p>
                            <strong>Leitura da IA:</strong> {comp.analise.estabelecimento || 'estabelecimento não identificado'} ·{' '}
                            {comp.analise.data || 'sem data'} · {comp.analise.valorTotal != null ? brl(comp.analise.valorTotal) : 'sem valor'}
                            {comp.analise.km != null ? ` · ${comp.analise.km.toLocaleString('pt-BR')} km` : ''}
                          </p>
                          {comp.analise.servicos.length > 0 && <p>Serviços: {comp.analise.servicos.join(', ')}</p>}
                          <p className={comp.analise.ehComprovante && comp.analise.confereComOficina ? 'text-emerald-700' : 'text-amber-700'}>
                            {!comp.analise.ehComprovante ? '⚠ Não parece ser um comprovante. ' : !comp.analise.confereComOficina ? '⚠ Oficina diferente da credenciada. ' : '✓ Confere com a oficina. '}
                            {comp.analise.observacao}
                          </p>
                        </div>
                      ) : (
                        <p className="text-slate-500">Sem leitura automática (configure a IA em Configurações → WhatsApp e agente). Abra a imagem para conferir.</p>
                      )}
                      {comp.motivoRecusa && <p className="text-[#E50914]">Motivo da recusa: {comp.motivoRecusa}</p>}
                    </div>
                    {comp.status === 'pendente' && (
                      <div className="flex sm:flex-col gap-1.5 self-start">
                        <button
                          onClick={() => aprovarComprovante(item.id, comp.id)}
                          className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-3 py-1.5 font-semibold text-white hover:bg-emerald-500 whitespace-nowrap"
                        >
                          <CheckCircle2 className="h-3.5 w-3.5" /> Aprovar
                        </button>
                        <button
                          onClick={() => {
                            const motivo = window.prompt('Motivo da recusa (vai para o cliente pelo WhatsApp):', 'o comprovante não é da oficina credenciada');
                            if (motivo !== null) recusarComprovante(item.id, comp.id, motivo);
                          }}
                          className="inline-flex items-center gap-1 rounded-lg border border-slate-300 bg-white px-3 py-1.5 font-semibold text-slate-700 hover:border-[#E50914] hover:text-[#E50914] whitespace-nowrap"
                        >
                          <XCircle className="h-3.5 w-3.5" /> Recusar
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            );
          })}
          {abertas.length === 0 && <p className="px-6 py-6 text-center text-slate-500">Nenhum serviço pendente ✓</p>}
        </div>
      </div>

      {/* TABELA DE MONITORAMENTO POR MOTO */}
      <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
          <h2 className="text-sm font-bold text-slate-900">Situação de cada motocicleta</h2>
          <span className="text-xs text-slate-500">Revisão a cada {config.cicloRevisaoKm.toLocaleString('pt-BR')} km</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/80 text-[11px] font-semibold text-slate-500">
                <th className="py-3.5 px-5">Moto</th>
                <th className="py-3.5 px-4 text-right">Km atual</th>
                <th className="py-3.5 px-4">Última manutenção</th>
                <th className="py-3.5 px-4">Próxima troca do plano</th>
                <th className="py-3.5 px-5">Revisão</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs">
              {motos.map((m) => {
                const { falta: diffKm } = situacaoRevisao(m);
                const prox = proximaPeca(m);
                const statusLabel =
                  m.status === 'MANUTENÇÃO'
                    ? 'Na oficina'
                    : diffKm <= 0
                    ? `Atrasada (${Math.round(Math.abs(diffKm)).toLocaleString('pt-BR')} km)`
                    : diffKm <= 500
                    ? `Em ${Math.round(diffKm).toLocaleString('pt-BR')} km`
                    : `Em dia (faltam ${Math.round(diffKm).toLocaleString('pt-BR')} km)`;
                const statusColor =
                  m.status === 'MANUTENÇÃO' || diffKm <= 0 ? 'text-[#E50914]' : diffKm <= 500 ? 'text-amber-600' : 'text-emerald-600';

                return (
                  <tr key={m.id} className="hover:bg-slate-50/90 transition-colors">
                    <td className="py-3.5 px-5 whitespace-nowrap">
                      <button onClick={() => navigateToMoto(m.id)} className="inline-flex items-center gap-1.5 font-bold text-slate-900 hover:text-[#087BFF]">
                        <span>{m.modelo}</span>
                        <span className="font-mono-tabular text-slate-400">({m.placa})</span>
                        <ArrowUpRight className="h-3.5 w-3.5 text-[#087BFF]" />
                      </button>
                    </td>
                    <td className="py-3.5 px-4 text-right font-mono-tabular font-bold text-slate-900 whitespace-nowrap">
                      {Math.round(m.kmAtual).toLocaleString('pt-BR')} km
                    </td>
                    <td className="py-3.5 px-4 font-mono-tabular text-slate-600 whitespace-nowrap">{m.ultimaManutencaoData}</td>
                    <td className="py-3.5 px-4 whitespace-nowrap">
                      {prox ? (
                        <span className={`font-semibold ${prox.falta <= 0 ? 'text-[#E50914]' : prox.falta <= 200 ? 'text-amber-600' : 'text-slate-700'}`}>
                          {prox.peca.nome}: {prox.falta <= 0 ? 'vencida' : `em ${Math.round(prox.falta).toLocaleString('pt-BR')} km`}
                        </span>
                      ) : (
                        '—'
                      )}
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
            <h3 className="text-base font-bold text-slate-900">Histórico de serviços</h3>
            <p className="text-xs text-slate-500 mt-0.5">Peças e mão de obra por placa</p>
          </div>
          <Wrench className="h-4 w-4 text-slate-400" />
        </div>

        <div className="mt-3 divide-y divide-slate-100 text-xs">
          {historico.map((item) => {
            const moto = motos.find((m) => m.id === item.motoId);
            return (
              <div key={item.id} className="py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-slate-900">{item.tipo}</span>
                    <span>·</span>
                    <button onClick={() => moto && navigateToMoto(moto.id)} className="font-semibold text-[#087BFF] hover:underline">
                      {moto?.modelo} ({moto?.placa})
                    </button>
                    <span>·</span>
                    <span className="font-mono-tabular text-slate-500">{Math.round(item.kmNaManutencao).toLocaleString('pt-BR')} km</span>
                  </div>
                  <p className="text-slate-500 mt-0.5">
                    {item.observacao}
                    {item.oficina && <> — <strong>{item.oficina}</strong></>}
                  </p>
                </div>
                <div className="sm:text-right font-mono-tabular shrink-0">
                  <p className="font-bold text-slate-900">{brl(item.custo)}</p>
                  <p className="text-[11px] text-slate-400">{item.data}</p>
                </div>
              </div>
            );
          })}
          {historico.length === 0 && <p className="py-6 text-center text-slate-500">Nenhum serviço registrado ainda.</p>}
        </div>
      </div>

      {/* MODAL: REGISTRAR MANUTENÇÃO */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-xs">
          <div className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between bg-[#0B0B0B] px-6 py-4 text-white">
              <h2 className="text-base font-bold">Registrar serviço / manutenção</h2>
              <button onClick={() => setModalOpen(false)} className="text-slate-400 hover:text-white">
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Motocicleta</label>
                  <select
                    value={form.motoId}
                    onChange={(e) => {
                      const m = motos.find((x) => x.id === e.target.value);
                      setForm({ ...form, motoId: e.target.value, km: m ? Math.round(m.kmAtual) : form.km });
                    }}
                    className={inputCls}
                  >
                    {motos.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.modelo} ({m.placa})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Tipo de serviço</label>
                  <select
                    value={form.tipo}
                    onChange={(e) => {
                      const tipo = e.target.value as TipoManutencao;
                      const pecas = config.planoPecas.filter((p) => p.tipo === tipo);
                      setForm({ ...form, tipo, pecaId: pecas.length === 1 ? pecas[0].id : '' });
                    }}
                    className={inputCls}
                  >
                    {TIPOS.map((t) => (
                      <option key={t} value={t}>{t}</option>
                    ))}
                  </select>
                </div>

                <div className="col-span-2">
                  <label className="block font-semibold text-slate-700 mb-1">Item do plano de peças (zera o contador de km)</label>
                  <select value={form.pecaId} onChange={(e) => setForm({ ...form, pecaId: e.target.value })} className={inputCls}>
                    <option value="">— Nenhum / outro serviço —</option>
                    {config.planoPecas.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.nome} (a cada {p.intervaloKm.toLocaleString('pt-BR')} km)
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Km da moto no serviço</label>
                  <input type="number" required value={form.km} onChange={(e) => setForm({ ...form, km: Number(e.target.value) })} className={`${inputCls} font-mono-tabular`} />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Custo (R$)</label>
                  <input type="number" min={0} step="0.01" required value={form.custo} onChange={(e) => setForm({ ...form, custo: Number(e.target.value) })} className={`${inputCls} font-mono-tabular`} />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Oficina</label>
                  <input value={form.oficina} onChange={(e) => setForm({ ...form, oficina: e.target.value })} className={inputCls} />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Observações</label>
                  <input value={form.observacao} onChange={(e) => setForm({ ...form, observacao: e.target.value })} className={inputCls} />
                </div>
              </div>

              <label className="flex items-center gap-2.5 p-3 rounded-xl border border-slate-200 bg-slate-50 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.colocarEmManutencao}
                  onChange={(e) => setForm({ ...form, colocarEmManutencao: e.target.checked })}
                  className="h-4 w-4 accent-[#E50914]"
                />
                <span className="font-semibold text-slate-800">
                  A moto vai ficar na oficina (status MANUTENÇÃO até concluir o serviço)
                </span>
              </label>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button type="button" onClick={() => setModalOpen(false)} className="rounded-lg border border-slate-200 px-4 py-2 font-semibold text-slate-700">
                  Cancelar
                </button>
                <button type="submit" disabled={salvando} className="rounded-lg bg-[#E50914] px-4 py-2 font-semibold text-white hover:bg-red-700 disabled:opacity-50">
                  Salvar ✓
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: CONCLUIR SERVIÇO */}
      {concluindo && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between bg-[#0B0B0B] px-6 py-4 text-white">
              <h2 className="text-base font-bold">Concluir: {concluindo.tipo}</h2>
              <button onClick={() => setConcluindo(null)} className="text-slate-400 hover:text-white">
                <X className="h-5 w-5" />
              </button>
            </div>
            <form onSubmit={handleConcluir} className="p-6 space-y-4 text-xs">
              <p className="text-slate-600">{concluindo.observacao}</p>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Custo da oficina (R$)</label>
                  <input type="number" min={0} step="0.01" value={conclusao.custo} onChange={(e) => setConclusao({ ...conclusao, custo: Number(e.target.value) })} className={`${inputCls} font-mono-tabular`} />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Oficina</label>
                  <input value={conclusao.oficina} onChange={(e) => setConclusao({ ...conclusao, oficina: e.target.value })} className={inputCls} />
                </div>
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Observação</label>
                <input value={conclusao.observacao} onChange={(e) => setConclusao({ ...conclusao, observacao: e.target.value })} className={inputCls} />
              </div>
              <p className="text-[11px] text-slate-500">
                O contador desta peça volta a zero na km atual da moto. Se a moto estava na oficina, ela volta para ALUGADA (com cliente) ou DISPONÍVEL.
              </p>
              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button type="button" onClick={() => setConcluindo(null)} className="rounded-lg border border-slate-200 px-4 py-2 font-semibold text-slate-700">
                  Cancelar
                </button>
                <button type="submit" disabled={salvando} className="rounded-lg bg-emerald-600 px-4 py-2 font-semibold text-white hover:bg-emerald-500 disabled:opacity-50">
                  Concluir ✓
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
