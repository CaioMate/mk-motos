import React, { useEffect, useState } from 'react';
import {
  Building2,
  Sliders,
  Satellite,
  Database,
  Gauge,
  Plus,
  Trash2,
  Copy,
  Send,
  Wrench,
  MapPin,
  MessageSquare,
  Search,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { ConfigSistema, Oficina, PecaPlano, TipoManutencao } from '../types/mkMotos';
import { brl, linkMapa } from '../lib/formato';
import { tempoRelativo } from '../lib/datas';

type ConfigSection = 'empresa' | 'cobranca' | 'trocas' | 'cerca' | 'whatsapp' | 'gps' | 'preferencias' | 'banco';
const TIPOS: TipoManutencao[] = ['Troca de óleo', 'Pneu', 'Freio', 'Relação', 'Revisão', 'Manutenção preventiva'];
const inputCls = 'w-full rounded-lg border border-slate-200 px-3 py-2 text-slate-900';

export const ConfiguracoesView: React.FC = () => {
  const {
    config,
    motos,
    estado,
    salvarConfig,
    apagarTudo,
    enviarMensagemWhatsApp,
    showToast,
  } = useApp();
  const integracoes = estado.integracoes;
  const [section, setSection] = useState<ConfigSection>('empresa');
  const [rascunho, setRascunho] = useState<ConfigSistema>(config);
  const [salvando, setSalvando] = useState(false);
  const [rede, setRede] = useState<string[]>([]);
  const [tokenGps, setTokenGps] = useState<string | null>(null);
  const [desconhecidos, setDesconhecidos] = useState<Array<{ id: string; ultimaVez: string }>>([]);
  const [teste, setTeste] = useState({ imei: '', lat: -23.5505, lon: -46.6333, odometro: '' });
  const [buscaCidade, setBuscaCidade] = useState('');
  const [resultadosCidade, setResultadosCidade] = useState<Array<{ nome: string; lat: number; lon: number }>>([]);

  const setOficina = (i: number, patch: Partial<Oficina>) =>
    setRascunho({ ...rascunho, oficinas: rascunho.oficinas.map((o, j) => (j === i ? { ...o, ...patch } : o)) });

  const setCidade = (i: number, raioKm: number) =>
    setRascunho({
      ...rascunho,
      cercaVirtual: { ...rascunho.cercaVirtual, cidades: rascunho.cercaVirtual.cidades.map((c, j) => (j === i ? { ...c, raioKm } : c)) },
    });

  const buscarCidade = async () => {
    if (!buscaCidade.trim()) return;
    try {
      const r = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&limit=5&countrycodes=br&accept-language=pt-BR&q=${encodeURIComponent(buscaCidade)}`
      );
      const lista = (await r.json()) as Array<{ display_name: string; lat: string; lon: string }>;
      setResultadosCidade(lista.map((x) => ({ nome: x.display_name.split(',').slice(0, 3).join(','), lat: Number(x.lat), lon: Number(x.lon) })));
      if (!lista.length) showToast('Nenhuma cidade encontrada', 'Tente "Cidade, UF".', true);
    } catch {
      showToast('Não foi possível buscar', 'Verifique a internet deste computador.', true);
    }
  };

  useEffect(() => setRascunho(config), [config]);

  useEffect(() => {
    if (section !== 'gps') return;
    fetch('/api/rede').then((r) => r.json()).then((r) => setRede(r.enderecos)).catch(() => {});
    fetch('/api/gps/token').then((r) => r.json()).then((r) => setTokenGps(r.token ?? null)).catch(() => {});
    const carregar = () =>
      fetch('/api/gps/desconhecidos').then((r) => r.json()).then(setDesconhecidos).catch(() => {});
    carregar();
    const t = setInterval(carregar, 10_000);
    return () => clearInterval(t);
  }, [section]);

  const salvar = async () => {
    setSalvando(true);
    await salvarConfig(rascunho);
    setSalvando(false);
  };

  const setPeca = (i: number, patch: Partial<PecaPlano>) =>
    setRascunho({ ...rascunho, planoPecas: rascunho.planoPecas.map((p, j) => (j === i ? { ...p, ...patch } : p)) });

  const copiar = (texto: string) => {
    navigator.clipboard?.writeText(texto).then(
      () => showToast('Copiado ✓', texto),
      () => showToast('Copie manualmente', texto)
    );
  };

  const enviarTeste = async () => {
    const corpo: Record<string, unknown> = { imei: teste.imei, lat: Number(teste.lat), lon: Number(teste.lon) };
    if (teste.odometro) corpo.odometroKm = Number(teste.odometro);
    const r = await fetch('/api/gps', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(tokenGps ? { 'X-GPS-Token': tokenGps } : {}) },
      body: JSON.stringify(corpo),
    });
    const j = await r.json();
    if (r.ok) showToast('Posição recebida ✓', `${j.placa}: +${j.kmSomados} km (total ${Math.round(j.kmAtual)} km)`);
    else showToast('GPS recusou a posição', j.erro, true);
  };

  const tabs: Array<{ id: ConfigSection; label: string; icon: React.ElementType }> = [
    { id: 'empresa', label: 'Dados da empresa', icon: Building2 },
    { id: 'cobranca', label: 'Cobrança por km', icon: Gauge },
    { id: 'trocas', label: 'Trocas e oficinas', icon: Wrench },
    { id: 'cerca', label: 'Área permitida', icon: MapPin },
    { id: 'whatsapp', label: 'WhatsApp e agente', icon: MessageSquare },
    { id: 'gps', label: 'GPS / Rastreadores', icon: Satellite },
    { id: 'preferencias', label: 'Preferências', icon: Sliders },
    { id: 'banco', label: 'Banco de dados', icon: Database },
  ];

  const urlBase = rede[0] ?? window.location.origin;
  const sufixoToken = tokenGps ? `?token=${tokenGps}` : '';
  const urlGps = `${urlBase}/api/gps${sufixoToken}`;
  const botaoSalvar = (
    <button
      onClick={salvar}
      disabled={salvando}
      className="rounded-xl bg-[#E50914] px-4 py-2.5 text-xs font-semibold text-white hover:bg-red-700 disabled:opacity-50"
    >
      Salvar alterações
    </button>
  );

  return (
    <div className="space-y-6">
      {/* HEADER */}
      <div className="border-b border-slate-200 pb-5">
        <p className="text-xs font-semibold text-[#E50914] tracking-wide">ADMINISTRAÇÃO DO SISTEMA</p>
        <h1 className="mt-1 text-2xl sm:text-3xl font-extrabold tracking-tight text-[#0B0B0B]">Configurações</h1>
        <p className="mt-1 text-sm text-slate-600">
          Dados da empresa, regras de cobrança automática, conexão dos rastreadores e banco de dados.
        </p>
      </div>

      {/* TABS */}
      <div className="flex flex-wrap items-center gap-1 p-1 bg-slate-200/70 rounded-xl max-w-fit">
        {tabs.map((t) => {
          const Icon = t.icon;
          const active = section === t.id;
          return (
            <button
              key={t.id}
              onClick={() => setSection(t.id)}
              className={`flex items-center gap-2 px-3.5 py-2 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap ${
                active ? 'bg-[#0B0B0B] text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Icon className="h-3.5 w-3.5" />
              {t.label}
            </button>
          );
        })}
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-6">
        {/* EMPRESA */}
        {section === 'empresa' && (
          <div className="space-y-5 max-w-2xl text-xs">
            <h2 className="text-base font-bold text-slate-900">Dados da empresa</h2>
            <p className="text-slate-500">Aparecem nos contratos, relatórios e mensagens de cobrança pelo WhatsApp.</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {(
                [
                  ['nome', 'Nome fantasia'],
                  ['cnpj', 'CNPJ'],
                  ['telefone', 'Telefone / WhatsApp'],
                  ['pix', 'Chave PIX para cobranças'],
                ] as const
              ).map(([campo, rotulo]) => (
                <div key={campo}>
                  <label className="block font-semibold text-slate-700 mb-1">{rotulo}</label>
                  <input
                    value={rascunho.empresa[campo]}
                    onChange={(e) => setRascunho({ ...rascunho, empresa: { ...rascunho.empresa, [campo]: e.target.value } })}
                    className={inputCls}
                  />
                </div>
              ))}
            </div>
            {botaoSalvar}
          </div>
        )}

        {/* COBRANÇA POR KM E PEÇAS */}
        {section === 'cobranca' && (
          <div className="space-y-6 text-xs">
            <div className="space-y-3 max-w-2xl">
              <h2 className="text-base font-bold text-slate-900">Cobrança automática por quilometragem (aluguel por km)</h2>
              <p className="text-slate-500">
                Quando o GPS (ou a leitura manual) somar o ciclo de km dentro de um contrato, o sistema gera
                sozinho uma cobrança para o cliente no Financeiro.
              </p>
              <label className="flex items-center gap-2.5 p-3 rounded-xl border border-slate-200 bg-slate-50 cursor-pointer max-w-md">
                <input
                  type="checkbox"
                  checked={rascunho.cobrancaKm.ativo}
                  onChange={(e) => setRascunho({ ...rascunho, cobrancaKm: { ...rascunho.cobrancaKm, ativo: e.target.checked } })}
                  className="h-4 w-4 accent-[#E50914]"
                />
                <span className="font-semibold text-slate-800">Cobrança por km ligada</span>
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Cobrar a cada (km)</label>
                  <input type="number" min={100} value={rascunho.cobrancaKm.kmPorCiclo} onChange={(e) => setRascunho({ ...rascunho, cobrancaKm: { ...rascunho.cobrancaKm, kmPorCiclo: Number(e.target.value) } })} className={`${inputCls} font-mono-tabular`} />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Valor por ciclo (R$)</label>
                  <input type="number" min={0} step="0.01" value={rascunho.cobrancaKm.valorPorCiclo} onChange={(e) => setRascunho({ ...rascunho, cobrancaKm: { ...rascunho.cobrancaKm, valorPorCiclo: Number(e.target.value) } })} className={`${inputCls} font-mono-tabular`} />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Vencimento (dias após gerar)</label>
                  <input type="number" min={0} value={rascunho.cobrancaKm.diasParaVencimento} onChange={(e) => setRascunho({ ...rascunho, cobrancaKm: { ...rascunho.cobrancaKm, diasParaVencimento: Number(e.target.value) } })} className={`${inputCls} font-mono-tabular`} />
                </div>
              </div>
              <p className="rounded-lg bg-blue-50 border border-blue-200 p-3 text-slate-700">
                Hoje: a cada <strong>{rascunho.cobrancaKm.kmPorCiclo.toLocaleString('pt-BR')} km</strong> rodados com o cliente, cobra{' '}
                <strong>{brl(rascunho.cobrancaKm.valorPorCiclo)}</strong>, vencendo em {rascunho.cobrancaKm.diasParaVencimento} dias.
              </p>
            </div>

            {botaoSalvar}
          </div>
        )}

        {/* TROCAS DE ÓLEO E PEÇAS */}
        {section === 'trocas' && (
          <div className="space-y-6 text-xs">
            <div className="rounded-xl border border-blue-200 bg-blue-50/60 p-4 text-slate-700 max-w-3xl">
              <strong className="text-slate-900">Como funciona:</strong> quando a moto atinge a km de uma troca, o sistema abre a ordem em
              Manutenção e manda no WhatsApp do cliente o endereço da oficina credenciada. O cliente faz a troca lá, <strong>paga direto na
              oficina</strong> e envia a foto do comprovante. A IA lê o comprovante e você aprova com um clique. O cliente não é cobrado pelo sistema.
            </div>

            <div className="space-y-3 max-w-3xl">
              <h2 className="text-base font-bold text-slate-900">Oficinas credenciadas</h2>
              {rascunho.oficinas.map((o, i) => (
                <div key={o.id} className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-center rounded-xl border border-slate-200 p-3">
                  <label className="sm:col-span-1 flex items-center gap-1.5" title="Oficina padrão">
                    <input type="radio" name="oficina-padrao" checked={rascunho.oficinaPadraoId === o.id} onChange={() => setRascunho({ ...rascunho, oficinaPadraoId: o.id })} className="h-4 w-4 accent-[#E50914]" />
                    <span className="sm:hidden">Padrão</span>
                  </label>
                  <input value={o.nome} placeholder="Nome da oficina" onChange={(e) => setOficina(i, { nome: e.target.value })} className={`${inputCls} sm:col-span-4`} />
                  <input value={o.endereco} placeholder="Endereço" onChange={(e) => setOficina(i, { endereco: e.target.value })} className={`${inputCls} sm:col-span-4`} />
                  <input value={o.telefone} placeholder="Telefone" onChange={(e) => setOficina(i, { telefone: e.target.value })} className={`${inputCls} sm:col-span-2`} />
                  <button
                    disabled={rascunho.oficinas.length === 1}
                    onClick={() => setRascunho({ ...rascunho, oficinas: rascunho.oficinas.filter((_, j) => j !== i) })}
                    className="sm:col-span-1 justify-self-start rounded-lg border border-slate-200 p-1.5 text-slate-500 hover:text-[#E50914] disabled:opacity-30"
                    title="Remover"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
              <p className="text-slate-500">A marcada (●) é a que o cliente recebe no aviso.</p>
              <button
                onClick={() => setRascunho({ ...rascunho, oficinas: [...rascunho.oficinas, { id: `oficina-${Date.now().toString(36)}`, nome: '', endereco: '', telefone: '' }] })}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 px-3 py-2 font-semibold text-slate-700 hover:bg-slate-50"
              >
                <Plus className="h-3.5 w-3.5" /> Adicionar oficina
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-xl">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Reenviar aviso a cada (km sem comprovante)</label>
                <input type="number" min={0} value={rascunho.trocas.lembreteACadaKm} onChange={(e) => setRascunho({ ...rascunho, trocas: { ...rascunho.trocas, lembreteACadaKm: Number(e.target.value) } })} className={`${inputCls} font-mono-tabular`} />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Me avisar quando passar de (km de atraso)</label>
                <input type="number" min={0} value={rascunho.trocas.toleranciaKm} onChange={(e) => setRascunho({ ...rascunho, trocas: { ...rascunho.trocas, toleranciaKm: Number(e.target.value) } })} className={`${inputCls} font-mono-tabular`} />
              </div>
            </div>

            <div className="space-y-3">
              <h2 className="text-base font-bold text-slate-900">Plano de troca de óleo e peças</h2>
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50 text-[11px] font-semibold text-slate-500">
                      <th className="py-2.5 px-3">Peça / serviço</th>
                      <th className="py-2.5 px-3">Tipo</th>
                      <th className="py-2.5 px-3">A cada (km)</th>
                      <th className="py-2.5 px-3">Avisar cliente e pedir comprovante</th>
                      <th className="py-2.5 px-3" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {rascunho.planoPecas.map((p, i) => (
                      <tr key={p.id}>
                        <td className="py-2 px-3"><input value={p.nome} onChange={(e) => setPeca(i, { nome: e.target.value })} className={inputCls} /></td>
                        <td className="py-2 px-3">
                          <select value={p.tipo} onChange={(e) => setPeca(i, { tipo: e.target.value as TipoManutencao })} className={inputCls}>
                            {TIPOS.map((t) => <option key={t} value={t}>{t}</option>)}
                          </select>
                        </td>
                        <td className="py-2 px-3"><input type="number" min={100} value={p.intervaloKm} onChange={(e) => setPeca(i, { intervaloKm: Number(e.target.value) })} className={`${inputCls} font-mono-tabular w-28`} /></td>
                        <td className="py-2 px-3 text-center"><input type="checkbox" checked={p.exigirComprovante} onChange={(e) => setPeca(i, { exigirComprovante: e.target.checked })} className="h-4 w-4 accent-[#E50914]" /></td>
                        <td className="py-2 px-3">
                          <button
                            onClick={() => setRascunho({ ...rascunho, planoPecas: rascunho.planoPecas.filter((_, j) => j !== i) })}
                            className="rounded-lg border border-slate-200 p-1.5 text-slate-500 hover:text-[#E50914]"
                            title="Remover"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <button
                onClick={() =>
                  setRascunho({
                    ...rascunho,
                    planoPecas: [
                      ...rascunho.planoPecas,
                      { id: `peca-${Date.now().toString(36)}`, nome: 'Nova peça', tipo: 'Manutenção preventiva', intervaloKm: 5000, exigirComprovante: true },
                    ],
                  })
                }
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 px-3 py-2 font-semibold text-slate-700 hover:bg-slate-50"
              >
                <Plus className="h-3.5 w-3.5" /> Adicionar peça ao plano
              </button>
            </div>
            {botaoSalvar}
          </div>
        )}

        {/* ÁREA PERMITIDA (CERCA VIRTUAL) */}
        {section === 'cerca' && (
          <div className="space-y-5 text-xs max-w-3xl">
            <h2 className="text-base font-bold text-slate-900">Cidades onde a moto pode circular</h2>
            <p className="text-slate-600">
              Se o GPS mostrar a moto fora de todas as cidades abaixo, o sistema avisa você e o cliente pelo WhatsApp na hora,
              e avisa de novo quando ela voltar. O raio define até onde vale cada cidade, a partir do centro.
            </p>
            <label className="flex items-center gap-2.5 p-3 rounded-xl border border-slate-200 bg-slate-50 cursor-pointer max-w-md">
              <input type="checkbox" checked={rascunho.cercaVirtual.ativo} onChange={(e) => setRascunho({ ...rascunho, cercaVirtual: { ...rascunho.cercaVirtual, ativo: e.target.checked } })} className="h-4 w-4 accent-[#E50914]" />
              <span className="font-semibold text-slate-800">Cerca virtual ligada</span>
            </label>

            <div className="space-y-2">
              {rascunho.cercaVirtual.cidades.map((c, i) => (
                <div key={c.id} className="flex flex-wrap items-center gap-3 rounded-xl border border-slate-200 p-3">
                  <MapPin className="h-4 w-4 text-[#087BFF]" />
                  <span className="font-semibold text-slate-900 flex-1 min-w-[180px]">{c.nome}</span>
                  <label className="flex items-center gap-1.5">
                    Raio
                    <input type="number" min={1} value={c.raioKm} onChange={(e) => setCidade(i, Number(e.target.value))} className={`${inputCls} w-20 font-mono-tabular`} />
                    km
                  </label>
                  <a href={linkMapa(c.lat, c.lon)} target="_blank" rel="noreferrer" className="font-semibold text-[#087BFF] hover:underline">mapa</a>
                  <button
                    onClick={() => setRascunho({ ...rascunho, cercaVirtual: { ...rascunho.cercaVirtual, cidades: rascunho.cercaVirtual.cidades.filter((_, j) => j !== i) } })}
                    className="rounded-lg border border-slate-200 p-1.5 text-slate-500 hover:text-[#E50914]"
                    title="Remover"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
              {rascunho.cercaVirtual.cidades.length === 0 && <p className="text-slate-500">Nenhuma cidade adicionada.</p>}
            </div>

            <div className="rounded-xl border border-slate-200 p-4 space-y-3">
              <h3 className="text-sm font-bold text-slate-900">Adicionar cidade</h3>
              <div className="flex gap-2">
                <input value={buscaCidade} onChange={(e) => setBuscaCidade(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && buscarCidade()} placeholder="Ex.: Guarulhos, SP" className={inputCls} />
                <button onClick={buscarCidade} className="inline-flex items-center gap-1.5 rounded-lg bg-[#0B0B0B] px-4 py-2 font-semibold text-white whitespace-nowrap">
                  <Search className="h-3.5 w-3.5" /> Buscar
                </button>
              </div>
              {resultadosCidade.map((r) => (
                <button
                  key={`${r.lat},${r.lon}`}
                  onClick={() => {
                    setRascunho({
                      ...rascunho,
                      cercaVirtual: {
                        ...rascunho.cercaVirtual,
                        cidades: [...rascunho.cercaVirtual.cidades, { id: `cid-${Date.now().toString(36)}`, nome: r.nome, lat: r.lat, lon: r.lon, raioKm: 20 }],
                      },
                    });
                    setResultadosCidade([]);
                    setBuscaCidade('');
                  }}
                  className="block w-full text-left rounded-lg border border-slate-200 p-2.5 hover:bg-slate-50"
                >
                  {r.nome}
                </button>
              ))}
              <p className="text-[11px] text-slate-500">Busca de cidades pelo OpenStreetMap (precisa de internet neste computador).</p>
            </div>
            {botaoSalvar}
          </div>
        )}

        {/* WHATSAPP E AGENTE */}
        {section === 'whatsapp' && (
          <div className="space-y-6 text-xs max-w-3xl">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className={`rounded-xl border p-4 ${integracoes.whatsappConfigurado ? 'border-emerald-200 bg-emerald-50' : 'border-amber-200 bg-amber-50'}`}>
                <p className="font-bold text-slate-900">WhatsApp (Meta)</p>
                <p className="mt-1">{integracoes.whatsappConfigurado ? 'Conectado ✓' : 'Não configurado'}</p>
              </div>
              <div className={`rounded-xl border p-4 ${integracoes.iaConfigurada ? 'border-emerald-200 bg-emerald-50' : 'border-amber-200 bg-amber-50'}`}>
                <p className="font-bold text-slate-900">
                  Agente de IA ({integracoes.iaProvedor === 'claude' ? 'Claude' : integracoes.iaProvedor === 'gemini' ? 'Gemini, grátis' : 'sem chave'})
                </p>
                <p className="mt-1">
                  {integracoes.iaProvedor === 'claude'
                    ? 'Ativo ✓ — lê comprovantes e responde'
                    : integracoes.iaProvedor === 'gemini'
                    ? 'Ativo ✓ — lê comprovantes e responde (plano grátis do Google; se falhar, usa o leitor de texto)'
                    : integracoes.iaProvedor === 'ocr'
                    ? 'Sem chave — respostas simples; fotos de comprovante lidas pelo leitor de texto grátis (PDF fica para você). Para IA grátis, coloque GEMINI_API_KEY no .env'
                    : 'Sem chave — respostas automáticas simples'}
                </p>
              </div>
              <div className="rounded-xl border border-slate-200 p-4">
                <p className="font-bold text-slate-900">Fila de envio</p>
                <p className="mt-1">{integracoes.filaPendente} mensagem(ns) aguardando</p>
              </div>
            </div>

            <div className="space-y-3 max-w-xl">
              <h2 className="text-base font-bold text-slate-900">Avisos automáticos</h2>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Seu WhatsApp (recebe os alertas: moto fora da área, comprovantes, trocas atrasadas)</label>
                <input value={rascunho.whatsapp.numeroDono} placeholder="(11) 99999-9999" onChange={(e) => setRascunho({ ...rascunho, whatsapp: { ...rascunho.whatsapp, numeroDono: e.target.value } })} className={`${inputCls} font-mono-tabular`} />
              </div>
              {(
                [
                  ['avisarTrocas', 'Avisar o cliente quando vencer troca de óleo/peça (com a oficina e pedindo o comprovante)'],
                  ['avisarCerca', 'Avisar cliente e dono quando a moto sair da área permitida'],
                  ['agenteResponde', 'O agente responde sozinho as mensagens dos clientes (desligado: só a equipe responde pelo sistema)'],
                ] as const
              ).map(([campo, rotulo]) => (
                <label key={campo} className="flex items-center gap-2.5 p-3 rounded-xl border border-slate-200 bg-slate-50 cursor-pointer">
                  <input type="checkbox" checked={rascunho.whatsapp[campo]} onChange={(e) => setRascunho({ ...rascunho, whatsapp: { ...rascunho.whatsapp, [campo]: e.target.checked } })} className="h-4 w-4 accent-[#E50914]" />
                  <span className="font-semibold text-slate-800">{rotulo}</span>
                </label>
              ))}
              <label
                data-dica="Quando o cliente manda o comprovante da troca, o sistema confere sozinho: oficina, data, km e se a foto já foi usada. Se tudo estiver certo, aprova e avisa o cliente; se algo não bater, ele fica na Manutenção para você decidir, com o motivo escrito."
                className="flex items-center gap-2.5 p-3 rounded-xl border border-slate-200 bg-slate-50 cursor-pointer"
              >
                <input type="checkbox" checked={rascunho.manutencao.aprovacaoAutomatica} onChange={(e) => setRascunho({ ...rascunho, manutencao: { ...rascunho.manutencao, aprovacaoAutomatica: e.target.checked } })} className="h-4 w-4 accent-[#E50914]" />
                <span className="font-semibold text-slate-800">Aprovar comprovantes de troca sozinho quando tudo conferir (precisa da IA ligada; desligado: você aprova um a um)</span>
              </label>
              {botaoSalvar}
            </div>

            <div className="space-y-3">
              <h2 className="text-base font-bold text-slate-900">Como conectar (uma vez)</h2>
              <ol className="space-y-3 list-decimal pl-5 text-slate-700">
                <li>
                  Em <strong>developers.facebook.com</strong> crie um app do tipo <em>Empresa</em> e adicione o produto <strong>WhatsApp</strong>.
                  Cadastre um número exclusivo da empresa (não pode estar em uso no WhatsApp comum).
                </li>
                <li>
                  No arquivo <code>.env</code> da pasta do sistema, preencha (veja o modelo em <code>.env.example</code>):
                  <pre className="mt-2 overflow-x-auto rounded-lg bg-slate-100 p-3 text-[11px]">{`WHATSAPP_TOKEN=token permanente do usuário do sistema
WHATSAPP_PHONE_NUMBER_ID=id do número (WhatsApp > Configuração da API)
WHATSAPP_VERIFY_TOKEN=uma senha qualquer que você inventa
WHATSAPP_APP_SECRET=chave secreta do app (Configurações do app > Básico)
GEMINI_API_KEY=chave GRÁTIS do Google (aistudio.google.com > Get API key; o Google pode usar os dados do plano grátis)
ANTHROPIC_API_KEY=(opcional, pago) chave da API do Claude (console.anthropic.com)`}</pre>
                  Depois feche e abra o sistema de novo.
                </li>
                <li>
                  O webhook precisa de um endereço na internet (HTTPS). Rode <strong>tunel-whatsapp.bat</strong>: ele mostra um endereço
                  <code> https://….trycloudflare.com</code>. Na Meta, em <em>WhatsApp → Configuração → Webhook</em>, use
                  <pre className="mt-2 rounded-lg bg-slate-100 p-3 text-[11px]">{`URL de callback: https://SEU-ENDERECO.trycloudflare.com/api/whatsapp/webhook
Token de verificação: o mesmo WHATSAPP_VERIFY_TOKEN
Campos: messages`}</pre>
                  Pela internet só o webhook e o GPS ficam acessíveis; o painel continua só na rede local.
                </li>
                <li>
                  Para mandar avisos a quem não falou com a empresa nas últimas 24h, a Meta exige um <strong>modelo aprovado</strong>.
                  Em <em>Gerenciador do WhatsApp → Modelos de mensagem</em> crie:
                  <pre className="mt-2 overflow-x-auto rounded-lg bg-slate-100 p-3 text-[11px]">{`Nome: aviso_mk_motos   Categoria: Utilidade   Idioma: Português (BR)
Corpo: Olá {{1}}! Aviso da {{2}}: {{3}}. Responda esta mensagem se tiver dúvidas.`}</pre>
                </li>
              </ol>
              <button
                disabled={!rascunho.whatsapp.numeroDono}
                onClick={() => enviarMensagemWhatsApp({ telefone: rascunho.whatsapp.numeroDono, texto: 'Teste do sistema MK Motos: o WhatsApp está funcionando' })}
                className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-4 py-2 font-semibold text-white hover:bg-emerald-500 disabled:opacity-40"
              >
                <Send className="h-3.5 w-3.5" /> Enviar mensagem de teste para o meu número
              </button>
            </div>
          </div>
        )}

        {/* GPS */}
        {section === 'gps' && (
          <div className="space-y-6 text-xs max-w-3xl">
            <div className="space-y-2">
              <h2 className="text-base font-bold text-slate-900">Como conectar os rastreadores GPS</h2>
              <p className="text-slate-600">
                O sistema recebe as posições pelo endereço abaixo, soma os km rodados de cada moto e dispara as cobranças e trocas de peças.
              </p>
              <div className="flex items-center gap-2 rounded-xl bg-[#0B0B0B] p-3 font-mono-tabular text-white">
                <span className="flex-1 break-all">{urlGps}</span>
                <button onClick={() => copiar(urlGps)} className="rounded-md bg-white/10 p-1.5 hover:bg-white/20" title="Copiar">
                  <Copy className="h-3.5 w-3.5" />
                </button>
              </div>
              {tokenGps && <p className="text-slate-500">O endereço acima já leva a senha dos rastreadores (<code>?token=</code>). Não divulgue; sem ela o sistema recusa as posições.</p>}
              {rede.length > 1 && <p className="text-slate-500">Outros endereços deste computador: {rede.slice(1).join(' · ')}</p>}
            </div>

            <ol className="space-y-3 list-decimal pl-5 text-slate-700">
              <li>
                <strong>Cadastre o IMEI</strong> de cada rastreador na moto (Frota → Editar / GPS). Motos com rastreador:{' '}
                <strong>{motos.filter((m) => m.gpsImei).length} de {motos.length}</strong>.
              </li>
              <li>
                <strong>Rastreador com app no celular (teste rápido):</strong> instale o app gratuito <em>Traccar Client</em> no celular,
                coloque como “Identificador do dispositivo” o mesmo IMEI cadastrado na moto e em “URL do servidor” o endereço acima. O celular
                precisa estar no mesmo Wi-Fi para testar na rede local.
              </li>
              <li>
                <strong>Rastreador veicular (GT06, TK103, Suntech, Coban…):</strong> esses aparelhos falam um protocolo próprio. Use o
                <em> Traccar Server</em> (gratuito) como ponte: o rastreador manda para o Traccar e o Traccar repassa para este sistema.
                No arquivo <code>traccar.xml</code> adicione:
                <pre className="mt-2 overflow-x-auto rounded-lg bg-slate-100 p-3 text-[11px]">{`<entry key='forward.enable'>true</entry>
<entry key='forward.json'>true</entry>
<entry key='forward.url'>${urlBase}/api/gps/traccar${sufixoToken}</entry>`}</pre>
              </li>
              <li>
                <strong>Plataforma do fornecedor do rastreador:</strong> se ela tiver “webhook” ou “API de posições”, configure para enviar
                JSON <code>{'{"imei": "...", "lat": -23.5, "lon": -46.6, "odometroKm": 1520}'}</code> para o endereço acima.
              </li>
              <li>
                <strong>Fora da rede local</strong> (motos na rua usando chip 4G): o computador do sistema precisa estar acessível pela internet
                (IP fixo/redirecionamento de porta, ou um túnel como Cloudflare Tunnel). Para testes na rede local isso não é necessário.
              </li>
            </ol>

            <div className="rounded-xl border border-slate-200 p-4 space-y-3">
              <h3 className="text-sm font-bold text-slate-900">Testar recebimento de posição</h3>
              <p className="text-slate-500">
                Simula um rastreador. Informe o IMEI cadastrado e um hodômetro (km) maior que o anterior para ver a soma de km e as cobranças acontecendo.
              </p>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <select value={teste.imei} onChange={(e) => setTeste({ ...teste, imei: e.target.value })} className={inputCls}>
                  <option value="">IMEI…</option>
                  {motos.filter((m) => m.gpsImei).map((m) => (
                    <option key={m.id} value={m.gpsImei}>{m.placa} · {m.gpsImei}</option>
                  ))}
                </select>
                <input type="number" step="0.0001" value={teste.lat} onChange={(e) => setTeste({ ...teste, lat: Number(e.target.value) })} className={`${inputCls} font-mono-tabular`} placeholder="Latitude" />
                <input type="number" step="0.0001" value={teste.lon} onChange={(e) => setTeste({ ...teste, lon: Number(e.target.value) })} className={`${inputCls} font-mono-tabular`} placeholder="Longitude" />
                <input type="number" value={teste.odometro} onChange={(e) => setTeste({ ...teste, odometro: e.target.value })} className={`${inputCls} font-mono-tabular`} placeholder="Hodômetro km (opcional)" />
              </div>
              <button onClick={enviarTeste} disabled={!teste.imei} className="inline-flex items-center gap-1.5 rounded-lg bg-[#087BFF] px-4 py-2 font-semibold text-white hover:bg-blue-600 disabled:opacity-40">
                <Send className="h-3.5 w-3.5" /> Enviar posição de teste
              </button>
            </div>

            <div className="rounded-xl border border-amber-200 bg-amber-50/60 p-4 space-y-2">
              <h3 className="text-sm font-bold text-slate-900">Rastreadores enviando sem cadastro</h3>
              {desconhecidos.length === 0 ? (
                <p className="text-slate-600">Nenhum. Quando um rastreador não cadastrado enviar posição, o IMEI dele aparece aqui.</p>
              ) : (
                desconhecidos.map((d) => (
                  <div key={d.id} className="flex items-center justify-between rounded-lg bg-white p-2.5 font-mono-tabular">
                    <span>{d.id}</span>
                    <span className="text-slate-500">{tempoRelativo(d.ultimaVez)}</span>
                    <button onClick={() => copiar(d.id)} className="text-[#087BFF] font-semibold">Copiar IMEI</button>
                  </div>
                ))
              )}
            </div>

            <div className="space-y-3 max-w-xl">
              <h3 className="text-sm font-bold text-slate-900">Filtros de precisão do GPS</h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Ignorar movimentos menores que (metros)</label>
                  <input type="number" min={0} value={rascunho.gps.distanciaMinimaM} onChange={(e) => setRascunho({ ...rascunho, gps: { ...rascunho.gps, distanciaMinimaM: Number(e.target.value) } })} className={`${inputCls} font-mono-tabular`} />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Descartar saltos acima de (km/h)</label>
                  <input type="number" min={50} value={rascunho.gps.velocidadeMaxKmh} onChange={(e) => setRascunho({ ...rascunho, gps: { ...rascunho.gps, velocidadeMaxKmh: Number(e.target.value) } })} className={`${inputCls} font-mono-tabular`} />
                </div>
                <div data-dica="Só vale para rastreador sem ignição (app de celular). Acima dessa velocidade o sistema entende que a moto está andando e começa uma viagem.">
                  <label className="block font-semibold text-slate-700 mb-1">Moto andando a partir de (km/h)</label>
                  <input type="number" min={1} value={rascunho.gps.velocidadeMovimentoKmh} onChange={(e) => setRascunho({ ...rascunho, gps: { ...rascunho.gps, velocidadeMovimentoKmh: Number(e.target.value) } })} className={`${inputCls} font-mono-tabular`} />
                </div>
                <div data-dica="Só vale para rastreador sem ignição. Se a moto ficar parada por esse tempo, a viagem é encerrada.">
                  <label className="block font-semibold text-slate-700 mb-1">Viagem termina após parada de (minutos)</label>
                  <input type="number" min={1} value={rascunho.gps.minutosParadaFimViagem} onChange={(e) => setRascunho({ ...rascunho, gps: { ...rascunho.gps, minutosParadaFimViagem: Number(e.target.value) } })} className={`${inputCls} font-mono-tabular`} />
                </div>
              </div>
              {botaoSalvar}
            </div>
          </div>
        )}

        {/* PREFERÊNCIAS */}
        {section === 'preferencias' && (
          <div className="space-y-4 text-xs max-w-xl">
            <h2 className="text-base font-bold text-slate-900">Parâmetros padrão</h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Ciclo de revisão (km)</label>
                <input type="number" min={500} value={rascunho.cicloRevisaoKm} onChange={(e) => setRascunho({ ...rascunho, cicloRevisaoKm: Number(e.target.value) })} className={`${inputCls} font-mono-tabular`} />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Caução padrão (R$)</label>
                <input type="number" min={0} value={rascunho.caucaoPadrao} onChange={(e) => setRascunho({ ...rascunho, caucaoPadrao: Number(e.target.value) })} className={`${inputCls} font-mono-tabular`} />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Avisar vencimento (dias antes)</label>
                <input type="number" min={0} value={rascunho.diasAvisoVencimento} onChange={(e) => setRascunho({ ...rascunho, diasAvisoVencimento: Number(e.target.value) })} className={`${inputCls} font-mono-tabular`} />
              </div>
            </div>
            <p className="text-slate-500">
              O aviso de vencimento também define com quantos dias de antecedência a próxima mensalidade é gerada.
            </p>
            <div className="space-y-1.5 rounded-xl border border-slate-200 bg-slate-50 p-3" data-dica="Por lei (LGPD) não se deve guardar dados pessoais para sempre. Passado este prazo, o sistema apaga sozinho, uma vez por dia.">
              <label className="block font-semibold text-slate-700">Guardar dados antigos por quantos meses?</label>
              <input type="number" min={1} max={120} value={rascunho.retencaoMeses} onChange={(e) => setRascunho({ ...rascunho, retencaoMeses: Number(e.target.value) })} className={`${inputCls} font-mono-tabular max-w-[8rem]`} />
              <p className="text-slate-500">
                Padrão: 24 meses (2 anos). Depois disso o sistema apaga sozinho: posições e viagens do GPS, mensagens do WhatsApp, o histórico de atividades e os
                clientes cujo último contrato terminou há mais tempo que isso e que não devem nada (junto com os contratos, pagamentos e arquivos deles).
                As motos nunca são apagadas. Quando apagar algo, aparece uma linha no histórico.
              </p>
            </div>
            {botaoSalvar}
          </div>
        )}

        {/* BANCO DE DADOS */}
        {section === 'banco' && (
          <div className="space-y-5 text-xs max-w-2xl">
            <h2 className="text-base font-bold text-slate-900">Banco de dados</h2>
            <p className="text-slate-600">
              Todos os dados (clientes, motos, contratos, pagamentos, posições do GPS) ficam no arquivo{' '}
              <code className="rounded bg-slate-100 px-1">data/mkmotos.db</code> no computador onde o sistema está instalado.
              Faça backup com frequência.
            </p>
            <a
              href="/api/backup"
              className="inline-flex items-center gap-1.5 rounded-lg bg-[#0B0B0B] px-4 py-2.5 font-semibold text-white hover:bg-slate-800"
            >
              <Database className="h-3.5 w-3.5" /> Baixar backup completo (JSON)
            </a>

            <div className="rounded-xl border border-red-200 bg-red-50/60 p-4 space-y-3">
              <h3 className="text-sm font-bold text-[#E50914]">Recomeçar do zero</h3>
              <p className="text-slate-700">
                Apaga clientes, motos (com as fotos), contratos, pagamentos e posições do GPS. As configurações da empresa
                ficam guardadas. Não dá para desfazer: baixe o backup antes.
              </p>
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => {
                    if (!window.confirm('Apagar TODOS os dados (clientes, motos, contratos, pagamentos, GPS)? Isso não pode ser desfeito. Faça um backup antes.')) return;
                    if (!window.confirm('Última confirmação: tem certeza que quer apagar tudo e recomeçar do zero?')) return;
                    apagarTudo();
                  }}
                  className="rounded-lg bg-[#E50914] px-4 py-2 font-semibold text-white hover:bg-red-700"
                  data-dica="Apaga todos os cadastros para você recomeçar do zero. Pede confirmação duas vezes. Baixe o backup antes."
                >
                  Apagar todos os dados e começar do zero
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
