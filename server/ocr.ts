// Leitor de comprovantes GRÁTIS e local (OCR com tesseract.js, idioma português). Só para IMAGENS.
// É a reserva quando não há Claude nem Gemini: transforma o texto da foto no mesmo resultado (AnaliseComprovante) por regras.
// Falhou ou passou do tempo? Quem chama devolve "sem análise" e o comprovante vai para o dono conferir.
import os from 'node:os';
import path from 'node:path';
import type { AnaliseComprovante } from '../src/types/mkMotos';
import { linhasDeServico, nomesDeOficinaCorrespondem, servicoConfere } from './comprovantes';

export const TEMPO_MAX_OCR_MS = 25_000;
export const TIPOS_OCR = ['image/jpeg', 'image/png', 'image/webp'];

export const ocrDisponivel = () => process.env.OCR_DESATIVADO !== '1';

const semAcento = (t: string) => t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

/** Data dd/mm/aaaa ou dd/mm/aa válida (primeira do texto), devolvida como dd/mm/aaaa. */
function acharData(texto: string): string {
  for (const m of texto.matchAll(/(?<!\d)(\d{1,2})\s*[/.\-]\s*(\d{1,2})\s*[/.\-]\s*(\d{4}|\d{2})(?!\d)/g)) {
    const d = Number(m[1]);
    const mes = Number(m[2]);
    let a = Number(m[3]);
    if (m[3].length === 2) a += 2000;
    const dt = new Date(a, mes - 1, d);
    if (a >= 2000 && dt.getFullYear() === a && dt.getMonth() === mes - 1 && dt.getDate() === d) {
      return `${String(d).padStart(2, '0')}/${String(mes).padStart(2, '0')}/${a}`;
    }
  }
  return '';
}

const paraNumero = (s: string) => Number(s.replace(/[.\s]/g, ''));

/** Quilometragem: número colado em "km"/"quilometragem"/"hodômetro" (nunca km/h). */
function acharKm(texto: string): number | null {
  const t = semAcento(texto);
  const NUM = String.raw`(\d{1,3}(?:[. ]\d{3})+|\d{2,7})`;
  const depoisDoRotulo = t.match(new RegExp(String.raw`(?:quilometragem|kilometragem|hodometro|odometro|\bkm\b)\s*[:=\-]?\s*(?:atual\s*[:=\-]?\s*)?${NUM}(?!\s*(?:,\d|km/h))`));
  const antesDeKm = t.match(new RegExp(String.raw`(?<![\d,.])${NUM}\s*km\b(?!\s*/\s*h)`));
  const achado = depoisDoRotulo?.[1] ?? antesDeKm?.[1];
  if (!achado) return null;
  const n = paraNumero(achado);
  return n > 0 && n < 2_000_000 ? n : null;
}

function acharValorTotal(linhas: string[]): number | null {
  const valorDe = (l: string) => [...l.matchAll(/(\d{1,3}(?:\.\d{3})*,\d{2})/g)].map((m) => Number(m[1].replace(/\./g, '').replace(',', '.')));
  const comTotal = linhas.filter((l) => /\btotal\b/.test(semAcento(l))).flatMap(valorDe);
  return comTotal.length ? Math.max(...comTotal) : null;
}

const SINAIS_COMPROVANTE = [/\bnota\b/, /\brecibo\b/, /\bcupom\b/, /\bfiscal\b/, /\btotal\b/, /\bcnpj\b/, /\bcomprovante\b/, /r\s?\$/, /\bordem de servico\b/, /\bos\b\s*n/];

export interface ContextoOcr {
  servicoEsperado: string;
  oficinaNome: string;
}

/** Monta o resultado a partir do texto lido da foto, só com regras (função pura, fácil de testar). */
export function analisarTexto(texto: string, ctx: ContextoOcr): AnaliseComprovante {
  const linhas = texto
    .split(/\r?\n/)
    .map((l) => l.replace(/\s+/g, ' ').trim())
    .filter((l) => l.length > 1);
  const t = semAcento(texto);

  const sinais = SINAIS_COMPROVANTE.filter((re) => re.test(t)).length;
  const ehComprovante = sinais >= 2;

  // estabelecimento = linha que melhor casa com a oficina da ordem; sem casar, mostra a 1ª linha com letras (para o dono ver)
  const casou = linhas.find((l) => /[a-zA-Z]{3}/.test(l) && nomesDeOficinaCorrespondem(l, ctx.oficinaNome));
  const estabelecimento = casou ?? linhas.find((l) => (l.match(/[a-zA-ZÀ-ÿ]/g) ?? []).length >= 4) ?? '';

  const servicos = linhasDeServico(linhas).slice(0, 8);
  const data = acharData(texto);
  const km = acharKm(texto);
  const valorTotal = acharValorTotal(linhas);
  const oficinaOk = !!casou;
  const servicoOk = servicoConfere(servicos, [ctx.servicoEsperado]);

  const partes = [
    oficinaOk ? 'oficina reconhecida' : 'oficina não reconhecida',
    data ? `data ${data}` : 'sem data legível',
    servicoOk ? 'serviço reconhecido' : 'serviço não reconhecido',
  ];
  return {
    ehComprovante,
    estabelecimento,
    data,
    servicos,
    valorTotal,
    km,
    confereComOficina: ehComprovante && oficinaOk && servicoOk,
    observacao: `Leitura por texto da foto: ${partes.join(', ')}. Confira a imagem.`,
    fonte: 'ocr',
  };
}

/** Lê o texto da imagem (português). Dados do idioma ficam no temporário do sistema (funciona na Vercel). */
export async function lerTextoDaImagem(dados: Buffer, tempoMaxMs = TEMPO_MAX_OCR_MS): Promise<string> {
  const { createWorker } = await import('tesseract.js');
  const cachePath = path.join(os.tmpdir(), 'mkmotos-tessdata');
  let worker: Awaited<ReturnType<typeof createWorker>> | null = null;
  let relogio: NodeJS.Timeout | undefined;
  const limite = new Promise<never>((_, rej) => {
    relogio = setTimeout(() => {
      void worker?.terminate().catch(() => {});
      rej(new Error(`OCR passou de ${Math.round(tempoMaxMs / 1000)} s`));
    }, tempoMaxMs);
  });
  const trabalho = (async () => {
    worker = await createWorker('por', 1, { cachePath, logger: () => {} });
    const r = await worker.recognize(dados);
    return r.data.text ?? '';
  })();
  trabalho.catch(() => {}); // evita erro solto se o limite de tempo vencer primeiro
  try {
    return await Promise.race([trabalho, limite]);
  } finally {
    clearTimeout(relogio);
    void (worker as { terminate(): Promise<unknown> } | null)?.terminate().catch(() => {});
  }
}

/** Leitura completa de uma imagem de comprovante. Lança erro se não conseguir (quem chama trata). */
export async function analisarPorOcr(dados: Buffer, mime: string, ctx: ContextoOcr): Promise<AnaliseComprovante | null> {
  if (!ocrDisponivel() || !TIPOS_OCR.includes(mime)) return null;
  return analisarTexto(await lerTextoDaImagem(dados), ctx);
}
