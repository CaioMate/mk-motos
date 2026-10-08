import React, { useState } from 'react';
import {
  Plus,
  ArrowRight,
  UserCheck,
  X,
  ArrowUpRight,
  CheckCircle2,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { LeadOrigin, LeadStage } from '../types/mkMotos';
import { origemLeads, taxaConversao } from '../lib/indicadores';
import { brl, pct } from '../lib/formato';

const KANBAN_STAGES: LeadStage[] = [
  'NOVOS LEADS',
  'EM ATENDIMENTO',
  'NEGOCIAÇÃO',
  'ALUGUEL REALIZADO',
  'PERDIDOS',
];

const FUNNEL_STEPS = [
  { label: 'INSTAGRAM', sub: 'Anúncios & Reels' },
  { label: 'WHATSAPP', sub: 'Atendimento Rápido' },
  { label: 'LEAD', sub: 'Cadastro no CRM' },
  { label: 'ATENDIMENTO', sub: 'Análise de CNH' },
  { label: 'CLIENTE', sub: 'Contrato Gerado' },
  { label: 'ALUGUEL', sub: 'Moto na Rua' },
];

export const ComercialView: React.FC = () => {
  const {
    leads,
    campanhas,
    addLead,
    moveLeadStage,
    converterLeadEmCliente,
    navigateToCliente,
    estado,
  } = useApp();

  const [modalOpen, setModalOpen] = useState(false);
  const [nome, setNome] = useState('');
  const [telefone, setTelefone] = useState('');
  const [motoInteresse, setMotoInteresse] = useState('Honda CG 160');
  const [origem, setOrigem] = useState<LeadOrigin>('Instagram');
  const [campanha, setCampanha] = useState('');
  const [notas, setNotas] = useState('');

  const origens = origemLeads(estado);
  const totalConversoes = campanhas.reduce((s, c) => s + c.conversoes, 0);

  const handleCreateLead = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nome.trim()) return;
    const ok = await addLead({
      nome,
      telefone,
      motoInteresse,
      origem,
      campanha,
      stage: 'NOVOS LEADS',
      finalidade: 'App de Entrega / Mobilidade',
      notas,
    });
    if (ok) {
      setNome('');
      setTelefone('');
      setNotas('');
      setModalOpen(false);
    }
  };

  return (
    <div className="space-y-8">
      {/* HEADER */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <p className="text-xs font-semibold text-[#E50914] tracking-wide">
            CRM INTEGRADO AO MARKETING DIGITAL DA MK MOTOS
          </p>
          <h1 className="mt-1 text-2xl sm:text-3xl font-extrabold tracking-tight text-[#0B0B0B]">
            CENTRAL COMERCIAL
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            Rastreie desde o clique no anúncio até a assinatura do contrato e entrega da chave.
          </p>
        </div>

        <button
          data-dica="Cadastra uma pessoa interessada em alugar (lead) para acompanhar até fechar."
          onClick={() => setModalOpen(true)}
          className="flex items-center justify-center gap-2 rounded-xl bg-[#E50914] px-4 py-2.5 text-xs font-semibold text-white hover:bg-red-700 transition-colors whitespace-nowrap shadow-xs"
        >
          <Plus className="h-4 w-4" />
          + Novo lead
        </button>
      </div>

      {/* FLUXO VISUAL COMERCIAL: INSTAGRAM -> WHATSAPP -> LEAD -> ATENDIMENTO -> CLIENTE -> ALUGUEL */}
      <section className="rounded-2xl bg-[#0B0B0B] text-white p-6 border border-white/10">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-5">
          <div>
            <span className="text-xs font-mono-tabular font-semibold text-[#087BFF]">
              JORNADA AUTOMATIZADA DE AQUISIÇÃO DE LOCATÁRIOS
            </span>
            <h2 className="text-base font-bold text-white mt-0.5">
              Como o Marketing abastece a Frota da MK Motos
            </h2>
          </div>
          <span className="text-xs text-slate-400 font-mono-tabular">
            Taxa de conversão: {pct(taxaConversao(estado))} ({leads.filter((l) => l.stage === 'ALUGUEL REALIZADO').length}/{leads.length} leads)
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {FUNNEL_STEPS.map((st, idx) => (
            <div
              key={st.label}
              className="relative rounded-xl border border-white/10 bg-white/[0.04] p-3.5 flex flex-col justify-between"
            >
              <div className="flex items-center justify-between">
                <span className="font-mono-tabular text-[11px] font-bold text-[#E50914]">
                  0{idx + 1}
                </span>
                {idx < FUNNEL_STEPS.length - 1 && (
                  <ArrowRight className="h-3.5 w-3.5 text-slate-500 hidden lg:block" />
                )}
              </div>
              <div className="mt-2">
                <p className="text-xs sm:text-sm font-extrabold tracking-tight text-white">
                  {st.label}
                </p>
                <p className="text-[11px] text-slate-400 mt-0.5">{st.sub}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* PIPELINE ESTILO KANBAN (5 COLUNAS) */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-bold text-slate-900">
            Pipeline Comercial de Locações (Kanban)
          </h2>
          <span className="text-xs text-slate-500">
            Clique em "Converter em cliente" para transformar o lead imediatamente
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4 items-start">
          {KANBAN_STAGES.map((stage) => {
            const stageLeads = leads.filter((l) => l.stage === stage);
            const headerBorder =
              stage === 'ALUGUEL REALIZADO'
                ? 'border-t-emerald-600'
                : stage === 'NEGOCIAÇÃO'
                ? 'border-t-[#087BFF]'
                : stage === 'NOVOS LEADS'
                ? 'border-t-[#E50914]'
                : 'border-t-slate-800';

            return (
              <div
                key={stage}
                className={`rounded-xl border border-slate-200 border-t-4 ${headerBorder} bg-slate-100/70 p-3 space-y-3`}
              >
                <div className="flex items-center justify-between px-1">
                  <h3 className="text-xs font-extrabold tracking-wide text-slate-800">
                    {stage}
                  </h3>
                  <span className="font-mono-tabular text-xs font-bold text-slate-500">
                    {stageLeads.length}
                  </span>
                </div>

                <div className="space-y-2.5">
                  {stageLeads.map((lead) => (
                    <div
                      key={lead.id}
                      className="rounded-xl border border-slate-200 bg-white p-3.5 shadow-2xs space-y-2.5"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="text-xs font-bold text-slate-900">{lead.nome}</p>
                          <p className="text-[11px] font-mono-tabular text-slate-500">
                            {lead.telefone}
                          </p>
                        </div>
                        <span className="text-[11px] font-semibold text-[#087BFF]">
                          {lead.origem}
                        </span>
                      </div>

                      <div className="text-xs text-slate-700">
                        <span className="text-slate-400">Interesse: </span>
                        <strong className="text-slate-900">{lead.motoInteresse}</strong>
                      </div>

                      <p className="text-[11px] text-slate-500 leading-snug">{lead.notas}</p>

                      {/* Ações do Card de Lead */}
                      <div className="pt-2 border-t border-slate-100 flex flex-col gap-1.5">
                        {lead.stage !== 'ALUGUEL REALIZADO' ? (
                          <>
                            <button
                              data-dica="Transforma este interessado em cliente cadastrado, pronto para alugar."
                              onClick={() => converterLeadEmCliente(lead.id)}
                              className="w-full flex items-center justify-center gap-1.5 rounded-lg bg-[#0B0B0B] px-2.5 py-1.5 text-[11px] font-semibold text-white hover:bg-[#E50914] transition-colors"
                            >
                              <UserCheck className="h-3.5 w-3.5" />
                              Converter em cliente
                            </button>
                            <select
                              value={lead.stage}
                              onChange={(e) =>
                                moveLeadStage(lead.id, e.target.value as LeadStage)
                              }
                              className="w-full rounded-md border border-slate-200 bg-slate-50 px-2 py-1 text-[11px] text-slate-600"
                            >
                              {KANBAN_STAGES.map((st) => (
                                <option key={st} value={st}>
                                  Mover: {st}
                                </option>
                              ))}
                            </select>
                          </>
                        ) : (
                          <div className="flex items-center justify-between text-[11px]">
                            <span className="font-semibold text-emerald-700 flex items-center gap-1">
                              <CheckCircle2 className="h-3.5 w-3.5" />
                              Cliente Convertido
                            </span>
                            {lead.convertidoClienteId && (
                              <button
                                onClick={() => navigateToCliente(lead.convertidoClienteId!)}
                                className="font-semibold text-[#087BFF] hover:underline flex items-center gap-0.5"
                              >
                                Abrir <ArrowUpRight className="h-3 w-3" />
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* SEÇÃO 11: INTEGRAÇÃO COM MARKETING — ORIGEM DOS LEADS + CAMPANHAS ATIVAS */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Origem dos leads */}
        <div className="lg:col-span-5 rounded-xl border border-slate-200 bg-white p-6">
          <div className="border-b border-slate-100 pb-4">
            <h2 className="text-base font-bold text-slate-900">Origem dos leads</h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Leads e clientes cadastrados por canal de origem
            </p>
          </div>

          <div className="mt-5 space-y-4">
            {origens.length === 0 && (
              <p className="py-6 text-center text-xs text-slate-500">Quando você cadastrar clientes e contatos, a origem deles aparece aqui.</p>
            )}
            {origens.map((item) => (
              <div key={item.origem} className="space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-slate-800">{item.origem}</span>
                  <span className="font-mono-tabular font-semibold text-slate-600">
                    {item.quantidade} leads ({item.percentual}%)
                  </span>
                </div>
                <div className="h-2.5 w-full rounded-full bg-slate-100 overflow-hidden">
                  <div
                    style={{ width: `${item.percentual}%`, backgroundColor: item.cor }}
                    className="h-full rounded-full"
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Campanhas ativas */}
        <div className="lg:col-span-7 rounded-xl border border-slate-200 bg-white p-6 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div>
                <h2 className="text-base font-bold text-slate-900">Campanhas ativas</h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Acompanhamento de retorno comercial dos anúncios da MK Motos
                </p>
              </div>
              <span className="text-xs font-mono-tabular font-bold text-emerald-600">
                {totalConversoes} conversões registradas
              </span>
            </div>

            <div className="mt-4 space-y-3">
              {campanhas.length === 0 && (
                <p className="py-6 text-center text-xs text-slate-500">Nenhuma campanha cadastrada ainda.</p>
              )}
              {campanhas.map((camp) => (
                <div
                  key={camp.id}
                  className="rounded-xl border border-slate-200 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:border-slate-300 transition-colors"
                >
                  <div>
                    <div className="flex items-center gap-2 text-xs">
                      <span className="font-bold text-emerald-600">Status: {camp.status}</span>
                      <span>·</span>
                      <span className="text-slate-500">Canal: {camp.canal}</span>
                    </div>
                    <h3 className="mt-1 text-sm font-bold text-slate-900">
                      Campanha: "{camp.nome}"
                    </h3>
                  </div>

                  <div className="flex items-center gap-6 font-mono-tabular shrink-0">
                    <div>
                      <span className="block text-[11px] text-slate-400">Leads</span>
                      <span className="text-base font-extrabold text-slate-900">
                        {camp.leadsGerados}
                      </span>
                    </div>
                    <div>
                      <span className="block text-[11px] text-slate-400">Conversões</span>
                      <span className="text-base font-extrabold text-[#087BFF]">
                        {camp.conversoes}
                      </span>
                    </div>
                    <div>
                      <span className="block text-[11px] text-slate-400">Investimento</span>
                      <span className="text-sm font-bold text-slate-700">
                        {brl(camp.investimentoMensal)}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <p className="mt-4 pt-3 border-t border-slate-100 text-xs text-slate-500">
            Leads cadastrados com o mesmo nome de campanha somam automaticamente em “Leads” e, ao
            converter, em “Conversões”.
          </p>
        </div>
      </section>

      {/* MODAL: + NOVO LEAD */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between bg-[#0B0B0B] px-6 py-4 text-white">
              <h2 className="text-base font-bold">Adicionar Novo Lead Comercial</h2>
              <button
                onClick={() => setModalOpen(false)}
                className="text-slate-400 hover:text-white"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleCreateLead} className="p-6 space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Nome do Lead</label>
                <input
                  type="text"
                  required
                  value={nome}
                  onChange={(e) => setNome(e.target.value)}
                  placeholder="Ex: Rodrigo Teixeira"
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-slate-900"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">WhatsApp / Contato</label>
                <input
                  type="text"
                  required
                  value={telefone}
                  onChange={(e) => setTelefone(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 font-mono-tabular text-slate-900"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Moto de Interesse
                  </label>
                  <select
                    value={motoInteresse}
                    onChange={(e) => setMotoInteresse(e.target.value)}
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-slate-900"
                  >
                    <option value="Honda CG 160">Honda CG 160</option>
                    <option value="Honda Biz 125">Honda Biz 125</option>
                    <option value="Yamaha Factor 150">Yamaha Factor 150</option>
                    <option value="Honda NXR 160 Bros">Honda NXR 160 Bros</option>
                    <option value="Yamaha Fazer FZ25">Yamaha Fazer FZ25</option>
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Origem</label>
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
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Campanha</label>
                <input
                  type="text"
                  list="campanhas-cadastradas"
                  value={campanha}
                  onChange={(e) => setCampanha(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-slate-900"
                />
                <datalist id="campanhas-cadastradas">
                  {campanhas.map((c) => (
                    <option key={c.id} value={c.nome} />
                  ))}
                </datalist>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Anotações</label>
                <input
                  type="text"
                  value={notas}
                  onChange={(e) => setNotas(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-slate-900"
                />
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
                  Inserir no Pipeline
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
