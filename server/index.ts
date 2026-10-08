import express from 'express';
import http from 'node:http';
import path from 'node:path';
import fs from 'node:fs';
import { Banco } from './banco';
import { criarNuvem } from './nuvem';
import { processarFila, whatsappConfigurado } from './whatsapp';
import { iaConfigurada } from './agente';
import { exigeLogin } from './login';
import { criarApp, enderecosLocais, prepararBanco } from './app';

const RAIZ = path.resolve(import.meta.dirname, '..');
if (fs.existsSync(path.join(RAIZ, '.env'))) process.loadEnvFile(path.join(RAIZ, '.env'));

const PRODUCAO = process.argv.includes('--producao');
const PORTA = Number(process.env.PORT) || 8000;
const ARQUIVO_BANCO = process.env.MKMOTOS_DB || path.join(RAIZ, 'data', 'mkmotos.db');

// ---------------------------------------------------------------- banco
const nuvem = criarNuvem();
const banco = new Banco(ARQUIVO_BANCO, nuvem);
if (nuvem) {
  // Antes de abrir o servidor: traz tudo do Supabase. Se não responder, ENCERRA (subir com o banco vazio
  // e depois gravar por cima apagaria os dados permanentes).
  console.log('  Conectando ao Supabase...');
  const TENTATIVAS = 5;
  for (let t = 1; ; t++) {
    try {
      await banco.sincronizarComNuvem();
      break;
    } catch (e) {
      const motivo = e instanceof Error ? e.message : String(e);
      if (t >= TENTATIVAS) {
        console.error(
          `\n  ERRO: não consegui falar com o Supabase depois de ${TENTATIVAS} tentativas (${motivo}).\n` +
            '  O sistema NÃO foi iniciado para não perder dados. Confira SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY,\n' +
            '  se o projeto do Supabase não está pausado e se o arquivo supabase/esquema.sql foi executado.\n'
        );
        process.exit(1);
      }
      console.warn(`  Supabase não respondeu (${motivo}). Tentativa ${t}/${TENTATIVAS}; nova tentativa em ${t * 3}s...`);
      await new Promise((r) => setTimeout(r, t * 3000));
    }
  }
}
// ---------------------------------------------------------------- API (rotas em server/app.ts)
prepararBanco(banco);
const { app, notificarMudanca, rodarRotinas } = criarApp({ banco, modo: 'local', porta: PORTA, producao: PRODUCAO });

// Rotinas automáticas (mensalidades, atrasos, contratos vencidos) a cada 15 minutos
setInterval(() => {
  rodarRotinas().catch((e) => console.error('Erro na rotina automática:', e));
}, 15 * 60_000);

// Fila do WhatsApp: envia as mensagens pendentes a cada 5 segundos
setInterval(() => {
  processarFila(banco, notificarMudanca).catch((e) => console.error('Erro na fila do WhatsApp:', e));
}, 5_000);

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

servidor.listen(PORTA, '0.0.0.0', () => {
  console.log('');
  console.log(`  MK MOTOS rodando (${PRODUCAO ? 'produção' : 'desenvolvimento'})`);
  console.log(`  Neste computador:   http://localhost:${PORTA}`);
  for (const ip of enderecosLocais()) console.log(`  Na rede local:      http://${ip}:${PORTA}`);
  console.log(`  Endereço do GPS:    http://<IP-acima>:${PORTA}/api/gps`);
  console.log(`  Banco de dados:     ${ARQUIVO_BANCO}`);
  console.log(`  WhatsApp (Meta):    ${whatsappConfigurado() ? 'configurado' : 'não configurado (veja Configurações > WhatsApp)'}`);
  console.log(`  Agente de IA:       ${iaConfigurada() ? 'configurado' : 'não configurado (ANTHROPIC_API_KEY)'}`);
  console.log(
    exigeLogin()
      ? '  Login do painel:    ativado (SENHA_PAINEL) - pode usar pela internet'
      : '  Login do painel:    DESLIGADO - só rede local. Para usar pela internet, defina SENHA_PAINEL no .env'
  );
  console.log('');
});

// Desligamento (Render manda SIGTERM a cada deploy/reinício): termina de enviar ao Supabase, no máximo ~8 s.
if (nuvem) {
  let encerrando = false;
  const encerrar = async (sinal: string) => {
    if (encerrando) return;
    encerrando = true;
    console.log(`  ${sinal} recebido: enviando o que falta ao Supabase (${banco.pendentesNuvem} item(ns))...`);
    servidor.close();
    const limite = new Promise<boolean>((r) => setTimeout(() => r(false), 8000));
    const ok = await Promise.race([banco.esvaziarNuvem(8000), limite]).catch(() => false);
    console.log(ok ? '  Tudo enviado. Até logo!' : `  Não deu tempo de enviar tudo (${banco.pendentesNuvem} item(ns) ficaram para trás).`);
    process.exit(0);
  };
  process.on('SIGTERM', () => void encerrar('SIGTERM'));
  process.on('SIGINT', () => void encerrar('SIGINT'));
}
