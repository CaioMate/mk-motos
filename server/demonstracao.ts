import {
  INITIAL_ALUGUEIS,
  INITIAL_ATIVIDADES,
  INITIAL_CAMPANHAS,
  INITIAL_CLIENTES,
  INITIAL_CONTRATOS,
  INITIAL_LEADS,
  INITIAL_MANUTENCOES,
  INITIAL_MOTOS,
  INITIAL_PAGAMENTOS,
} from '../src/data/mockData';
import type { Banco } from './banco';

/** "Há 14 min" / "Há 2 horas" → data ISO aproximada */
function isoDeTextoRelativo(t: string): string {
  const m = t.match(/(\d+)\s*(min|hora)/);
  const minutos = m ? Number(m[1]) * (m[2] === 'hora' ? 60 : 1) : 0;
  return new Date(Date.now() - minutos * 60_000).toISOString();
}

/** Carrega os dados de exemplo (usado no primeiro uso e em Configurações > Banco de dados). */
export function carregarDemonstracao(b: Banco) {
  const clone = <T>(v: T): T => JSON.parse(JSON.stringify(v));
  const contratos = clone(INITIAL_CONTRATOS).map((c) => {
    const alu = INITIAL_ALUGUEIS.find((a) => a.id === c.aluguelId);
    const moto = INITIAL_MOTOS.find((m) => m.id === c.motoId);
    return { ...c, plano: alu?.plano ?? 'Mensal', kmInicial: moto?.kmAtual ?? 0, kmRodados: 0, kmCiclosCobrados: 0 };
  });
  const pagamentos = clone(INITIAL_PAGAMENTOS).map((p) => {
    // vencimentos antigos vinham sem o ano ("05/10")
    const ano = p.competencia.split('/')[1] ?? String(new Date().getFullYear());
    return {
      ...p,
      vencimento: p.vencimento.length === 5 ? `${p.vencimento}/${ano}` : p.vencimento,
      tipo: 'Mensalidade' as const,
      descricao: 'Mensalidade da locação',
    };
  });
  const atividades = clone(INITIAL_ATIVIDADES).map((a) => ({ ...a, criadoEm: isoDeTextoRelativo(a.horario) }));

  b.inserirEmLote('motos', clone(INITIAL_MOTOS));
  b.inserirEmLote('clientes', clone(INITIAL_CLIENTES));
  b.inserirEmLote('alugueis', clone(INITIAL_ALUGUEIS));
  b.inserirEmLote('contratos', contratos);
  b.inserirEmLote('pagamentos', pagamentos);
  b.inserirEmLote('manutencoes', clone(INITIAL_MANUTENCOES).map((m) => ({ ...m, origem: 'manual' as const })));
  b.inserirEmLote('leads', clone(INITIAL_LEADS));
  b.inserirEmLote('campanhas', clone(INITIAL_CAMPANHAS));
  b.inserirEmLote('atividades', atividades);
  b.carregar();
}
