import crypto from 'node:crypto';
import express, { type NextFunction, type Request, type Response } from 'express';
import type { ArmazenamentoNuvem } from './nuvem';

// Login do painel por senha única (variável SENHA_PAINEL). Sem a variável, o painel funciona como antes
// (rede local sem login; acesso pela internet bloqueado, exceto rotas públicas).

const NOME_COOKIE = 'mk_sessao';
const VALIDADE_MS = 30 * 24 * 3600_000;
const MAX_ERROS = 5;
const BLOQUEIO_MS = 15 * 60_000;
// Limite GLOBAL (todos os IPs somados) contra força bruta distribuída: mais de 30 senhas erradas em 1 hora
// bloqueiam TODOS os logins por 15 minutos.
const MAX_ERROS_GLOBAL = 30;
const JANELA_GLOBAL_MS = 3600_000;
const CHAVE_GLOBAL = '__global__';
export const SENHA_MINIMA_VERCEL = 10;

// ---------------------------------------------------------------- IP do cliente e HTTPS
// NÃO confiamos em X-Forwarded-For (o cliente pode inventar). Só valem cabeçalhos que a plataforma define:
//  - Vercel: x-vercel-forwarded-for / x-real-ip (a Vercel sempre sobrescreve);
//  - local atrás do túnel Cloudflare: cf-connecting-ip, mas só se a conexão vier do próprio computador (o túnel);
//  - senão: o IP do socket.
let modoVercel = !!process.env.VERCEL;
export function definirModoVercel(v: boolean) {
  modoVercel = v;
}
const ehLoopback = (ip: string | undefined) => !!ip && /^(::1|127\.\d+\.\d+\.\d+|::ffff:127\.\d+\.\d+\.\d+)$/.test(ip);
const primeiro = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v)?.split(',')[0]?.trim() || undefined;

export function ipDoCliente(req: Request): string {
  const socket = req.socket?.remoteAddress;
  if (modoVercel) return primeiro(req.headers['x-vercel-forwarded-for']) || primeiro(req.headers['x-real-ip']) || socket || 'desconhecido';
  if (ehLoopback(socket)) return primeiro(req.headers['cf-connecting-ip']) || socket || 'desconhecido';
  return socket || 'desconhecido';
}

/** A conexão do cliente é HTTPS? (na Vercel sempre; local: o túnel avisa por x-forwarded-proto vindo do próprio computador) */
export function conexaoSegura(req: Request): boolean {
  if (modoVercel) return true;
  if (req.socket && 'encrypted' in req.socket && req.socket.encrypted) return true;
  return ehLoopback(req.socket?.remoteAddress) && primeiro(req.headers['x-forwarded-proto']) === 'https';
}

// Lidas na hora de usar, porque o .env só é carregado depois dos imports.
export const senhaPainel = () => process.env.SENHA_PAINEL || '';
export const exigeLogin = () => senhaPainel().length > 0;

// O segredo do cookie é FIXO (não muda a cada reinício nem entre servidores da Vercel): vem de SESSAO_SEGREDO e,
// se ela não existir, da própria senha (trocar a senha invalida as sessões antigas).
const segredo = () =>
  crypto.createHash('sha256').update(`mkmotos-sessao:${process.env.SESSAO_SEGREDO || senhaPainel()}`).digest();
const assinar = (texto: string) => crypto.createHmac('sha256', segredo()).update(texto).digest('hex');

export function iguais(a: string, b: string): boolean {
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
  if (conexaoSegura(req)) partes.push('Secure');
  res.append('Set-Cookie', partes.join('; '));
}

// ---------------------------------------------------------------- proteção contra força bruta (por IP)
export interface RegistroTentativas {
  erros: number;
  bloqueadoAte: number;
  /** Só no registro global: início da janela de 1 hora. */
  inicio?: number;
}
/** Onde ficam as tentativas erradas: memória (servidor único) ou Supabase (vários servidores na Vercel). */
export interface ArmazemTentativas {
  ler(ip: string): Promise<RegistroTentativas | undefined>;
  gravar(ip: string, reg: RegistroTentativas): Promise<void>;
  apagar(ip: string): Promise<void>;
}

