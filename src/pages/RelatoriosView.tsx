import React, { useEffect, useMemo, useState } from 'react';
import { FileDown, FileSpreadsheet, BarChart3 } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { EstadoSistema } from '../types/mkMotos';
import { origemLeads, resumoFinanceiro, resumoFrota, taxaConversao } from '../lib/indicadores';
import { brl, brlCurto, pct } from '../lib/formato';
import { hojeBR } from '../lib/datas';

type Tabela = { cabecalho: string[]; linhas: (string | number)[][] };
type IdRelatorio = 'frota' | 'financeiro' | 'clientes' | 'alugueis' | 'km' | 'manutencao' | 'comercial';

const fmtKm = (v: number) => Math.round(v || 0).toLocaleString('pt-BR');

function montarTabela(id: IdRelatorio, e: EstadoSistema, km30: Record<string, number>): Tabela {
  const cli = (cid: string) => e.clientes.find((c) => c.id === cid)?.nome ?? '';
  const moto = (mid: string) => e.motos.find((m) => m.id === mid);
  switch (id) {
    case 'frota':
      return {
        cabecalho: ['Código', 'Modelo', 'Placa', 'Status', 'Km atual', 'Km últimos 30 dias (GPS)', 'Condutor', 'Receita recebida', 'Custo manutenção', 'Resultado'],
        linhas: e.motos.map((m) => {
          const receita = e.pagamentos.filter((p) => p.motoId === m.id && p.status === 'Pago').reduce((s, p) => s + p.valor, 0);
          const custo = e.manutencoes.filter((x) => x.motoId === m.id && x.concluida).reduce((s, x) => s + x.custo, 0);
          return [m.codigo, m.modelo, m.placa, m.status, fmtKm(m.kmAtual), fmtKm(km30[m.id] ?? 0), cli(m.clienteAtualId ?? ''), brl(receita), brl(custo), brl(receita - custo)];
        }),
      };
    case 'financeiro':
      return {
        cabecalho: ['Cliente', 'Tipo', 'Descrição', 'Competência', 'Valor', 'Vencimento', 'Pago em', 'Forma', 'Status'],
        linhas: e.pagamentos.map((p) => [cli(p.clienteId), p.tipo ?? 'Mensalidade', p.descricao ?? '', p.competencia, brl(p.valor), p.vencimento, p.dataPagamento ?? '', p.formaPagamento, p.status]),
      };
    case 'clientes':
      return {
        cabecalho: ['Nome', 'CPF', 'CNH', 'Telefone', 'E-mail', 'Endereço', 'Cidade', 'Cadastro', 'Status', 'Moto atual', 'Total pago', 'Em aberto', 'Origem'],
        linhas: e.clientes.map((c) => {
          const pagos = e.pagamentos.filter((p) => p.clienteId === c.id && p.status === 'Pago').reduce((s, p) => s + p.valor, 0);
          const aberto = e.pagamentos.filter((p) => p.clienteId === c.id && p.status !== 'Pago').reduce((s, p) => s + p.valor, 0);
          return [c.nome, c.cpf, c.cnh, c.telefone, c.email, c.endereco, c.cidade, c.dataCadastro, c.status, moto(c.motoAtualId ?? '')?.placa ?? '', brl(pagos), brl(aberto), c.origemLead];
        }),
      };
    case 'alugueis':
      return {
        cabecalho: ['Código', 'Cliente', 'Moto', 'Plano', 'Início', 'Término previsto', 'Valor', 'Caução', 'Status'],
        linhas: e.alugueis.map((a) => [a.codigo, cli(a.clienteId), `${moto(a.motoId)?.modelo ?? ''} ${moto(a.motoId)?.placa ?? ''}`, a.plano, a.dataInicio, a.dataPrevista, brl(a.valorMensal), brl(a.caucao), a.status]),
      };
    case 'km':
      return {
        cabecalho: ['Contrato', 'Cliente', 'Moto', 'Status', 'Km na saída', 'Km rodados com o cliente', 'Ciclos de km cobrados', 'Cobrado por km', 'Cobrado por peças'],
        linhas: e.contratos.map((c) => {
          const m = moto(c.motoId);
          const porKm = e.pagamentos.filter((p) => p.contratoId === c.id && p.tipo === 'Km rodado').reduce((s, p) => s + p.valor, 0);
          const porPeca = e.pagamentos.filter((p) => p.contratoId === c.id && p.tipo === 'Peças / Manutenção').reduce((s, p) => s + p.valor, 0);
          return [c.numero, cli(c.clienteId), `${m?.modelo ?? ''} ${m?.placa ?? ''}`, c.status, c.kmInicial !== undefined ? fmtKm(c.kmInicial) : '—', fmtKm(c.kmRodados ?? 0), c.kmCiclosCobrados ?? 0, brl(porKm), brl(porPeca)];
        }),
      };
    case 'manutencao':
      return {
        cabecalho: ['Data', 'Moto', 'Placa', 'Serviço', 'Km', 'Custo', 'Oficina', 'Origem', 'Situação', 'Observação'],
        linhas: e.manutencoes.map((m) => [m.data, moto(m.motoId)?.modelo ?? '', moto(m.motoId)?.placa ?? '', m.tipo, fmtKm(m.kmNaManutencao), brl(m.custo), m.oficina, m.origem === 'automatica' ? 'Automática (km)' : 'Manual', m.concluida ? 'Concluída' : 'Pendente', m.observacao]),
      };
    case 'comercial':
      return {
        cabecalho: ['Nome', 'Telefone', 'Origem', 'Campanha', 'Interesse', 'Etapa', 'Entrada'],
        linhas: e.leads.map((l) => [l.nome, l.telefone, l.origem, l.campanha, l.motoInteresse, l.stage, l.dataEntrada]),
      };
  }
}

