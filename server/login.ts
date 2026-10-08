import crypto from 'node:crypto';
import express, { type NextFunction, type Request, type Response } from 'express';

// Login do painel por senha única (variável SENHA_PAINEL). Sem a variável, o painel funciona como antes
// (rede local sem login; acesso pela internet bloqueado, exceto rotas públicas).

const NOME_COOKIE = 'mk_sessao';
const VALIDADE_MS = 30 * 24 * 3600_000;
const MAX_ERROS = 5;
const BLOQUEIO_MS = 15 * 60_000;

// Lidas na hora de usar, porque o .env só é carregado depois dos imports.
export const senhaPainel = () => process.env.SENHA_PAINEL || '';
export const exigeLogin = () => senhaPainel().length > 0;

// O segredo vem da senha: trocar a senha invalida todas as sessões antigas.
const segredo = () => crypto.createHash('sha256').update(`mkmotos-sessao:${senhaPainel()}`).digest();
const assinar = (texto: string) => crypto.createHmac('sha256', segredo()).update(texto).digest('hex');

function iguais(a: string, b: string): boolean {
  const ha = crypto.createHash('sha256').update(a).digest();
  const hb = crypto.createHash('sha256').update(b).digest();
  return crypto.timingSafeEqual(ha, hb);
}

function criarToken(): string {
  const expira = String(Date.now() + VALIDADE_MS);
  return `${expira}.${assinar(expira)}`;
}

function lerCookie(req: Request, nome: string): string | undefined {
  for (const parte of (req.headers.cookie || '').split(';')) {
    const i = parte.indexOf('=');
    if (i > 0 && parte.slice(0, i).trim() === nome) return decodeURIComponent(parte.slice(i + 1).trim());
  }
  return undefined;
}

export function sessaoValida(req: Request): boolean {
  if (!exigeLogin()) return false;
  const token = lerCookie(req, NOME_COOKIE);
  if (!token) return false;
  const [expira, assinatura] = token.split('.');
  if (!expira || !assinatura || !/^\d+$/.test(expira) || Number(expira) < Date.now()) return false;
  return iguais(assinatura, assinar(expira));
}

function definirCookie(req: Request, res: Response, valor: string, maxAgeSeg: number) {
  const partes = [`${NOME_COOKIE}=${encodeURIComponent(valor)}`, 'Path=/', 'HttpOnly', 'SameSite=Lax', `Max-Age=${maxAgeSeg}`];
  if (req.secure) partes.push('Secure');
  res.append('Set-Cookie', partes.join('; '));
}

// ---------------------------------------------------------------- proteção contra força bruta (por IP, em memória)
const tentativas = new Map<string, { erros: number; bloqueadoAte: number }>();

function minutosRestantes(ate: number) {
  return Math.max(1, Math.ceil((ate - Date.now()) / 60_000));
}

// ---------------------------------------------------------------- porteiro (antes de tudo)
const ROTAS_LOGIN = /^\/api\/(login|logout|sessao)\/?$/;

export function porteiro(rotasPublicas: RegExp[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (exigeLogin()) {
      // Arquivos do front (HTML/JS/CSS) não têm dados: passam. Só a API é protegida.
      if (!req.path.startsWith('/api')) return next();
      if (rotasPublicas.some((r) => r.test(req.path)) || ROTAS_LOGIN.test(req.path)) return next();
      if (sessaoValida(req)) return next();
      return res.status(401).json({ erro: 'Faça login para continuar.' });
    }
    // Sem senha: internet (túnel/proxy) só acessa as rotas públicas; o painel fica na rede local.
    const viaInternet = !!(req.headers['cf-connecting-ip'] || req.headers['x-forwarded-for'] || req.headers['cf-ray']);
    if (viaInternet && !rotasPublicas.some((r) => r.test(req.path))) {
      return res.status(403).send('Acesso ao painel permitido somente pela rede local.');
    }
    next();
  };
}

// ---------------------------------------------------------------- rotas /api/login, /api/logout, /api/sessao
export function rotasLogin(api: express.Router) {
  api.post('/login', (req, res) => {
    if (!exigeLogin()) return res.json({ ok: true });
    const ip = req.ip || 'desconhecido';
    const reg = tentativas.get(ip);
    if (reg && reg.bloqueadoAte > Date.now()) {
      return res.status(429).json({
        erro: `Muitas tentativas erradas. Aguarde ${minutosRestantes(reg.bloqueadoAte)} minuto(s) e tente de novo.`,
      });
    }
    const senha = typeof req.body?.senha === 'string' ? req.body.senha : '';
    if (!iguais(senha, senhaPainel())) {
      const atual = reg ?? { erros: 0, bloqueadoAte: 0 };
      atual.erros += 1;
      if (atual.erros >= MAX_ERROS) {
        atual.bloqueadoAte = Date.now() + BLOQUEIO_MS;
        atual.erros = 0;
      }
      tentativas.set(ip, atual);
      // limpeza simples de registros vencidos
      for (const [chave, v] of tentativas) if (v.erros === 0 && v.bloqueadoAte < Date.now()) tentativas.delete(chave);
      return res.status(401).json({ erro: 'Senha incorreta.' });
    }
    tentativas.delete(ip);
    definirCookie(req, res, criarToken(), VALIDADE_MS / 1000);
    res.json({ ok: true });
  });

  api.post('/logout', (req, res) => {
    definirCookie(req, res, '', 0);
    res.json({ ok: true });
  });

  api.get('/sessao', (req, res) => {
    res.json({ logado: exigeLogin() ? sessaoValida(req) : true, exigeLogin: exigeLogin() });
  });
}
