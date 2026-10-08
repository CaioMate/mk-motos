// Entrada da função da Vercel (empacotada por scripts/build-vercel.mjs em .vercel/output/functions/api.func/index.mjs).
// Cada instância é efêmera e pode haver várias ao mesmo tempo: o SQLite fica em /tmp, é baixado do Supabase na
// primeira requisição e conferido contra o marcador de revisão a cada requisição (ver Banco.conferirRevisao).
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type { IncomingMessage, ServerResponse } from 'node:http';
import type { Express } from 'express';
import { Banco } from './banco';
import { criarNuvem } from './nuvem';
import { criarApp, prepararBanco } from './app';
import { SENHA_MINIMA_VERCEL } from './login';

/** Variáveis sem as quais o sistema não pode rodar na Vercel. */
export const VARIAVEIS_OBRIGATORIAS = ['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY', 'SENHA_PAINEL', 'SESSAO_SEGREDO'] as const;

export function variaveisFaltando(): string[] {
  return VARIAVEIS_OBRIGATORIAS.filter((v) => !process.env[v]?.trim());
}

let instancia: Promise<Express> | undefined;

async function iniciar(): Promise<Express> {
  const nuvem = criarNuvem();
  if (!nuvem) throw new Error('Supabase não configurado.');
  // Pasta nova a cada partida: nunca reaproveita um SQLite velho de /tmp (poderia sobrescrever o Supabase).
  const pasta = fs.mkdtempSync(path.join(os.tmpdir(), 'mkmotos-'));
  const banco = new Banco(path.join(pasta, 'mkmotos.db'), nuvem);
  banco.usarRevisao = true;
  let ultimo: unknown;
  for (let t = 1; t <= 3; t++) {
    try {
      await banco.sincronizarComNuvem();
      ultimo = undefined;
      break;
    } catch (e) {
      ultimo = e;
      if (t < 3) await new Promise((r) => setTimeout(r, t * 1000));
    }
  }
  if (ultimo) throw ultimo;
  prepararBanco(banco);
  const { app } = criarApp({ banco, modo: 'vercel', porta: 443 });
  return app;
}

function responderJson(res: ServerResponse, status: number, erro: string) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify({ erro }));
}

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  const faltam = variaveisFaltando();
  if (faltam.length > 0) {
    return responderJson(
      res,
      503,
      `Configuração incompleta na Vercel: faltam as variáveis ${faltam.join(', ')}. Abra Settings > Environment Variables, preencha e faça um novo Deploy.`
    );
  }
  if ((process.env.SENHA_PAINEL ?? '').length < SENHA_MINIMA_VERCEL) {
    return responderJson(
      res,
      503,
      `SENHA_PAINEL é curta demais para ficar na internet: use pelo menos ${SENHA_MINIMA_VERCEL} caracteres. Altere em Settings > Environment Variables e faça um novo Deploy.`
    );
  }
  try {
    instancia ??= iniciar();
    const app = await instancia;
    app(req as never, res as never);
  } catch (e) {
    instancia = undefined; // a próxima requisição tenta de novo
    console.error('[vercel] falha ao iniciar:', e);
    const motivo = e instanceof Error ? e.message : String(e);
    responderJson(
      res,
      503,
      `Não consegui conectar ao Supabase (${motivo}). Confira SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, se o projeto não está pausado e se o arquivo supabase/esquema.sql foi executado.`
    );
  }
}
