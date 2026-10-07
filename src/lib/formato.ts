const moeda = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
const moedaInteira = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
  maximumFractionDigits: 0,
});

/** R$ 1.234,56 */
export const brl = (v: number) => moeda.format(v || 0);

/** R$ 1.235 (para indicadores) */
export const brlCurto = (v: number) => moedaInteira.format(v || 0);

export const km = (v: number) =>
  `${(v || 0).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} km`;

export const pct = (v: number) =>
  `${(v || 0).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%`;

export const somenteDigitos = (s: string) => (s || '').replace(/\D/g, '');

/** Valida CPF pelos dígitos verificadores. */
export function cpfValido(cpf: string): boolean {
  const d = somenteDigitos(cpf);
  if (d.length !== 11 || /^(\d)\1{10}$/.test(d)) return false;
  const calc = (len: number) => {
    let soma = 0;
    for (let i = 0; i < len; i++) soma += Number(d[i]) * (len + 1 - i);
    const r = (soma * 10) % 11;
    return r === 10 ? 0 : r;
  };
  return calc(9) === Number(d[9]) && calc(10) === Number(d[10]);
}

export function formatarCpf(cpf: string): string {
  const d = somenteDigitos(cpf).slice(0, 11);
  return d
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d{1,2})$/, '$1-$2');
}

/** Link do WhatsApp (wa.me) para o telefone, assumindo DDI 55 quando ausente. */
export function linkWhatsApp(telefone: string, mensagem: string): string {
  let d = somenteDigitos(telefone);
  if (d.length <= 11) d = `55${d}`;
  return `https://wa.me/${d}?text=${encodeURIComponent(mensagem)}`;
}

export const linkMapa = (lat: number, lon: number) =>
  `https://www.google.com/maps?q=${lat},${lon}`;
