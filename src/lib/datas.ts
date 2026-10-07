// Datas no padrão brasileiro dd/mm/aaaa — usado no servidor e na interface.

const MESES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
];
export const MESES_CURTOS = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

/** "05/10/2026" → Date (meia-noite local). Retorna null se inválida. */
export function parseBR(texto: string | undefined | null): Date | null {
  if (!texto) return null;
  const m = texto.trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!m) return null;
  const [, d, mes, a] = m.map(Number);
  const data = new Date(a, mes - 1, d);
  if (data.getFullYear() !== a || data.getMonth() !== mes - 1 || data.getDate() !== d) return null;
  return data;
}

export function dataValidaBR(texto: string): boolean {
  return parseBR(texto) !== null;
}

export function formatBR(data: Date): string {
  const d = String(data.getDate()).padStart(2, '0');
  const m = String(data.getMonth() + 1).padStart(2, '0');
  return `${d}/${m}/${data.getFullYear()}`;
}

export function inicioDoDia(data = new Date()): Date {
  return new Date(data.getFullYear(), data.getMonth(), data.getDate());
}

export function hojeBR(): string {
  return formatBR(new Date());
}

export function somarDias(data: Date, dias: number): Date {
  const r = new Date(data);
  r.setDate(r.getDate() + dias);
  return r;
}

/** Soma meses mantendo o dia (31/01 + 1 mês → 28/02 ou 29/02). */
export function somarMeses(data: Date, meses: number): Date {
  const dia = data.getDate();
  const r = new Date(data.getFullYear(), data.getMonth() + meses, 1);
  const ultimoDia = new Date(r.getFullYear(), r.getMonth() + 1, 0).getDate();
  r.setDate(Math.min(dia, ultimoDia));
  return r;
}

export function competenciaDe(data: Date): string {
  return `${MESES[data.getMonth()]}/${data.getFullYear()}`;
}

/** "Outubro/2026" → { mes: 9, ano: 2026 } */
export function parseCompetencia(comp: string): { mes: number; ano: number } | null {
  const [nome, ano] = comp.split('/');
  const mes = MESES.indexOf(nome);
  if (mes < 0 || !ano) return null;
  return { mes, ano: Number(ano) };
}

export function diasEntre(a: Date, b: Date): number {
  return Math.round((inicioDoDia(b).getTime() - inicioDoDia(a).getTime()) / 86_400_000);
}

/** "Agora mesmo", "Há 5 min", "Há 3 horas", "Há 2 dias", ou a data. */
export function tempoRelativo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const min = Math.floor(diff / 60_000);
  if (min < 1) return 'Agora mesmo';
  if (min < 60) return `Há ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `Há ${h} hora${h > 1 ? 's' : ''}`;
  const d = Math.floor(h / 24);
  if (d < 7) return `Há ${d} dia${d > 1 ? 's' : ''}`;
  return formatBR(new Date(iso));
}
