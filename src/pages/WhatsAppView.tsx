import React, { useMemo, useState } from 'react';
import { MessageSquare, Send, Bot, AlertTriangle, Settings, User } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { MensagemWhatsApp } from '../types/mkMotos';
import { tempoRelativo } from '../lib/datas';
import { somenteDigitos } from '../lib/formato';

/** Mesma regra do servidor: DDD + últimos 8 dígitos. */
const chave = (tel: string) => {
  let d = somenteDigitos(tel);
  if (d.startsWith('55') && d.length >= 12) d = d.slice(2);
  return d.length >= 10 ? `${d.slice(0, 2)}${d.slice(-8)}` : d;
};

const ROTULO_MOTIVO: Record<NonNullable<MensagemWhatsApp['motivo']>, string> = {
  troca: 'Aviso de troca',
  lembrete_troca: 'Lembrete de troca',
  cerca: 'Área permitida',
  comprovante: 'Comprovante',
  agente: 'Agente IA',
  manual: 'Equipe',
  dono: 'Alerta para você',
};

export const WhatsAppView: React.FC = () => {
  const { estado, clientes, config, setActiveTab, navigateToCliente, enviarMensagemWhatsApp } = useApp();
  const { mensagens, integracoes } = estado;
  const [selecionada, setSelecionada] = useState<string | null>(null);
  const [texto, setTexto] = useState('');

  const numeroDono = config.whatsapp.numeroDono ? chave(config.whatsapp.numeroDono) : '';

  // Agrupa por número (lista vem da mais nova para a mais antiga)
  const conversas = useMemo(() => {
    const mapa = new Map<string, MensagemWhatsApp[]>();
    for (const m of mensagens) {
      const k = chave(m.telefone);
      if (!mapa.has(k)) mapa.set(k, []);
      mapa.get(k)!.push(m);
    }
    return [...mapa.entries()].map(([k, msgs]) => {
      const cli = clientes.find((c) => msgs.some((m) => m.clienteId === c.id)) ?? clientes.find((c) => chave(c.telefone) === k);
      return {
        chave: k,
        telefone: msgs[0].telefone,
        cliente: cli,
        dono: k === numeroDono,
        ultima: msgs[0],
        mensagens: [...msgs].reverse(),
        // última mensagem é do cliente e ninguém respondeu ainda
        aguardandoResposta: msgs[0].direcao === 'entrada',
        erros: msgs.filter((m) => m.status === 'erro').length,
      };
    });
  }, [mensagens, clientes, numeroDono]);

  const atual = conversas.find((c) => c.chave === selecionada) ?? conversas[0];

  const enviar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!atual || !texto.trim()) return;
    const ok = await enviarMensagemWhatsApp({ clienteId: atual.cliente?.id, telefone: atual.telefone, texto });
    if (ok) setTexto('');
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <p className="text-xs font-semibold text-[#E50914] tracking-wide">ATENDIMENTO AUTOMÁTICO</p>
          <h1 className="mt-1 text-2xl sm:text-3xl font-extrabold tracking-tight text-[#0B0B0B]">WhatsApp</h1>
          <p className="mt-1 text-sm text-slate-600">
            Avisos de troca, comprovantes recebidos, alertas de área e respostas do agente.
          </p>
        </div>
        <button
          onClick={() => setActiveTab('configuracoes')}
          className="flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-xs font-semibold text-slate-800 hover:bg-slate-50"
        >
          <Settings className="h-4 w-4" /> Configurar
        </button>
      </div>

      {!integracoes.whatsappConfigurado && (
        <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-xs text-amber-900">
          <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
          <div>
            <strong>WhatsApp ainda não conectado.</strong> As mensagens abaixo ficam na fila e serão enviadas assim que você
            conectar a API oficial da Meta (Configurações → WhatsApp e agente).
            {integracoes.filaPendente > 0 && ` ${integracoes.filaPendente} aguardando envio.`}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 min-h-[520px]">
        {/* LISTA DE CONVERSAS */}
        <div className="lg:col-span-4 rounded-xl border border-slate-200 bg-white overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-100 text-xs font-bold text-slate-900">Conversas ({conversas.length})</div>
          <div className="divide-y divide-slate-100 max-h-[600px] overflow-y-auto">
            {conversas.map((c) => (
              <button
                key={c.chave}
                onClick={() => setSelecionada(c.chave)}
                className={`w-full text-left px-4 py-3 text-xs hover:bg-slate-50 ${atual?.chave === c.chave ? 'bg-slate-100' : ''}`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-bold text-slate-900 truncate">
                    {c.dono ? 'Você (alertas)' : c.cliente?.nome ?? c.telefone}
                  </span>
                  <span className="text-[11px] text-slate-400 shrink-0">{tempoRelativo(c.ultima.criadoEm)}</span>
                </div>
                <p className="mt-0.5 text-slate-500 truncate">
                  {c.ultima.direcao === 'saida' ? '↪ ' : ''}
                  {c.ultima.texto || `[${c.ultima.tipo}]`}
                </p>
                <div className="mt-1 flex gap-1.5">
                  {c.aguardandoResposta && <span className="rounded bg-emerald-100 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-800">nova</span>}
                  {c.erros > 0 && <span className="rounded bg-red-100 px-1.5 py-0.5 text-[10px] font-semibold text-red-800">{c.erros} erro(s)</span>}
                </div>
              </button>
            ))}
            {conversas.length === 0 && (
              <p className="p-6 text-center text-xs text-slate-500">
                Nenhuma mensagem ainda. Os avisos automáticos e as mensagens dos clientes aparecem aqui.
              </p>
            )}
          </div>
        </div>

        {/* CONVERSA */}
        <div className="lg:col-span-8 rounded-xl border border-slate-200 bg-white flex flex-col overflow-hidden">
          {atual ? (
            <>
              <div className="flex items-center justify-between bg-[#075E54] px-5 py-3 text-white">
                <div>
                  <p className="text-sm font-bold">{atual.dono ? 'Você (alertas do sistema)' : atual.cliente?.nome ?? 'Número não cadastrado'}</p>
                  <p className="text-[11px] text-emerald-100 font-mono-tabular">+{atual.telefone}</p>
                </div>
                {atual.cliente && (
                  <button onClick={() => navigateToCliente(atual.cliente!.id)} className="flex items-center gap-1 rounded-lg bg-white/10 px-3 py-1.5 text-xs font-semibold hover:bg-white/20">
                    <User className="h-3.5 w-3.5" /> Ficha do cliente
                  </button>
                )}
              </div>
              <div className="flex-1 bg-[#ECE5DD] p-4 space-y-2.5 overflow-y-auto max-h-[480px] text-xs">
                {atual.mensagens.map((m) => (
                  <div
                    key={m.id}
                    className={`max-w-[80%] rounded-lg p-2.5 shadow-xs ${m.direcao === 'saida' ? 'ml-auto bg-[#DCF8C6]' : 'bg-white'}`}
                  >
                    {m.arquivo &&
                      (m.arquivo.endsWith('.pdf') ? (
                        <a href={`/api/comprovantes/${m.arquivo}`} target="_blank" rel="noreferrer" className="mb-1 block font-semibold text-[#087BFF] underline">
                          📎 Abrir PDF
                        </a>
                      ) : (
                        <a href={`/api/comprovantes/${m.arquivo}`} target="_blank" rel="noreferrer">
                          <img src={`/api/comprovantes/${m.arquivo}`} alt="Arquivo recebido" className="mb-1 max-h-48 rounded-md" />
                        </a>
                      ))}
                    <p className="whitespace-pre-wrap text-slate-800">{m.texto || (m.tipo !== 'texto' ? `[${m.tipo}]` : '')}</p>
                    <div className="mt-1 flex items-center justify-end gap-1.5 text-[10px] text-slate-500">
                      {m.motivo && (
                        <span className="flex items-center gap-0.5">
                          {m.motivo === 'agente' && <Bot className="h-3 w-3" />}
                          {ROTULO_MOTIVO[m.motivo]} ·
                        </span>
                      )}
                      <span>{tempoRelativo(m.criadoEm)}</span>
                      {m.direcao === 'saida' && (
                        <span className={m.status === 'erro' ? 'text-[#E50914] font-semibold' : m.status === 'pendente' ? 'text-amber-700' : ''}>
                          · {m.status === 'enviada' ? '✓ enviada' : m.status === 'pendente' ? '⏳ na fila' : '✕ erro'}
                        </span>
                      )}
                    </div>
                    {m.erro && <p className="mt-1 text-[10px] text-[#E50914]">{m.erro}</p>}
                  </div>
                ))}
              </div>
              <form onSubmit={enviar} className="flex items-center gap-2 border-t border-slate-200 p-3">
                <input
                  value={texto}
                  onChange={(e) => setTexto(e.target.value)}
                  placeholder="Responder como equipe..."
                  className="flex-1 rounded-lg border border-slate-200 px-3 py-2 text-xs focus:border-emerald-600 focus:outline-none"
                />
                <button type="submit" className="flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3.5 py-2 text-xs font-semibold text-white hover:bg-emerald-500">
                  <Send className="h-3.5 w-3.5" /> Enviar
                </button>
              </form>
            </>
          ) : (
            <div className="flex flex-1 flex-col items-center justify-center gap-2 p-10 text-center text-sm text-slate-500">
              <MessageSquare className="h-8 w-8 text-slate-300" />
              Selecione uma conversa.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
