import React, { useEffect, useState } from 'react';
import { Building2, Sliders, Satellite, Database, Gauge, Plus, Trash2, Copy, Send } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { ConfigSistema, PecaPlano, TipoManutencao } from '../types/mkMotos';
import { brl } from '../lib/formato';
import { tempoRelativo } from '../lib/datas';

type ConfigSection = 'empresa' | 'cobranca' | 'gps' | 'preferencias' | 'banco';
const TIPOS: TipoManutencao[] = ['Troca de óleo', 'Pneu', 'Freio', 'Relação', 'Revisão', 'Manutenção preventiva'];
const inputCls = 'w-full rounded-lg border border-slate-200 px-3 py-2 text-slate-900';

export const ConfiguracoesView: React.FC = () => {
  const { config, motos, salvarConfig, limparDemonstracao, restaurarDemonstracao, showToast } = useApp();
  const [section, setSection] = useState<ConfigSection>('empresa');
  const [rascunho, setRascunho] = useState<ConfigSistema>(config);
  const [salvando, setSalvando] = useState(false);
  const [rede, setRede] = useState<string[]>([]);
  const [desconhecidos, setDesconhecidos] = useState<Array<{ id: string; ultimaVez: string }>>([]);
  const [teste, setTeste] = useState({ imei: '', lat: -23.5505, lon: -46.6333, odometro: '' });

  useEffect(() => setRascunho(config), [config]);

  useEffect(() => {
    if (section !== 'gps') return;
    fetch('/api/rede').then((r) => r.json()).then((r) => setRede(r.enderecos)).catch(() => {});
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
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(corpo),
    });
    const j = await r.json();
    if (r.ok) showToast('Posição recebida ✓', `${j.placa}: +${j.kmSomados} km (total ${Math.round(j.kmAtual)} km)`);
    else showToast('GPS recusou a posição', j.erro, true);
  };

  const tabs: Array<{ id: ConfigSection; label: string; icon: React.ElementType }> = [
    { id: 'empresa', label: 'Dados da empresa', icon: Building2 },
    { id: 'cobranca', label: 'Cobrança por km e peças', icon: Gauge },
    { id: 'gps', label: 'GPS / Rastreadores', icon: Satellite },
    { id: 'preferencias', label: 'Preferências', icon: Sliders },
    { id: 'banco', label: 'Banco de dados', icon: Database },
  ];

  const urlBase = rede[0] ?? window.location.origin;
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
      <div className="flex items-center gap-1 p-1 bg-slate-200/70 rounded-xl overflow-x-auto max-w-fit">
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
              <h2 className="text-base font-bold text-slate-900">Cobrança automática por quilometragem</h2>
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

            <div className="space-y-3">
              <h2 className="text-base font-bold text-slate-900">Plano de troca de óleo e peças</h2>
              <p className="text-slate-500">
                Ao atingir o intervalo, o sistema abre a ordem em Manutenção e (se marcado) cobra o valor do cliente que está com a moto.
                Ao concluir o serviço, o contador daquela peça volta a zero.
              </p>
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50 text-[11px] font-semibold text-slate-500">
                      <th className="py-2.5 px-3">Peça / serviço</th>
                      <th className="py-2.5 px-3">Tipo</th>
                      <th className="py-2.5 px-3">A cada (km)</th>
                      <th className="py-2.5 px-3">Cobrar do cliente (R$)</th>
                      <th className="py-2.5 px-3">Cobrar?</th>
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
                        <td className="py-2 px-3"><input type="number" min={0} step="0.01" value={p.valorCobrado} onChange={(e) => setPeca(i, { valorCobrado: Number(e.target.value) })} className={`${inputCls} font-mono-tabular w-28`} /></td>
                        <td className="py-2 px-3 text-center"><input type="checkbox" checked={p.cobrarCliente} onChange={(e) => setPeca(i, { cobrarCliente: e.target.checked })} className="h-4 w-4 accent-[#E50914]" /></td>
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
                      { id: `peca-${Date.now().toString(36)}`, nome: 'Nova peça', tipo: 'Manutenção preventiva', intervaloKm: 5000, valorCobrado: 0, cobrarCliente: false },
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

        {/* GPS */}
        {section === 'gps' && (
          <div className="space-y-6 text-xs max-w-3xl">
            <div className="space-y-2">
              <h2 className="text-base font-bold text-slate-900">Como conectar os rastreadores GPS</h2>
              <p className="text-slate-600">
                O sistema recebe as posições pelo endereço abaixo, soma os km rodados de cada moto e dispara as cobranças e trocas de peças.
              </p>
              <div className="flex items-center gap-2 rounded-xl bg-[#0B0B0B] p-3 font-mono-tabular text-white">
                <span className="flex-1 break-all">{urlBase}/api/gps</span>
                <button onClick={() => copiar(`${urlBase}/api/gps`)} className="rounded-md bg-white/10 p-1.5 hover:bg-white/20" title="Copiar">
                  <Copy className="h-3.5 w-3.5" />
                </button>
              </div>
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
<entry key='forward.url'>${urlBase}/api/gps/traccar</entry>`}</pre>
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
              <h3 className="text-sm font-bold text-[#E50914]">Começar a usar com dados reais</h3>
              <p className="text-slate-700">
                {config.modoDemonstracao
                  ? 'O sistema está com DADOS DE DEMONSTRAÇÃO (clientes e motos fictícios). Apague-os antes de cadastrar sua frota e seus clientes.'
                  : 'O sistema está com seus dados reais.'}
              </p>
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => {
                    if (window.confirm('Apagar TODOS os dados (clientes, motos, contratos, pagamentos, GPS)? Isso não pode ser desfeito. Faça um backup antes.')) {
                      limparDemonstracao();
                    }
                  }}
                  className="rounded-lg bg-[#E50914] px-4 py-2 font-semibold text-white hover:bg-red-700"
                >
                  Apagar todos os dados e começar do zero
                </button>
                <button
                  onClick={() => {
                    if (window.confirm('Substituir TODOS os dados atuais pelos dados de demonstração?')) restaurarDemonstracao();
                  }}
                  className="rounded-lg border border-slate-300 bg-white px-4 py-2 font-semibold text-slate-700 hover:bg-slate-50"
                >
                  Recarregar dados de demonstração
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
