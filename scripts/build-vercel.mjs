// Gera .vercel/output (Build Output API v3) para publicar na Vercel:
//   static/                 -> o front (vite build, pasta dist)
//   functions/api.func/     -> servidor Express empacotado em um único index.mjs (esbuild)
//   config.json             -> /api/* vai para a função; o resto é arquivo estático com fallback para index.html
// Uso: npm run build:vercel  (a Vercel chama pelo "buildCommand" do vercel.json)
import fs from 'node:fs';
import path from 'node:path';
import { build as viteBuild } from 'vite';
import { build as esbuild } from 'esbuild';

const raiz = path.resolve(import.meta.dirname, '..');
const saida = path.join(raiz, '.vercel', 'output');
const funcao = path.join(saida, 'functions', 'api.func');

// 1) front
await viteBuild({ root: raiz });

// 2) pasta de saída limpa
fs.rmSync(saida, { recursive: true, force: true });
fs.mkdirSync(funcao, { recursive: true });
fs.cpSync(path.join(raiz, 'dist'), path.join(saida, 'static'), { recursive: true });

// 3) servidor em um arquivo só (sem node_modules na função). node:sqlite é do próprio Node 22+.
await esbuild({
  entryPoints: [path.join(raiz, 'server', 'vercel.ts')],
  outfile: path.join(funcao, 'index.mjs'),
  bundle: true,
  platform: 'node',
  format: 'esm',
  target: 'node22',
  legalComments: 'none',
  logLevel: 'info',
  // pacotes CommonJS (express etc.) dentro de um módulo ESM precisam de "require"
  banner: {
    js: "import { createRequire as __criarRequire } from 'node:module'; const require = __criarRequire(import.meta.url);",
  },
});

fs.writeFileSync(
  path.join(funcao, '.vc-config.json'),
  JSON.stringify(
    {
      runtime: 'nodejs22.x',
      handler: 'index.mjs',
      launcherType: 'Nodejs',
      shouldAddHelpers: false, // o Express lê o corpo da requisição sozinho
      maxDuration: 60,
    },
    null,
    2
  )
);

// Cabeçalhos de segurança dos arquivos estáticos (a API também os envia por conta própria).
// ATENÇÃO: manter igual a server/seguranca.ts (CSP e PERMISSIONS_POLICY).
const CSP =
  "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; " +
  "font-src 'self' https://fonts.gstatic.com; img-src 'self' data: blob:; connect-src 'self' https://nominatim.openstreetmap.org; " +
  "object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'";
const CABECALHOS = {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Referrer-Policy': 'same-origin',
  'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
  'Permissions-Policy': 'camera=(self), microphone=(), geolocation=(), payment=(), usb=()',
  'Content-Security-Policy': CSP,
};

// 4) rotas + cron (o horário vem do vercel.json, para ter um lugar só)
const vercelJson = JSON.parse(fs.readFileSync(path.join(raiz, 'vercel.json'), 'utf8'));
fs.writeFileSync(
  path.join(saida, 'config.json'),
  JSON.stringify(
    {
      version: 3,
      routes: [
        { src: '/(.*)', headers: CABECALHOS, continue: true },
        { src: '^/api(?:/.*)?$', dest: '/api' },
        { handle: 'filesystem' },
        { src: '/(.*)', dest: '/index.html' },
      ],
      crons: vercelJson.crons ?? [],
    },
    null,
    2
  )
);

console.log('\n  Pacote da Vercel pronto em .vercel/output');
