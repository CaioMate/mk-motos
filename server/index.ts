import express, { type Request, type Response } from 'express';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs';
import { Banco } from './banco';
import { ErroNegocio, executarRotinas } from './automacao';
import { executarAcao } from './acoes';
import { carregarDemonstracao } from './demonstracao';
import { normalizarLeitura, rastreadoresDesconhecidos, registrarPosicao } from './gps';

const RAIZ = path.resolve(import.meta.dirname, '..');
if (fs.existsSync(path.join(RAIZ, '.env'))) process.loadEnvFile(path.join(RAIZ, '.env'));

const PRODUCAO = process.argv.includes('--producao');
const PORTA = Number(process.env.PORT) || 8000;
const ARQUIVO_BANCO = process.env.MKMOTOS_DB || path.join(RAIZ, 'data', 'mkmotos.db');

// ---------------------------------------------------------------- banco
const banco = new Banco(ARQUIVO_BANCO);
if (banco.vazio()) {
  console.log('Primeiro uso: carregando dados de demonstração (apague em Configurações > Banco de dados).');
  banco.transacao(() => carregarDemonstracao(banco));
}
banco.transacao(() => executarRotinas(banco));

// ---------------------------------------------------------------- tempo real (SSE)
const ouvintes = new Set<Response>();
let aviso: NodeJS.Timeout | undefined;
function notificarMudanca() {
  clearTimeout(aviso);
  aviso = setTimeout(() => {
    for (const res of ouvintes) res.write(`event: atualizado\ndata: ${Date.now()}\n\n`);
  }, 250);
}

// Rotinas automáticas (mensalidades, atrasos, contratos vencidos) a cada 15 minutos
setInterval(() => {
  try {
    banco.transacao(() => executarRotinas(banco));
    notificarMudanca();
  } catch (e) {
    console.error('Erro na rotina automática:', e);
  }
}, 15 * 60_000);

// ---------------------------------------------------------------- API
const app = express();
app.disable('x-powered-by');
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true }));

const api = express.Router();

function responderErro(res: Response, e: unknown) {
  if (e instanceof ErroNegocio) return res.status(400).json({ erro: e.message });
  const msg = e instanceof Error ? e.message : String(e);
  if (msg.includes('UNIQUE constraint failed')) {
    return res.status(400).json({ erro: 'Registro duplicado (CPF, placa ou rastreador já cadastrado).' });
  }
  console.error(e);
  return res.status(500).json({ erro: 'Erro interno no servidor. Veja o terminal para detalhes.' });
}

api.get('/estado', (_req, res) => {
  res.json(banco.estado());
});

api.post('/acoes/:nome', (req, res) => {
  try {
    const r = executarAcao(banco, req.params.nome, req.body);
    notificarMudanca();
    res.json({ ...r, estado: banco.estado() });
  } catch (e) {
    responderErro(res, e);
  }
});

api.get('/eventos', (req, res) => {
  res.set({ 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive' });
  res.flushHeaders();
  res.write(`event: conectado\ndata: ok\n\n`);
  ouvintes.add(res);
  const ping = setInterval(() => res.write(`: ping\n\n`), 25_000);
  req.on('close', () => {
    clearInterval(ping);
    ouvintes.delete(res);
  });
});

// GPS — aceita JSON simples, OsmAnd (Traccar Client), Traccar Client 9+ e encaminhamento do servidor Traccar.
const receberGps = (req: Request, res: Response) => {
  try {
    const leitura = normalizarLeitura(req.body, req.query as Record<string, unknown>);
    const r = registrarPosicao(banco, leitura);
    notificarMudanca();
    res.json({ ok: true, ...r });
  } catch (e) {
    if (e instanceof ErroNegocio) console.warn(`[GPS] ${e.message}`);
    responderErro(res, e);
  }
};
api.all('/gps', receberGps);
api.all('/gps/osmand', receberGps);
api.post('/gps/traccar', receberGps);

api.get('/gps/desconhecidos', (_req, res) => {
  res.json([...rastreadoresDesconhecidos.entries()].map(([id, v]) => ({ id, ...v })));
});

api.get('/gps/trajeto/:motoId', (req, res) => {
  const horas = Math.min(Number(req.query.horas) || 24, 24 * 31);
  const desde = new Date(Date.now() - horas * 3.6e6).toISOString();
  res.json(banco.trajeto(req.params.motoId, desde));
});

api.get('/relatorios/km', (req, res) => {
  const dias = Math.min(Number(req.query.dias) || 30, 3650);
  const desde = new Date(Date.now() - dias * 86_400_000).toISOString();
  res.json(banco.kmPorPeriodo(desde));
});

api.get('/rede', (_req, res) => {
  res.json({ porta: PORTA, enderecos: enderecosLocais().map((ip) => `http://${ip}:${PORTA}`) });
});

api.get('/backup', (_req, res) => {
  const nome = `mkmotos-backup-${new Date().toISOString().slice(0, 10)}.json`;
  res.setHeader('Content-Disposition', `attachment; filename="${nome}"`);
  res.json({ geradoEm: new Date().toISOString(), ...banco.estado(), atividades: banco.lista('atividades') });
});

api.use((_req, res) => res.status(404).json({ erro: 'Rota da API não encontrada.' }));
app.use('/api', api);

// ---------------------------------------------------------------- interface (React)
const servidor = http.createServer(app);

if (PRODUCAO) {
  const dist = path.join(RAIZ, 'dist');
  if (!fs.existsSync(path.join(dist, 'index.html'))) {
    console.error('Pasta dist/ não encontrada. Rode "npm run build" ou use "npm start".');
    process.exit(1);
  }
  app.use(express.static(dist, { index: false, maxAge: '1h' }));
  app.get('*', (_req, res) => res.sendFile(path.join(dist, 'index.html')));
} else {
  const { createServer } = await import('vite');
  const vite = await createServer({
    root: RAIZ,
    server: { middlewareMode: true, hmr: { server: servidor } },
    appType: 'spa',
  });
  app.use(vite.middlewares);
}

function enderecosLocais(): string[] {
  return Object.values(os.networkInterfaces())
    .flat()
    .filter((i): i is os.NetworkInterfaceInfo => !!i && i.family === 'IPv4' && !i.internal)
    .map((i) => i.address);
}

servidor.listen(PORTA, '0.0.0.0', () => {
  console.log('');
  console.log(`  MK MOTOS rodando (${PRODUCAO ? 'produção' : 'desenvolvimento'})`);
  console.log(`  Neste computador:   http://localhost:${PORTA}`);
  for (const ip of enderecosLocais()) console.log(`  Na rede local:      http://${ip}:${PORTA}`);
  console.log(`  Endereço do GPS:    http://<IP-acima>:${PORTA}/api/gps`);
  console.log(`  Banco de dados:     ${ARQUIVO_BANCO}`);
  console.log('');
});
