import React, { useState } from 'react';
import {
  X,
  FileText,
  MessageSquare,
  Send,
  Printer,
  ArrowUpRight,
  Satellite,
  MapPin,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { MotoStatus } from '../types/mkMotos';
import { brl, linkMapa, linkWhatsApp } from '../lib/formato';
import { tempoRelativo } from '../lib/datas';

export const GlobalModals: React.FC = () => {
  const {
    motos,
    clientes,
    alugueis,
    contratos,
    pagamentos,
    manutencoes,
    config,
    selectedMotoId,
    setSelectedMotoId,
    selectedClienteId,
    setSelectedClienteId,
    selectedContratoId,
    setSelectedContratoId,
    whatsAppTargetCliente,
    setWhatsAppTargetCliente,
    navigateToMoto,
    navigateToCliente,
    navigateToContrato,
    updateMotoStatus,
    assinarContrato,
  } = useApp();

  const nomeEmpresa = config.empresa.nome || 'MK Motos';
  const [waMessage, setWaMessage] = useState(
    `Olá! Tudo bem? Aqui é da equipe ${nomeEmpresa}. Passando para confirmar os detalhes da sua locação.`
  );
  const [waSentLog, setWaSentLog] = useState<string[]>([]);

  const selectedMoto = motos.find((m) => m.id === selectedMotoId);
  const selectedCliente = clientes.find((c) => c.id === selectedClienteId);
  const selectedContrato = contratos.find((c) => c.id === selectedContratoId);

  return (
    <>
      {/* 1. MODAL DE DETALHES DA MOTOCICLETA */}
      {selectedMoto && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-xs">
          <div className="relative max-h-[90vh] w-full max-w-4xl overflow-y-auto rounded-2xl border border-slate-200 bg-white shadow-2xl">
            {/* Top header */}
            <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-200 bg-[#0B0B0B] px-6 py-4 text-white">
              <div>
                <div className="flex items-center gap-2 text-xs text-slate-400 font-mono-tabular">
                  <span>{selectedMoto.codigo}</span>
                  <span>·</span>
                  <span>PLACA {selectedMoto.placa}</span>
                  <span>·</span>
                  <span>ANO {selectedMoto.ano}</span>
                </div>
                <h2 className="mt-0.5 text-xl font-bold tracking-tight text-white">
                  {selectedMoto.modelo}
                </h2>
              </div>
              <div className="flex items-center gap-3">
                <select
                  value={selectedMoto.status}
                  onChange={(e) =>
                    updateMotoStatus(selectedMoto.id, e.target.value as MotoStatus)
                  }
                  className="rounded-lg border border-white/15 bg-white/10 px-3 py-1.5 text-xs font-semibold text-white focus:outline-none"
                >
                  <option value="ALUGADA" className="text-slate-900">
                    Status: ALUGADA
                  </option>
                  <option value="DISPONÍVEL" className="text-slate-900">
                    Status: DISPONÍVEL
                  </option>
                  <option value="MANUTENÇÃO" className="text-slate-900">
                    Status: MANUTENÇÃO
                  </option>
                  <option value="ATRASADA" className="text-slate-900">
                    Status: ATRASADA
                  </option>
                </select>
                <button
                  onClick={() => setSelectedMotoId(null)}
                  className="rounded-lg p-2 text-slate-400 hover:bg-white/10 hover:text-white transition-colors"
                  aria-label="Fechar modal"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>

            <div className="p-6 space-y-6">
              {/* Top Grid: Photo + Technical Specs + Current Client */}
              <div className="grid grid-cols-1 gap-6 md:grid-cols-12">
                <div className="md:col-span-5">
                  <div className="relative aspect-4/3 overflow-hidden rounded-xl border border-slate-200 bg-slate-900">
                    <img
                      src={selectedMoto.foto}
                      alt={selectedMoto.modelo}
                      referrerPolicy="no-referrer"
                      className="h-full w-full object-cover"
                    />
                  </div>
                  <div className="mt-3 flex items-center justify-between text-xs text-slate-600 font-mono-tabular">
                    <span>Chassi: {selectedMoto.chassi}</span>
                    <span>Cor: {selectedMoto.cor}</span>
                  </div>
                </div>

                <div className="md:col-span-7 flex flex-col justify-between space-y-4">
                  {/* Telemetry & Revision metrics */}
                  <div className="grid grid-cols-3 gap-3">
                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-3.5">
                      <span className="text-xs text-slate-500">Quilometragem</span>
                      <p className="mt-1 text-lg font-bold text-slate-900 font-mono-tabular">
                        {Math.round(selectedMoto.kmAtual).toLocaleString('pt-BR')} km
                      </p>
                    </div>
                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-3.5">
                      <span className="text-xs text-slate-500">Próxima revisão</span>
                      <p className="mt-1 text-lg font-bold text-slate-900 font-mono-tabular">
                        {selectedMoto.proximaRevisaoKm.toLocaleString('pt-BR')} km
                      </p>
                      <span className="text-[11px] font-medium text-[#E50914] font-mono-tabular">
                        {selectedMoto.proximaRevisaoKm - selectedMoto.kmAtual > 0
                          ? `Revisão em ${Math.round(
                              selectedMoto.proximaRevisaoKm - selectedMoto.kmAtual
                            ).toLocaleString('pt-BR')} km`
                          : 'Revisão vencida / oficina'}
                      </span>
                    </div>
                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-3.5">
                      <span className="text-xs text-slate-500">Valor Mensal</span>
                      <p className="mt-1 text-lg font-bold text-[#087BFF] font-mono-tabular">
                        {brl(selectedMoto.valorMensal)}
                      </p>
                      <span className="text-[11px] text-slate-500 font-mono-tabular">
                        {brl(selectedMoto.valorSemanal)}/sem
                      </span>
                    </div>
                  </div>

                  {/* Rastreador GPS */}
                  {(() => {
                    const pos = selectedMoto.gpsUltimaPosicao;
                    const ctr = contratos.find((c) => c.id === selectedMoto.contratoAtualId);
                    const ciclo = config.cobrancaKm.kmPorCiclo;
                    const rodados = ctr?.kmRodados ?? 0;
                    const proximoCiclo = ciclo - (rodados % ciclo);
                    return (
                      <div className="rounded-xl border border-blue-200 bg-blue-50/50 p-4 text-xs space-y-1.5">
                        <div className="flex items-center justify-between">
                          <span className="flex items-center gap-1.5 font-semibold text-slate-900">
                            <Satellite className="h-3.5 w-3.5 text-[#087BFF]" />
                            Rastreador GPS {selectedMoto.gpsImei ? `· ${selectedMoto.gpsImei}` : ''}
                          </span>
                          {pos && (
                            <a
                              href={linkMapa(pos.lat, pos.lon)}
                              target="_blank"
                              rel="noreferrer"
                              className="flex items-center gap-1 font-semibold text-[#087BFF] hover:underline"
                            >
                              <MapPin className="h-3.5 w-3.5" /> Ver no mapa
                            </a>
                          )}
                        </div>
                        {!selectedMoto.gpsImei ? (
                          <p className="text-slate-600">Sem rastreador cadastrado. Cadastre o IMEI em Frota → Editar / GPS.</p>
                        ) : pos ? (
                          <p className="text-slate-600">
                            Última posição {tempoRelativo(pos.dataHora)}
                            {pos.velocidadeKmh !== undefined ? ` · ${Math.round(pos.velocidadeKmh)} km/h` : ''}
                          </p>
                        ) : (
                          <p className="text-amber-700">Aguardando a primeira posição do rastreador.</p>
                        )}
                        {ctr && (
                          <p className="text-slate-700">
                            Com o cliente atual: <strong>{Math.round(rodados).toLocaleString('pt-BR')} km</strong> rodados
                            {config.cobrancaKm.ativo && (
                              <> · próxima cobrança por km em <strong>{Math.round(proximoCiclo).toLocaleString('pt-BR')} km</strong></>
                            )}
                          </p>
                        )}
                      </div>
                    );
                  })()}

                  {/* Cliente Atual Conectado */}
                  {(() => {
                    const cliAtual = clientes.find((c) => c.id === selectedMoto.clienteAtualId);
                    const ctrAtual = contratos.find((c) => c.id === selectedMoto.contratoAtualId);
                    if (!cliAtual) {
                      return (
                        <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-4">
                          <p className="text-sm font-semibold text-slate-800">
                            Sem condutor vinculado no momento
                          </p>
                          <p className="mt-0.5 text-xs text-slate-500">
                            Esta motocicleta está pronta para nova locação ou em revisão técnica.
                          </p>
                        </div>
                      );
                    }
                    return (
                      <div className="rounded-xl border border-slate-200 bg-white p-4">
                        <div className="flex items-center justify-between">
                          <div>
                            <span className="text-xs font-semibold text-[#087BFF]">
                              Condutor Atual Vinculado
                            </span>
                            <h3 className="mt-0.5 text-base font-bold text-slate-900">
                              {cliAtual.nome}
                            </h3>
                            <p className="mt-0.5 text-xs text-slate-500 font-mono-tabular">
                              {cliAtual.telefone} · CNH {cliAtual.cnh} · Origem:{' '}
                              {cliAtual.origemLead}
                            </p>
                          </div>
                          <div className="flex items-center gap-2">
                            {ctrAtual && (
                              <button
                                onClick={() => navigateToContrato(ctrAtual.id)}
                                className="flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors whitespace-nowrap"
                              >
                                <FileText className="h-3.5 w-3.5 text-[#087BFF]" />
                                {ctrAtual.numero}
                              </button>
                            )}
                            <button
                              onClick={() => navigateToCliente(cliAtual.id)}
                              className="flex items-center gap-1.5 rounded-lg bg-[#0B0B0B] px-3.5 py-2 text-xs font-semibold text-white hover:bg-slate-800 transition-colors whitespace-nowrap"
                            >
                              Abrir Cliente
                              <ArrowUpRight className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })()}
                </div>
              </div>

              {/* Lower Sections: Histórico de Manutenção + Pagamentos Relacionados + Histórico de Aluguéis */}
              <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                {/* Histórico de Manutenção */}
                <div className="rounded-xl border border-slate-200 bg-white p-4">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                    <h4 className="text-sm font-bold text-slate-900">
                      Histórico de Manutenção da Moto
                    </h4>
                    <span className="text-xs text-slate-500 font-mono-tabular">
                      Última: {selectedMoto.ultimaManutencaoData}
                    </span>
                  </div>
                  <div className="mt-3 divide-y divide-slate-100">
                    {manutencoes
                      .filter((m) => m.motoId === selectedMoto.id)
                      .map((item) => (
                        <div key={item.id} className="py-2.5 flex items-start justify-between gap-3">
                          <div>
                            <p className="text-xs font-semibold text-slate-900">
                              {item.tipo}{' '}
                              <span className="font-normal text-slate-500">
                                · {item.kmNaManutencao.toLocaleString('pt-BR')} km
                              </span>
                            </p>
                            <p className="text-xs text-slate-500">{item.observacao}</p>
                          </div>
                          <div className="text-right font-mono-tabular shrink-0">
                            <p className="text-xs font-bold text-slate-900">
                              {item.concluida ? brl(item.custo) : 'Pendente'}
                            </p>
                            <p className="text-[11px] text-slate-400">{item.data}</p>
                          </div>
                        </div>
                      ))}
                    {manutencoes.filter((m) => m.motoId === selectedMoto.id).length === 0 && (
                      <p className="py-4 text-xs text-slate-500">
                        Nenhuma manutenção corretiva registrada. Revisões preventivas em dia.
                      </p>
                    )}
                  </div>
                </div>

                {/* Pagamentos e Histórico de Locação */}
                <div className="rounded-xl border border-slate-200 bg-white p-4">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                    <h4 className="text-sm font-bold text-slate-900">
                      Pagamentos & Contratos Vinculados
                    </h4>
                    <span className="text-xs text-slate-500">Histórico financeiro da unidade</span>
                  </div>
                  <div className="mt-3 divide-y divide-slate-100">
                    {pagamentos
                      .filter((p) => p.motoId === selectedMoto.id)
                      .map((pag) => {
                        const cli = clientes.find((c) => c.id === pag.clienteId);
                        return (
                          <div
                            key={pag.id}
                            className="py-2.5 flex items-center justify-between gap-3"
                          >
                            <div>
                              <p className="text-xs font-semibold text-slate-900">
                                {cli?.nome || 'Cliente'} · {pag.tipo ?? 'Mensalidade'} · {pag.competencia}
                              </p>
                              <p className="text-xs text-slate-500 font-mono-tabular">
                                Vencimento {pag.vencimento} · {pag.formaPagamento}
                              </p>
                            </div>
                            <div className="text-right font-mono-tabular">
                              <p className="text-xs font-bold text-slate-900">
                                {brl(pag.valor)}
                              </p>
                              <span
                                className={`text-[11px] font-semibold ${
                                  pag.status === 'Pago'
                                    ? 'text-emerald-600'
                                    : pag.status === 'Atrasado'
                                    ? 'text-[#E50914]'
                                    : 'text-amber-600'
                                }`}
                              >
                                {pag.status}
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    {alugueis
                      .filter((a) => a.motoId === selectedMoto.id)
                      .map((alu) => {
                        const cli = clientes.find((c) => c.id === alu.clienteId);
                        return (
                          <div
                            key={alu.id}
                            className="py-2.5 flex items-center justify-between text-xs text-slate-600"
                          >
                            <span>
                              Locação {alu.codigo} ({cli?.nome})
                            </span>
                            <span className="font-mono-tabular">
                              {alu.dataInicio} → {alu.dataPrevista} · {alu.status}
                            </span>
                          </div>
                        );
                      })}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 2. MODAL DE DETALHES DO CLIENTE (CRM / FICHA COMPLETA) */}
      {selectedCliente && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-xs">
          <div className="relative max-h-[90vh] w-full max-w-4xl overflow-y-auto rounded-2xl border border-slate-200 bg-white shadow-2xl">
            <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-200 bg-[#0B0B0B] px-6 py-4 text-white">
              <div>
                <div className="flex items-center gap-2 text-xs text-slate-400">
                  <span>Cliente desde {selectedCliente.dataCadastro}</span>
                  <span>·</span>
                  <span>Origem: {selectedCliente.origemLead}</span>
                  <span>·</span>
                  <span className="text-white font-semibold">{selectedCliente.status}</span>
                </div>
                <h2 className="mt-0.5 text-xl font-bold tracking-tight text-white">
                  {selectedCliente.nome}
                </h2>
              </div>
              <div className="flex items-center gap-2.5">
                <button
                  onClick={() => {
                    setWhatsAppTargetCliente(selectedCliente);
                  }}
                  className="flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3.5 py-2 text-xs font-semibold text-white hover:bg-emerald-500 transition-colors whitespace-nowrap"
                >
                  <MessageSquare className="h-3.5 w-3.5" />
                  WhatsApp
                </button>
                <button
                  onClick={() => setSelectedClienteId(null)}
                  className="rounded-lg p-2 text-slate-400 hover:bg-white/10 hover:text-white transition-colors"
                  aria-label="Fechar modal"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>

            <div className="p-6 space-y-6">
              {/* Dados Pessoais & Contato */}
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                  <span className="text-xs text-slate-500">Documentos Pessoais</span>
                  <p className="mt-1 text-sm font-bold text-slate-900 font-mono-tabular">
                    CPF: {selectedCliente.cpf || '— não informado'}
                  </p>
                  <p className="mt-0.5 text-xs text-slate-600 font-mono-tabular">
                    CNH: {selectedCliente.cnh || '— não informada'}
                  </p>
                </div>
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                  <span className="text-xs text-slate-500">Contato & Endereço</span>
                  <p className="mt-1 text-sm font-bold text-slate-900 font-mono-tabular">
                    {selectedCliente.telefone}
                  </p>
                  <p className="mt-0.5 text-xs text-slate-600 truncate">
                    {selectedCliente.endereco} — {selectedCliente.cidade}
                  </p>
                </div>
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                  <span className="text-xs text-slate-500">Rastreio de Marketing</span>
                  <p className="mt-1 text-sm font-bold text-[#087BFF]">
                    Canal: {selectedCliente.origemLead}
                  </p>
                  <p className="mt-0.5 text-xs text-slate-600 truncate">
                    {selectedCliente.campanhaOrigem || 'Captação direta'}
                  </p>
                </div>
              </div>

              {/* Moto Atual & Contrato Atual conectados */}
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                {(() => {
                  const motoAtual = motos.find((m) => m.id === selectedCliente.motoAtualId);
                  if (!motoAtual) {
                    return (
                      <div className="rounded-xl border border-slate-200 p-4">
                        <span className="text-xs text-slate-500">Motocicleta Atual</span>
                        <p className="mt-1 text-sm font-semibold text-slate-700">
                          Nenhuma moto alocada no momento
                        </p>
                      </div>
                    );
                  }
                  return (
                    <div className="rounded-xl border border-slate-200 bg-white p-4 flex items-center justify-between gap-4">
                      <div className="flex items-center gap-3.5">
                        <img
                          src={motoAtual.foto}
                          alt={motoAtual.modelo}
                          referrerPolicy="no-referrer"
                          className="h-14 w-20 rounded-lg object-cover border border-slate-200 shrink-0"
                        />
                        <div>
                          <span className="text-xs font-semibold text-[#E50914]">
                            Motocicleta em Uso
                          </span>
                          <h4 className="text-sm font-bold text-slate-900">{motoAtual.modelo}</h4>
                          <p className="text-xs text-slate-500 font-mono-tabular">
                            Placa {motoAtual.placa} · {Math.round(motoAtual.kmAtual).toLocaleString('pt-BR')} km
                          </p>
                        </div>
                      </div>
                      <button
                        onClick={() => navigateToMoto(motoAtual.id)}
                        className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-800 hover:bg-slate-50 transition-colors whitespace-nowrap"
                      >
                        Ver Moto →
                      </button>
                    </div>
                  );
                })()}

                {(() => {
                  const ctrAtual = contratos.find((c) => c.id === selectedCliente.contratoAtualId);
                  if (!ctrAtual) {
                    return (
                      <div className="rounded-xl border border-slate-200 p-4">
                        <span className="text-xs text-slate-500">Contrato Vigente</span>
                        <p className="mt-1 text-sm font-semibold text-slate-700">
                          Sem contrato ativo
                        </p>
                      </div>
                    );
                  }
                  return (
                    <div className="rounded-xl border border-slate-200 bg-white p-4 flex items-center justify-between gap-4">
                      <div>
                        <span className="text-xs font-semibold text-[#087BFF]">
                          Contrato Vinculado
                        </span>
                        <h4 className="text-sm font-bold text-slate-900 font-mono-tabular">
                          {ctrAtual.numero}
                        </h4>
                        <p className="text-xs text-slate-500 font-mono-tabular">
                          Vigência: {ctrAtual.dataEmissao} até {ctrAtual.dataVencimento} ·{' '}
                          {brl(ctrAtual.valorMensal)} · {Math.round(ctrAtual.kmRodados ?? 0).toLocaleString('pt-BR')} km rodados
                        </p>
                      </div>
                      <button
                        onClick={() => navigateToContrato(ctrAtual.id)}
                        className="rounded-lg bg-[#0B0B0B] px-3.5 py-2 text-xs font-semibold text-white hover:bg-slate-800 transition-colors whitespace-nowrap"
                      >
                        Abrir Contrato
                      </button>
                    </div>
                  );
                })()}
              </div>

              {/* Histórico de Pagamentos e Aluguéis do Cliente */}
              <div className="rounded-xl border border-slate-200 bg-white p-4">
                <h4 className="text-sm font-bold text-slate-900 border-b border-slate-100 pb-3">
                  Histórico Financeiro e Mensalidades
                </h4>
                <div className="mt-3 divide-y divide-slate-100">
                  {pagamentos
                    .filter((p) => p.clienteId === selectedCliente.id)
                    .map((pag) => (
                      <div
                        key={pag.id}
                        className="py-2.5 flex items-center justify-between text-xs"
                      >
                        <div>
                          <span className="font-semibold text-slate-900">{pag.tipo ?? 'Mensalidade'}</span>
                          <span className="text-slate-500 font-mono-tabular">
                            {' '}
                            · {pag.descricao ?? pag.competencia} · Venc. {pag.vencimento}
                          </span>
                        </div>
                        <div className="flex items-center gap-4 font-mono-tabular">
                          <span className="font-bold text-slate-900">
                            {brl(pag.valor)}
                          </span>
                          <span
                            className={`font-semibold ${
                              pag.status === 'Pago'
                                ? 'text-emerald-600'
                                : pag.status === 'Atrasado'
                                ? 'text-[#E50914]'
                                : 'text-amber-600'
                            }`}
                          >
                            {pag.status}
                          </span>
                        </div>
                      </div>
                    ))}
                </div>
                <div className="mt-4 rounded-lg bg-slate-50 p-3 text-xs text-slate-600">
                  <strong className="text-slate-900">Observações internas:</strong>{' '}
                  {selectedCliente.observacoes}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 3. MODAL DE VISUALIZAÇÃO DE CONTRATO PROFISSIONAL */}
      {selectedContrato && (
        <div className="modal-impressao fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-xs">
          <div className="modal-impressao relative max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-2xl border border-slate-200 bg-white shadow-2xl">
            <div className="nao-imprimir sticky top-0 z-10 flex items-center justify-between border-b border-slate-200 bg-[#0B0B0B] px-6 py-4 text-white">
              <div>
                <span className="text-xs text-slate-400 font-mono-tabular">
                  DOCUMENTO DE LOCAÇÃO · {selectedContrato.numero}
                </span>
                <h2 className="text-lg font-bold text-white">
                  Instrumento Particular de Locação de Motocicleta
                </h2>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => window.print()}
                  className="flex items-center gap-1.5 rounded-lg border border-white/15 bg-white/10 px-3 py-1.5 text-xs font-semibold text-white hover:bg-white/20 transition-colors"
                >
                  <Printer className="h-3.5 w-3.5" />
                  Imprimir / PDF
                </button>
                <button
                  onClick={() => setSelectedContratoId(null)}
                  className="rounded-lg p-2 text-slate-400 hover:bg-white/10 hover:text-white transition-colors"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>

            {(() => {
              const cli = clientes.find((c) => c.id === selectedContrato.clienteId);
              const moto = motos.find((m) => m.id === selectedContrato.motoId);
              return (
                <div className="area-impressao p-8 space-y-6 text-slate-800">
                  <div className="flex items-start justify-between border-b border-slate-200 pb-6">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-display text-xl font-extrabold tracking-tight text-[#0B0B0B]">
                          MK <span className="text-[#E50914]">MOTOS</span>
                        </span>
                      </div>
                      <p className="mt-1 text-xs text-slate-500">
                        {nomeEmpresa}
                        {config.empresa.cnpj && ` · CNPJ ${config.empresa.cnpj}`}
                        {config.empresa.telefone && ` · ${config.empresa.telefone}`}
                      </p>
                    </div>
                    <div className="text-right font-mono-tabular">
                      <p className="text-sm font-bold text-slate-900">{selectedContrato.numero}</p>
                      <p className="text-xs text-slate-500">
                        Emissão: {selectedContrato.dataEmissao}
                      </p>
                      <p className="mt-1 text-xs font-semibold text-[#087BFF]">
                        Status: {selectedContrato.status}
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-xs space-y-1">
                      <p className="font-bold text-slate-900">1. LOCATÁRIO (CONDUTOR)</p>
                      <p>
                        <strong>Nome:</strong> {cli?.nome}
                      </p>
                      <p className="font-mono-tabular">
                        <strong>CPF:</strong> {cli?.cpf} · <strong>CNH:</strong> {cli?.cnh}
                      </p>
                      <p>
                        <strong>Telefone:</strong> {cli?.telefone}
                      </p>
                      <p>
                        <strong>Endereço:</strong> {cli?.endereco}, {cli?.cidade}
                      </p>
                    </div>

                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-xs space-y-1">
                      <p className="font-bold text-slate-900">2. OBJETO DA LOCAÇÃO (VEÍCULO)</p>
                      <p>
                        <strong>Motocicleta:</strong> {moto?.modelo} ({moto?.ano})
                      </p>
                      <p className="font-mono-tabular">
                        <strong>Placa:</strong> {moto?.placa} · <strong>Código:</strong>{' '}
                        {moto?.codigo}
                      </p>
                      <p className="font-mono-tabular">
                        <strong>Chassi:</strong> {moto?.chassi}
                      </p>
                      <p className="font-mono-tabular">
                        <strong>Km na entrega:</strong>{' '}
                        {Math.round(selectedContrato.kmInicial ?? moto?.kmAtual ?? 0).toLocaleString('pt-BR')} km
                      </p>
                      <p className="font-mono-tabular">
                        <strong>Rastreador:</strong> {moto?.gpsImei || 'não instalado'}
                      </p>
                    </div>
                  </div>

                  <div className="space-y-3 text-xs leading-relaxed text-slate-600">
                    <p>
                      <strong className="text-slate-900">CLÁUSULA PRIMEIRA — DO PRAZO E VALOR:</strong>{' '}
                      A locação terá vigência de{' '}
                      <span className="font-mono-tabular font-semibold text-slate-900">
                        {selectedContrato.dataEmissao}
                      </span>{' '}
                      até{' '}
                      <span className="font-mono-tabular font-semibold text-slate-900">
                        {selectedContrato.dataVencimento}
                      </span>
                      , mediante pagamento {selectedContrato.plano === 'Semanal' ? 'semanal' : 'mensal'} de{' '}
                      <span className="font-mono-tabular font-semibold text-slate-900">
                        {brl(selectedContrato.valorMensal)}
                      </span>{' '}
                      e caução de garantia no valor de{' '}
                      <span className="font-mono-tabular font-semibold text-slate-900">
                        {brl(selectedContrato.caucao)}
                      </span>
                      .
                    </p>
                    <p>
                      <strong className="text-slate-900">
                        CLÁUSULA SEGUNDA — DA QUILOMETRAGEM E MANUTENÇÃO:
                      </strong>{' '}
                      A quilometragem é apurada pelo rastreador GPS instalado no veículo (ou pela leitura do
                      hodômetro).
                      {config.cobrancaKm.ativo && (
                        <>
                          {' '}A cada{' '}
                          <span className="font-mono-tabular font-semibold text-slate-900">
                            {config.cobrancaKm.kmPorCiclo.toLocaleString('pt-BR')} km
                          </span>{' '}
                          rodados será cobrado o valor de{' '}
                          <span className="font-mono-tabular font-semibold text-slate-900">
                            {brl(config.cobrancaKm.valorPorCiclo)}
                          </span>
                          , com vencimento em {config.cobrancaKm.diasParaVencimento} dias.
                        </>
                      )}{' '}
                      O LOCATÁRIO compromete-se a apresentar a motocicleta para as trocas de óleo e peças
                      conforme o plano de manutenção
                      {config.planoPecas.some((p) => p.cobrarCliente && p.valorCobrado > 0) && (
                        <>
                          , arcando com:{' '}
                          {config.planoPecas
                            .filter((p) => p.cobrarCliente && p.valorCobrado > 0)
                            .map((p) => `${p.nome} a cada ${p.intervaloKm.toLocaleString('pt-BR')} km (${brl(p.valorCobrado)})`)
                            .join('; ')}
                        </>
                      )}
                      .
                    </p>
                    <p>
                      <strong className="text-slate-900">
                        CLÁUSULA TERCEIRA — DO RASTREAMENTO E USO:
                      </strong>{' '}
                      O veículo possui rastreamento por GPS, sendo destinado exclusivamente ao condutor
                      titular identificado neste instrumento, que declara ciência do monitoramento.
                    </p>
                  </div>

                  <div className="grid grid-cols-2 gap-6 pt-10 text-center text-xs">
                    <div className="pt-3 border-t border-slate-400">
                      <p className="font-bold text-slate-900">{nomeEmpresa}</p>
                      <p className="text-slate-500">Locadora</p>
                    </div>
                    <div className="pt-3 border-t border-slate-400">
                      <p className="font-bold text-slate-900">{cli?.nome}</p>
                      <p className="text-slate-500">Locatário · CPF {cli?.cpf}</p>
                    </div>
                  </div>

                  {selectedContrato.status === 'Aguardando assinatura' && (
                    <div className="nao-imprimir flex items-center justify-between rounded-xl bg-blue-50 border border-blue-200 p-4">
                      <div className="text-xs text-slate-700">
                        Este contrato está aguardando a assinatura do cliente. Depois de assinado
                        (impresso ou digital), registre aqui.
                      </div>
                      <button
                        onClick={() => assinarContrato(selectedContrato.id)}
                        className="rounded-lg bg-[#087BFF] px-4 py-2 text-xs font-semibold text-white hover:bg-blue-600 transition-colors whitespace-nowrap"
                      >
                        Registrar assinatura ✓
                      </button>
                    </div>
                  )}
                </div>
              );
            })()}
          </div>
        </div>
      )}

      {/* 4. MODAL SIMULADOR DE WHATSAPP DA MK MOTOS */}
      {whatsAppTargetCliente && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
            <div className="flex items-center justify-between bg-[#075E54] px-5 py-3.5 text-white">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-white/15 font-bold text-sm">
                  {whatsAppTargetCliente.nome.charAt(0)}
                </div>
                <div>
                  <h3 className="text-sm font-bold">{whatsAppTargetCliente.nome}</h3>
                  <p className="text-[11px] text-emerald-100 font-mono-tabular">
                    {whatsAppTargetCliente.telefone}
                  </p>
                </div>
              </div>
              <button
                onClick={() => {
                  setWhatsAppTargetCliente(null);
                  setWaSentLog([]);
                }}
                className="rounded-lg p-1.5 text-white/80 hover:bg-white/10 hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="bg-[#ECE5DD] p-4 space-y-3 max-h-72 overflow-y-auto text-xs">
              <div className="rounded-lg bg-white p-3 shadow-xs text-slate-700 max-w-[90%]">
                <p className="font-semibold text-emerald-800 mb-0.5">Situação do cliente</p>
                {whatsAppTargetCliente.contratoAtualId ? 'Contrato ativo. ' : 'Sem contrato ativo. '}
                {whatsAppTargetCliente.proximoPagamentoValor > 0 ? (
                  <>
                    Próximo pagamento: <strong>{brl(whatsAppTargetCliente.proximoPagamentoValor)}</strong> em{' '}
                    <strong>{whatsAppTargetCliente.proximoPagamentoData}</strong> ({whatsAppTargetCliente.status}).
                  </>
                ) : (
                  'Nenhum pagamento em aberto.'
                )}
              </div>
              {waSentLog.map((msg, i) => (
                <div key={i} className="ml-auto rounded-lg bg-[#DCF8C6] p-3 shadow-xs text-slate-800 max-w-[85%]">
                  {msg}
                  <div className="mt-1 text-right text-[10px] text-slate-500">Aberto no WhatsApp</div>
                </div>
              ))}
            </div>

            <div className="p-4 bg-white border-t border-slate-200 space-y-3">
              <div className="flex flex-wrap gap-1.5">
                <button
                  onClick={() =>
                    setWaMessage(
                      `Olá ${whatsAppTargetCliente.nome.split(' ')[0]}! Aqui é da ${nomeEmpresa}. Lembrete: o valor de ${brl(whatsAppTargetCliente.proximoPagamentoValor)} vence em ${whatsAppTargetCliente.proximoPagamentoData}.${config.empresa.pix ? ` Chave PIX: ${config.empresa.pix}` : ''}`
                    )
                  }
                  className="rounded-md bg-slate-100 px-2.5 py-1 text-[11px] font-medium text-slate-700 hover:bg-slate-200"
                >
                  Cobrança
                </button>
                <button
                  onClick={() =>
                    setWaMessage(
                      `Olá ${whatsAppTargetCliente.nome.split(' ')[0]}! Aqui é da ${nomeEmpresa}. Sua moto atingiu a quilometragem da troca de óleo/revisão. Qual o melhor horário para trazer na oficina?`
                    )
                  }
                  className="rounded-md bg-slate-100 px-2.5 py-1 text-[11px] font-medium text-slate-700 hover:bg-slate-200"
                >
                  Troca de óleo / revisão
                </button>
                <button
                  onClick={() =>
                    setWaMessage(
                      `Olá ${whatsAppTargetCliente.nome.split(' ')[0]}! Aqui é da ${nomeEmpresa}. Seu contrato de locação está pronto para assinatura.`
                    )
                  }
                  className="rounded-md bg-slate-100 px-2.5 py-1 text-[11px] font-medium text-slate-700 hover:bg-slate-200"
                >
                  Contrato
                </button>
              </div>

              <div className="flex items-center gap-2">
                <textarea
                  rows={2}
                  value={waMessage}
                  onChange={(e) => setWaMessage(e.target.value)}
                  className="flex-1 rounded-lg border border-slate-200 px-3 py-2 text-xs focus:border-emerald-600 focus:outline-none"
                  placeholder="Digite a mensagem para o cliente..."
                />
                <a
                  href={linkWhatsApp(whatsAppTargetCliente.telefone, waMessage)}
                  target="_blank"
                  rel="noreferrer"
                  onClick={() => {
                    if (waMessage.trim()) setWaSentLog((prev) => [...prev, waMessage]);
                  }}
                  className="flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3.5 py-2 text-xs font-semibold text-white hover:bg-emerald-500 transition-colors"
                >
                  <Send className="h-3.5 w-3.5" />
                  Abrir no WhatsApp
                </a>
              </div>
              <p className="text-[11px] text-slate-500">
                Abre o WhatsApp (Web ou app) já com a mensagem pronta para o número {whatsAppTargetCliente.telefone}.
              </p>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
