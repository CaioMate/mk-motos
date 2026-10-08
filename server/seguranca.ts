// Proteções gerais da API: cabeçalhos de segurança, CSRF, token do GPS, conferência de arquivos enviados.
import crypto from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';
import { conexaoSegura, exigeLogin, iguais } from './login';

// ---------------------------------------------------------------- cabeçalhos de segurança
// ATENÇÃO: scripts/build-vercel.mjs repete esta lista no config.json (arquivos estáticos); mantenha as duas iguais.
// Fontes do Google (index.html) e busca de cidades (Nominatim, em Configurações). Estilos inline: motion/tailwind usam style="".
export const CSP =
  "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; " +
  "font-src 'self' https://fonts.gstatic.com; img-src 'self' data: blob:; connect-src 'self' https://nominatim.openstreetmap.org; " +
  "object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'";
export const PERMISSIONS_POLICY = 'camera=(self), microphone=(), geolocation=(), payment=(), usb=()';

/** @param comCsp false no `npm run dev` (o Vite injeta scripts inline e usa WebSocket para recarregar a página) */
export function cabecalhosSeguranca(comCsp: boolean, vercel: boolean) {
  return (req: Request, res: Response, next: NextFunction) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('Referrer-Policy', 'same-origin');
    res.setHeader('Permissions-Policy', PERMISSIONS_POLICY);
    if (comCsp) res.setHeader('Content-Security-Policy', CSP);
    if (vercel || conexaoSegura(req)) res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
    next();
  };
}

// ---------------------------------------------------------------- CSRF
const METODOS_ESCRITA = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);
/** Montado em /api: o caminho aqui não tem o prefixo. GPS, webhook do WhatsApp e cron são chamados por máquinas, não por navegadores. */
const ISENTAS_CSRF = /^\/(gps(\/(osmand|traccar))?|whatsapp\/webhook|cron)\/?$/;

function mesmoHost(url: string, host: string | undefined): boolean {
  try {
    return !!host && new URL(url).host.toLowerCase() === host.toLowerCase();
  } catch {
    return false; // inclui Origin "null"
  }
}

export function protecaoCsrf(req: Request, res: Response, next: NextFunction) {
  if (!METODOS_ESCRITA.has(req.method) || ISENTAS_CSRF.test(req.path)) return next();
  if (!/^application\/json\b/i.test(req.headers['content-type'] ?? '')) {
    return res.status(415).json({ erro: 'Requisição recusada: envie os dados como JSON.' });
  }
  const origem = req.headers.origin ?? req.headers.referer;
  if (origem && !mesmoHost(origem, req.headers.host)) {
    return res.status(403).json({ erro: 'Requisição recusada: origem diferente do site.' });
  }
  next();
}

// ---------------------------------------------------------------- token do GPS
/**
 * Token que os rastreadores precisam enviar. `GPS_TOKEN` (.env / Vercel) manda; sem ela, quando o painel tem senha,
 * usa um token fixo derivado do segredo de sessão (igual em todos os servidores; muda se a senha/SESSAO_SEGREDO mudar).
 * Sem senha e sem GPS_TOKEN (só rede local) o token é opcional: devolve null.
 */
export function gpsToken(): string | null {
  const definido = process.env.GPS_TOKEN?.trim();
  if (definido) return definido;
  if (!exigeLogin()) return null;
  const base = process.env.SESSAO_SEGREDO || process.env.SENHA_PAINEL || '';
  return crypto.createHmac('sha256', `mkmotos-gps:${base}`).update('token-gps').digest('hex').slice(0, 32);
}

function tokenEnviado(req: Request): string {
  const q = req.query.token;
  if (typeof q === 'string' && q) return q;
  const auth = req.headers.authorization;
  if (auth?.toLowerCase().startsWith('bearer ')) return auth.slice(7).trim();
  const h = req.headers['x-gps-token'];
  return (Array.isArray(h) ? h[0] : h) ?? '';
}

export function exigirTokenGps(req: Request, res: Response, next: NextFunction) {
  const esperado = gpsToken();
  if (esperado === null) return next();
  if (!iguais(tokenEnviado(req), esperado)) return res.status(401).json({ erro: 'Token do GPS ausente ou inválido.' });
  next();
}

// ---------------------------------------------------------------- arquivos enviados: conferir os primeiros bytes
const ASSINATURAS: Record<string, (b: Buffer) => boolean> = {
  'image/jpeg': (b) => b.length > 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff,
  'image/png': (b) => b.length > 4 && b.subarray(0, 4).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47])),
  'image/webp': (b) => b.length > 12 && b.toString('latin1', 0, 4) === 'RIFF' && b.toString('latin1', 8, 12) === 'WEBP',
  'image/gif': (b) => b.length > 4 && b.toString('latin1', 0, 4) === 'GIF8',
  'application/pdf': (b) => b.length > 4 && b.toString('latin1', 0, 4) === '%PDF',
};
/** false se o tipo é conhecido mas os bytes iniciais não batem (arquivo disfarçado). Tipo desconhecido: quem chama decide. */
export function conteudoCombinaComMime(dados: Buffer, mime: string): boolean {
  const confere = Object.hasOwn(ASSINATURAS, mime) ? ASSINATURAS[mime] : undefined;
  return confere ? confere(dados) : true;
}

// ---------------------------------------------------------------- objetos vindos do usuário
const CHAVES_PERIGOSAS = new Set(['__proto__', 'constructor', 'prototype']);
/** Remove, em qualquer nível, chaves que poderiam poluir protótipos. */
export function limparChaves<T>(valor: T): T {
  if (Array.isArray(valor)) return valor.map(limparChaves) as T;
  if (valor && typeof valor === 'object') {
    const saida: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(valor)) if (!CHAVES_PERIGOSAS.has(k)) saida[k] = limparChaves(v);
    return saida as T;
  }
  return valor;
}