function baixarCsv(nome: string, t: Tabela) {
  const esc = (v: string | number) => {
    const s = String(v ?? '');
    return /[;"\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const csv = [t.cabecalho, ...t.linhas].map((l) => l.map(esc).join(';')).join('\r\n');
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${nome}-${hojeBR().replace(/\//g, '-')}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

function imprimir(titulo: string, empresa: string, t: Tabela) {
  const w = window.open('', '_blank');
  if (!w) return false;
  const esc = (s: string | number) => String(s ?? '').replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[c]!);
  w.document.write(`<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>${esc(titulo)}</title>
  <style>body{font-family:Arial,sans-serif;font-size:11px;margin:24px;color:#111}h1{font-size:16px;margin:0}
  p{color:#555;margin:4px 0 14px}table{border-collapse:collapse;width:100%}th,td{border:1px solid #ccc;padding:4px 6px;text-align:left}
  th{background:#f1f5f9}tr:nth-child(even) td{background:#fafafa}</style></head><body>
  <h1>${esc(empresa)} — ${esc(titulo)}</h1><p>Gerado em ${hojeBR()} · ${t.linhas.length} registros</p>
  <table><thead><tr>${t.cabecalho.map((h) => `<th>${esc(h)}</th>`).join('')}</tr></thead>
  <tbody>${t.linhas.map((l) => `<tr>${l.map((c) => `<td>${esc(c)}</td>`).join('')}</tr>`).join('')}</tbody></table>
  <script>window.onload=()=>{window.print()}</script></body></html>`);
  w.document.close();
  return true;
}

export const RelatoriosView: React.FC = () => {
  const { estado, config, showToast } = useApp();
  const [selecionado, setSelecionado] = useState<IdRelatorio>('frota');
  const [km30, setKm30] = useState<Record<string, number>>({});

  useEffect(() => {
    fetch('/api/relatorios/km?dias=30')
      .then((r) => r.json())
      .then((linhas: Array<{ motoId: string; km: number }>) => {
        const porMoto: Record<string, number> = {};
        for (const l of linhas) porMoto[l.motoId] = (porMoto[l.motoId] ?? 0) + l.km;
        setKm30(porMoto);
      })
      .catch(() => {});
  }, [estado.motos]);

  const frota = resumoFrota(estado.motos);
  const fin = resumoFinanceiro(estado);
  const kmTotal = estado.contratos.reduce((s, c) => s + (c.kmRodados ?? 0), 0);
  const ativos = estado.alugueis.filter((a) => a.status !== 'Finalizado');
  const ticket = ativos.length ? ativos.reduce((s, a) => s + a.valorMensal, 0) / ativos.length : 0;
  const custoManut = estado.manutencoes.filter((m) => m.concluida).reduce((s, m) => s + m.custo, 0);
  const origens = origemLeads(estado);

  const RELATORIOS: Array<{ id: IdRelatorio; title: string; subtitle: string; metric: string }> = [
    { id: 'frota', title: 'Relatório de frota', subtitle: 'Status, km, receita e custo por placa.', metric: `${pct(frota.ocupacao)} de ocupação (${frota.alugadas}/${frota.total})` },
    { id: 'financeiro', title: 'Relatório financeiro', subtitle: 'Todas as cobranças, pagamentos e atrasos.', metric: `${brlCurto(fin.recebidoMes)} recebidos no mês · ${pct(fin.inadimplencia)} inadimplência` },
    { id: 'clientes', title: 'Base de clientes', subtitle: 'Cadastro completo com CPF, CNH, contato e saldo.', metric: `${estado.clientes.length} clientes cadastrados` },
    { id: 'alugueis', title: 'Relatório de aluguéis', subtitle: 'Locações, planos, valores e vigência.', metric: `${ativos.length} ativos · ticket médio ${brlCurto(ticket)}` },
    { id: 'km', title: 'Km rodados por cliente (GPS)', subtitle: 'Km de cada contrato e o que foi cobrado por km e peças.', metric: `${fmtKm(kmTotal)} km rodados em contratos` },
    { id: 'manutencao', title: 'Relatório de manutenção', subtitle: 'Serviços, trocas automáticas e custos.', metric: `${brl(custoManut)} gastos em oficina` },
    { id: 'comercial', title: 'Relatório comercial', subtitle: 'Leads, origem e etapa do funil.', metric: `${pct(taxaConversao(estado))} de conversão` },
  ];

  const tabela = useMemo(() => montarTabela(selecionado, estado, km30), [selecionado, estado, km30]);
  const atual = RELATORIOS.find((r) => r.id === selecionado)!;

  const exportar = (formato: 'PDF' | 'Excel', id: IdRelatorio = selecionado) => {
    const t = montarTabela(id, estado, km30);
    const titulo = RELATORIOS.find((r) => r.id === id)!.title;
    if (formato === 'Excel') baixarCsv(`mkmotos-${id}`, t);
    else if (!imprimir(titulo, config.empresa.nome, t)) {
      showToast('Libere pop-ups para gerar o PDF', 'O navegador bloqueou a janela de impressão.', true);
    }
  };

  return (
    <div className="space-y-6">
      {/* HEADER */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <p className="text-xs font-semibold text-[#E50914] tracking-wide">INTELIGÊNCIA DE NEGÓCIOS E FECHAMENTO MENSAL</p>
          <h1 className="mt-1 text-2xl sm:text-3xl font-extrabold tracking-tight text-[#0B0B0B]">Relatórios</h1>
          <p className="mt-1 text-sm text-slate-600">
            Gerados na hora a partir do banco de dados. Excel baixa uma planilha (CSV); PDF abre a impressão (escolha “Salvar como PDF”).
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={() => exportar('PDF')}
            className="flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-xs font-semibold text-slate-800 hover:bg-slate-50 transition-colors whitespace-nowrap"
          >
            <FileDown className="h-4 w-4 text-[#E50914]" />
            Exportar PDF
          </button>
          <button
            onClick={() => exportar('Excel')}
            className="flex items-center gap-2 rounded-xl bg-[#0B0B0B] px-4 py-2.5 text-xs font-semibold text-white hover:bg-slate-800 transition-colors whitespace-nowrap"
          >
            <FileSpreadsheet className="h-4 w-4 text-emerald-400" />
            Exportar Excel
          </button>
        </div>
      </div>

      {/* GRID DOS RELATÓRIOS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {RELATORIOS.map((rep) => {
          const isSelected = selecionado === rep.id;
          return (
            <div
              key={rep.id}
              onClick={() => setSelecionado(rep.id)}
              className={`cursor-pointer rounded-xl border p-5 transition-all flex flex-col justify-between ${
                isSelected ? 'border-[#087BFF] bg-white shadow-sm' : 'border-slate-200 bg-white hover:border-slate-300'
              }`}
            >
              <div>
                <div className="flex items-center justify-between">
                  <h2 className="text-sm font-bold text-slate-900">{rep.title}</h2>
                  <BarChart3 className={`h-4 w-4 ${isSelected ? 'text-[#087BFF]' : 'text-slate-400'}`} />
                </div>
                <p className="mt-1.5 text-xs text-slate-500 leading-relaxed">{rep.subtitle}</p>
              </div>
              <div className="mt-4 pt-3 border-t border-slate-100">
                <p className="text-xs font-extrabold font-mono-tabular text-[#0B0B0B]">{rep.metric}</p>
                <div className="mt-3 flex items-center gap-2">
                  <button onClick={(ev) => { ev.stopPropagation(); exportar('PDF', rep.id); }} className="text-[11px] font-semibold text-[#E50914] hover:underline">
                    PDF
                  </button>
                  <span className="text-slate-300">·</span>
                  <button onClick={(ev) => { ev.stopPropagation(); exportar('Excel', rep.id); }} className="text-[11px] font-semibold text-[#087BFF] hover:underline">
                    Excel
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* PRÉVIA DO RELATÓRIO */}
      <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
          <h3 className="text-sm font-bold text-slate-900">Prévia: {atual.title}</h3>
          <span className="text-xs text-slate-500 font-mono-tabular">{tabela.linhas.length} registros</span>
        </div>
        <div className="overflow-x-auto max-h-[460px]">
          <table className="w-full text-left border-collapse text-xs">
            <thead className="sticky top-0">
              <tr className="border-b border-slate-200 bg-slate-50 text-[11px] font-semibold text-slate-500">
                {tabela.cabecalho.map((h) => (
                  <th key={h} className="py-3 px-4 whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {tabela.linhas.slice(0, 200).map((l, i) => (
                <tr key={i} className="hover:bg-slate-50/90">
                  {l.map((c, j) => (
                    <td key={j} className="py-2.5 px-4 whitespace-nowrap text-slate-700">{c}</td>
                  ))}
                </tr>
              ))}
              {tabela.linhas.length === 0 && (
                <tr>
                  <td colSpan={tabela.cabecalho.length} className="py-8 text-center text-slate-500">Sem registros.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ORIGEM DOS CLIENTES */}
      <div className="rounded-xl border border-slate-200 bg-white p-6">
        <div className="border-b border-slate-100 pb-4">
          <h3 className="text-base font-bold text-slate-900">Origem dos leads e clientes</h3>
          <p className="text-xs text-slate-500">Calculado a partir do cadastro</p>
        </div>
        <div className="mt-5 grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-3.5">
          {origens.map((o) => (
            <div key={o.origem} className="space-y-1">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-slate-800">{o.origem}</span>
                <span className="font-mono-tabular text-slate-600">
                  {o.quantidade} · {o.percentual}%
                </span>
              </div>
              <div className="h-2 w-full rounded-full bg-slate-100 overflow-hidden">
                <div style={{ width: `${o.percentual}%`, backgroundColor: o.cor }} className="h-full rounded-full" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