function tentativasEmMemoria(): ArmazemTentativas {
  const mapa = new Map<string, RegistroTentativas>();
  return {
    async ler(ip) {
      return mapa.get(ip);
    },
    async gravar(ip, reg) {
      mapa.set(ip, reg);
      // limpeza simples de registros vencidos
      for (const [chave, v] of mapa) if (v.erros === 0 && v.bloqueadoAte < Date.now()) mapa.delete(chave);
    },
    async apagar(ip) {
      mapa.delete(ip);
    },
  };
}

/** Tentativas guardadas no Supabase (documento meta 'login:<hash do IP>'): valem para todos os servidores. */
export function tentativasNaNuvem(nuvem: ArmazenamentoNuvem): ArmazemTentativas {
  const id = (ip: string) => `login:${crypto.createHash('sha256').update(ip).digest('hex').slice(0, 24)}`;
  return {
    async ler(ip) {
      const d = (await nuvem.lerMeta(id(ip))) as Partial<RegistroTentativas> | null;
      return d && typeof d.erros === 'number'
        ? { erros: d.erros, bloqueadoAte: Number(d.bloqueadoAte) || 0, inicio: Number(d.inicio) || undefined }
        : undefined;
    },
    async gravar(ip, reg) {
      await nuvem.gravarMeta(id(ip), reg);
    },
    async apagar(ip) {
      await nuvem.apagarMeta(id(ip));
    },
  };
}

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
    // (cabeçalho falso só deixa mais restrito; por isso aqui pode olhar os cabeçalhos do cliente)
    const viaInternet = !!(req.headers['cf-connecting-ip'] || req.headers['x-forwarded-for'] || req.headers['cf-ray']);
    if (viaInternet && !rotasPublicas.some((r) => r.test(req.path))) {
      return res.status(403).send('Acesso ao painel permitido somente pela rede local.');
    }
    next();
  };
}

// ---------------------------------------------------------------- rotas /api/login, /api/logout, /api/sessao
export interface OpcoesLogin {
  tentativas?: ArmazemTentativas;
  /** Campos extras devolvidos em /api/sessao (ex.: se o tempo real está disponível). */
  infoSessao?: () => Record<string, unknown>;
}

export function rotasLogin(api: express.Router, opcoes: OpcoesLogin = {}) {
  const tentativas = opcoes.tentativas ?? tentativasEmMemoria();
  api.post('/login', async (req, res) => {
    if (!exigeLogin()) return res.json({ ok: true });
    try {
      const ip = ipDoCliente(req);
      const global = (await tentativas.ler(CHAVE_GLOBAL)) ?? { erros: 0, bloqueadoAte: 0, inicio: 0 };
      if (global.bloqueadoAte > Date.now()) {
        return res.status(429).json({
          erro: `Muitas tentativas erradas no sistema todo. Por segurança, aguarde ${minutosRestantes(global.bloqueadoAte)} minuto(s) e tente de novo.`,
        });
      }
      const reg = await tentativas.ler(ip);
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
        await tentativas.gravar(ip, atual);
        if (!global.inicio || Date.now() - global.inicio > JANELA_GLOBAL_MS) {
          global.erros = 0;
          global.inicio = Date.now();
        }
        global.erros += 1;
        if (global.erros > MAX_ERROS_GLOBAL) {
          global.bloqueadoAte = Date.now() + BLOQUEIO_MS;
          global.erros = 0;
          global.inicio = 0;
        }
        await tentativas.gravar(CHAVE_GLOBAL, global);
        return res.status(401).json({ erro: 'Senha incorreta.' });
      }
      if (reg) await tentativas.apagar(ip);
      definirCookie(req, res, criarToken(), VALIDADE_MS / 1000);
      res.json({ ok: true });
    } catch (e) {
      console.error('[login]', e);
      res.status(503).json({ erro: 'Não consegui verificar a senha agora (falha ao falar com o Supabase). Tente de novo em instantes.' });
    }
  });

  api.post('/logout', (req, res) => {
    definirCookie(req, res, '', 0);
    res.json({ ok: true });
  });

  api.get('/sessao', (req, res) => {
    res.json({ logado: exigeLogin() ? sessaoValida(req) : true, exigeLogin: exigeLogin(), ...opcoes.infoSessao?.() });
  });
}
