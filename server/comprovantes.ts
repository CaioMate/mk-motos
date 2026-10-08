// Conferência automática de comprovantes de manutenção: funções puras (sem banco de dados), fáceis de testar.
import { createHash } from 'node:crypto';
import type { Comprovante, ManutencaoItem } from '../src/types/mkMotos';
import { inicioDoDia, parseBR, somarDias } from '../src/lib/datas';

/** Folga de km aceita antes da abertura da ordem e depois do km atual da moto. */
export const FOLGA_KM = 300;
/** Dias de folga aceitos para o comprovante ser anterior à abertura da ordem. */
export const FOLGA_DIAS = 3;

export const hashDoArquivo = (dados: Buffer) => createHash('sha256').update(dados).digest('hex');

const PALAVRAS_IGNORADAS = new Set(['ltda', 'me', 'epp', 'eireli', 'sa', 'cia', 'de', 'da', 'do', 'das', 'dos', 'e']);

/** Sem acento, minúsculas, sem pontuação e sem Ltda/ME etc. */
function palavrasDoNome(nome: string): string[] {
  return nome
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .split(' ')
    .filter((w) => w && !PALAVRAS_IGNORADAS.has(w))
    .map((w) => (w.length > 3 && w.endsWith('s') ? w.slice(0, -1) : w)); // moto/motos
}

/** Comparação tolerante entre o nome no comprovante e o da oficina credenciada. */
export function nomesDeOficinaCorrespondem(a: string, b: string): boolean {
  const pa = palavrasDoNome(a);
  const pb = palavrasDoNome(b);
  if (!pa.length || !pb.length) return false;
  const ta = pa.join(' ');
  const tb = pb.join(' ');
  if (ta.length >= 3 && tb.length >= 3 && (ta.includes(tb) || tb.includes(ta))) return true;
  const sa = new Set(pa);
  const sb = new Set(pb);
  const iguais = [...sa].filter((w) => sb.has(w)).length;
  return iguais * 2 > Math.min(sa.size, sb.size);
}

const semAcento = (t: string) =>
  t.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

/** Tipos de serviço e as palavras que os identificam (já sem acento). */
const CATEGORIAS_SERVICO: Record<string, RegExp> = {
  oleo: /\b(oleo|lubrificante|lubrificacao)\b/,
  pneu: /\b(pneus?|camaras?)\b/,
  freio: /\b(pastilhas?|freios?|lonas?)\b/,
  relacao: /\b(relacao|corrente|coroa|pinhao)\b/,
  vela: /\bvelas?\b/,
  revisao: /\b(revisao|preventiva)\b/,
};

const categoriasDe = (textos: string[]) =>
  new Set(Object.entries(CATEGORIAS_SERVICO).filter(([, re]) => textos.some((t) => re.test(semAcento(t)))).map(([k]) => k));

/** O serviço listado no comprovante é o pedido na ordem? (tolerante: sinônimos simples) */
export function servicoConfere(servicosComprovante: string[], servicoEsperado: string[]): boolean {
  const lista = servicosComprovante.filter((s) => s && s.trim());
  if (!lista.length) return false;
  const esperadas = categoriasDe(servicoEsperado);
  const encontradas = categoriasDe(lista);
  return [...esperadas].some((c) => encontradas.has(c));
}

export interface DadosConferencia {
  /** Tipo da ordem e nome da peça do plano (ex.: ["Troca de óleo", "Troca de óleo + filtro"]) */
  servicoEsperado: string[];
  item: Pick<ManutencaoItem, 'data' | 'kmNaManutencao' | 'concluida'>;
  comprovante: Pick<Comprovante, 'analise'>;
  /** Nome da oficina credenciada da ordem */
  oficinaNome: string;
  /** Km atual da moto */
  kmMoto: number;
  /** Outro comprovante (de qualquer ordem) já usou este mesmo arquivo */
  arquivoJaUsado: boolean;
  hoje?: Date;
}

/** Lista de motivos para NÃO aprovar sozinho. Lista vazia = pode aprovar automaticamente. */
export function pendenciasDoComprovante(d: DadosConferencia): string[] {
  const motivos: string[] = [];
  const a = d.comprovante.analise;
  if (d.item.concluida) motivos.push('Esta ordem já estava concluída');
  if (!a) {
    motivos.push('Sem leitura da IA');
    return motivos;
  }
  if (!a.ehComprovante) motivos.push('Não parece ser um comprovante');
  if (!a.confereComOficina) motivos.push('A IA não confirmou que confere com a oficina e o serviço');
  if (!a.estabelecimento.trim()) motivos.push('Estabelecimento não identificado');
  else if (!nomesDeOficinaCorrespondem(a.estabelecimento, d.oficinaNome)) motivos.push('Oficina diferente da credenciada');

  const data = parseBR(a.data);
  if (!data) motivos.push('Sem data legível no comprovante');
  else {
    const hoje = inicioDoDia(d.hoje);
    const abertura = parseBR(d.item.data);
    if (data > hoje) motivos.push('Data do comprovante no futuro');
    else if (abertura && data < somarDias(abertura, -FOLGA_DIAS)) motivos.push('Data anterior à abertura da ordem');
  }

  if (a.km != null) {
    const min = d.item.kmNaManutencao - FOLGA_KM;
    const max = d.kmMoto + FOLGA_KM;
    if (a.km < min || a.km > max) motivos.push(`Km do comprovante (${Math.round(a.km)}) fora do esperado`);
  }
  if (!servicoConfere(a.servicos ?? [], d.servicoEsperado)) motivos.push('Serviço do comprovante diferente do pedido');
  if (d.arquivoJaUsado) motivos.push('Este mesmo arquivo já foi usado em outro comprovante');
  return motivos;
}
