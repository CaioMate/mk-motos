// Cria o aplicativo Express (rotas da API). Quem abre a porta e roda os temporizadores é server/index.ts (modo local,
// servidor longo); na Vercel quem chama é server/vercel.ts (uma função por requisição, sem temporizadores).
import express, { type NextFunction, type Request, type Response } from 'express';
import os from 'node:os';
import path from 'node:path';
import type { Banco } from './banco';
import { ErroNuvem } from './nuvem';
import { ErroNegocio, executarRotinas, migrarDados, registrarAtividade } from './automacao';
import { executarAcao, existeAcao } from './acoes';
import { normalizarLeitura, rastreadoresDesconhecidos, registrarPosicao, viagensDaMoto } from './gps';
import { assinaturaValida, filaPendente, segredoWhatsappConfigurado, processarFila, tokenVerificacao, whatsappConfigurado } from './whatsapp';
import { iaConfigurada, provedorDeLeitura } from './agente';
import { processarWebhook, registrarComprovante } from './atendimento';
import { definirModoVercel, exigeLogin, iguais, porteiro, rotasLogin, tentativasNaNuvem } from './login';
import { cabecalhosSeguranca, conteudoCombinaComMime, exigirTokenGps, gpsToken, protecaoCsrf } from './seguranca';
import type { ManutencaoItem, Moto } from '../src/types/mkMotos';

const MB = 1024 * 1024;
const dormir = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
/** Intervalo mínimo entre duas execuções das rotinas (mensalidades, atrasos...) quando não há temporizador. */
const INTERVALO_ROTINAS_MS = 15 * 60_000;

export interface OpcoesApp {
  banco: Banco;
  /** 'local' = servidor longo (computador/VPS); 'vercel' = função efêmera, vários servidores ao mesmo tempo. */
  modo: 'local' | 'vercel';
  porta: number;
  /** false só no `npm run dev` (Vite precisa de scripts inline): desliga a Content-Security-Policy. */
  producao?: boolean;
}

/** Tudo o que precisa acontecer depois de abrir o banco (e baixar do Supabase), em qualquer modo. */
export function prepararBanco(banco: Banco) {
  banco.transacao(() => {
    migrarDados(banco);
    executarRotinas(banco);
  });
  banco.statusIntegracoes = () => ({
    whatsappConfigurado: whatsappConfigurado(),
    iaConfigurada: iaConfigurada(),
    iaProvedor: provedorDeLeitura(),
    filaPendente: filaPendente(banco),
  });
}

export function enderecosLocais(): string[] {
  return Object.values(os.networkInterfaces())
    .flat()
    .filter((i): i is os.NetworkInterfaceInfo => !!i && i.family === 'IPv4' && !i.internal)
    .map((i) => i.address);
}

export function criarApp({ banco, modo, porta, producao = true }: OpcoesApp) {
  const vercel = modo === 'vercel';
  definirModoVercel(vercel);
  // Na Vercel o corpo da requisição não passa de 4,5 MB (base64 incha o arquivo em 1/3): arquivos de até 3 MB.
  const limiteUploadBytes = vercel ? 3 * MB : 10 * MB;
  const limiteFotoBytes = vercel ? 3 * MB : 5 * MB;

  // ---------------------------------------------------------------- tempo real (SSE) — só no modo local
  const ouvintes = new Set<Response>();
  let aviso: NodeJS.Timeout | undefined;
  function notificarMudanca() {
    if (vercel) return;
    clearTimeout(aviso);
    aviso = setTimeout(() => {
      for (const res of ouvintes) res.write(`event: atualizado\ndata: ${Date.now()}\n\n`);
    }, 250);
  }

  /**
   * Na Vercel a função "congela" depois da resposta: antes de responder, o que foi gravado precisa estar no Supabase
   * e as mensagens de WhatsApp pendentes precisam ter saído. Falha -> ErroNuvem (HTTP 503), sem fingir sucesso.
   */
  async function concluirGravacao() {
    if (!vercel) return;
    await banco.garantirEnvio();
    if (whatsappConfigurado() && filaPendente(banco) > 0) {
      await Promise.race([processarFila(banco, notificarMudanca), dormir(20_000)]);
      await banco.garantirEnvio();
    }
  }

  /** Mensalidades, atrasos e status derivados. No modo local roda por temporizador; na Vercel, por /api/estado e /api/cron. */
  async function rodarRotinas() {
    banco.transacao(() => {
      executarRotinas(banco);
      if (vercel) banco.definirMeta('rotinas-ultima', new Date().toISOString());
    });
    await concluirGravacao();
    notificarMudanca();
  }
  const rotinasVencidas = () => !(Date.now() - Date.parse(banco.meta('rotinas-ultima') ?? '') < INTERVALO_ROTINAS_MS);
  /** Só na Vercel (sem temporizador): roda as rotinas se faz mais de 15 min. Falhar aqui nunca derruba a requisição. */
  async function rotinasSeVencidas() {
    if (!vercel || !rotinasVencidas()) return;
    try {
      await rodarRotinas();
    } catch (e) {
      console.error('[rotinas] não consegui salvar:', e instanceof Error ? e.message : e);
    }
  }

  // ---------------------------------------------------------------- aplicativo
  const app = express();
  app.disable('x-powered-by');
  app.use(cabecalhosSeguranca(producao || vercel, vercel));

  // Acesso vindo da internet (túnel Cloudflare/ngrok/proxy): só o webhook do WhatsApp, o GPS e o cron ficam abertos
  // (o cron exige CRON_SECRET). Sem SENHA_PAINEL o painel só abre na rede local; com ela (obrigatória na Vercel) a
  // internet é liberada mediante login (server/login.ts) e o cabeçalho de proxy deixa de importar.
  const ROTAS_PUBLICAS = [/^\/api\/whatsapp\/webhook\b/, /^\/api\/gps(\/(osmand|traccar))?\/?$/, /^\/api\/cron\/?$/];
  // Sem 'trust proxy': X-Forwarded-For é do cliente e não vale. O IP real vem de ipDoCliente() (server/login.ts).
  app.use(porteiro(ROTAS_PUBLICAS));

  app.use('/api', protecaoCsrf);
  app.use(
    express.json({
      limit: vercel ? '5mb' : '15mb',
      verify: (req, _res, buf) => {
        (req as Request & { corpoBruto?: Buffer }).corpoBruto = buf;
      },
    })
  );
  // Formulário (urlencoded) só no GPS: rastreadores OsmAnd mandam assim. No resto da API só JSON (ver protecaoCsrf).
  app.use('/api/gps', express.urlencoded({ extended: true }));

  const api = express.Router();
  rotasLogin(api, {
    tentativas: vercel && banco.nuvem ? tentativasNaNuvem(banco.nuvem) : undefined,
    infoSessao: () => ({ tempoReal: !vercel, limiteUploadMb: Math.floor(limiteUploadBytes / MB) }),
  });

  function responderErro(res: Response, e: unknown) {
    if (e instanceof ErroNegocio) return res.status(400).json({ erro: e.message });
    if (e instanceof ErroNuvem) return res.status(503).json({ erro: e.message });
    const msg = e instanceof Error ? e.message : String(e);
    if (msg.includes('UNIQUE constraint failed')) {
      return res.status(400).json({ erro: 'Registro duplicado (CPF, placa ou rastreador já cadastrado).' });
    }
    if (vercel && /fetch failed|ECONN|ETIMEDOUT|timed? ?out|aborted|Baixar documentos|Gravar |Ler /i.test(msg)) {
      console.error(e);
      return res.status(503).json({ erro: 'Não consegui falar com o Supabase agora. Tente de novo em instantes.' });
    }
    console.error(e);
    return res.status(500).json({ erro: 'Erro interno no servidor. Veja o terminal para detalhes.' });
  }

  // Rotinas que não dependem do estado mais recente (arquivos têm nome único; o cron confere por conta própria)
  api.get('/whatsapp/webhook', (req, res) => {
    const ok = req.query['hub.mode'] === 'subscribe' && tokenVerificacao() && req.query['hub.verify_token'] === tokenVerificacao();
    if (ok) return res.status(200).send(String(req.query['hub.challenge'] ?? ''));
    res.sendStatus(403);
  });

  // Fotos das motos (enviadas pelo dono)
  api.get('/fotos/:arquivo', async (req, res) => {
    const nome = path.basename(req.params.arquivo);
    const caminho = path.join(banco.pastaFotos, nome);
    // se o disco foi apagado (Render/Vercel), baixa do Supabase Storage e guarda de novo
    if (!/^[\w-]+\.(jpg|png|webp)$/.test(nome) || !(await banco.garantirArquivo('fotos', nome))) return res.sendStatus(404);
    res.setHeader('Cache-Control', 'private, max-age=86400');
    res.sendFile(caminho);
  });

  // Comprovantes (fotos/PDF) - só com login ou pela rede local
  api.get('/comprovantes/:arquivo', async (req, res) => {
    const nome = path.basename(req.params.arquivo);
    const caminho = path.join(banco.pastaComprovantes, nome);
    if (!/^[\w-]+\.(jpg|png|webp|gif|pdf)$/.test(nome) || !(await banco.garantirArquivo('comprovantes', nome))) return res.sendStatus(404);
    res.sendFile(caminho);
  });

  // Chamada periódica (Vercel Cron ou um serviço externo como cron-job.org): rotinas + fila do WhatsApp.
  // Sem CRON_SECRET configurada a rota "não existe".
  api.get('/cron', async (req, res) => {
    const segredo = process.env.CRON_SECRET;
    if (!segredo) return res.status(404).json({ erro: 'Rota da API não encontrada.' });
    if (!iguais(req.header('authorization') ?? '', `Bearer ${segredo}`)) return res.status(401).json({ erro: 'Não autorizado.' });
    try {
      await banco.conferirRevisao();
      const antes = filaPendente(banco);
      await rodarRotinas();
      await processarFila(banco, notificarMudanca);
      await banco.garantirEnvio();
      res.json({ ok: true, rotinas: true, mensagensPendentesAntes: antes, mensagensPendentesDepois: filaPendente(banco) });
    } catch (e) {
      responderErro(res, e);
    }
  });

  // A partir daqui, cada requisição confere se outro servidor gravou algo e, se sim, recarrega tudo do Supabase.
  if (vercel) {
    api.use(async (_req, res, next) => {
      try {
        await banco.conferirRevisao();
        next();
      } catch (e) {
        responderErro(res, e);
      }
    });
  }

  api.get('/estado', async (_req, res) => {
    try {
      await rotinasSeVencidas();
      res.json(banco.estado());
    } catch (e) {
      responderErro(res, e);
    }
  });

  api.post('/acoes/:nome', async (req, res) => {
    if (!existeAcao(req.params.nome)) return res.status(404).json({ erro: 'Ação não encontrada.' });
    try {
      const r = executarAcao(banco, req.params.nome, req.body);
      await concluirGravacao();
      notificarMudanca();
      res.json({ ...r, estado: banco.estado() });
    } catch (e) {
      responderErro(res, e);
    }
  });

  api.get('/eventos', (req, res) => {
    if (vercel) return res.status(404).json({ erro: 'Tempo real indisponível neste servidor.' });
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

  // GPS - aceita JSON simples, OsmAnd (Traccar Client), Traccar Client 9+ e encaminhamento do servidor Traccar.
  const receberGps = async (req: Request, res: Response) => {
    try {
      const leitura = normalizarLeitura(req.body, req.query as Record<string, unknown>);
      const r = registrarPosicao(banco, leitura);
      await rotinasSeVencidas(); // na Vercel o GPS chega o dia todo: aproveita para manter as rotinas em dia
      await concluirGravacao();
      notificarMudanca();
      res.json({ ok: true, ...r });
    } catch (e) {
      if (e instanceof ErroNegocio) console.warn(`[GPS] ${e.message}`);
      responderErro(res, e);
    }
  };
  // Quem manda posição precisa do token (?token=, Authorization: Bearer ou X-GPS-Token). O painel mostra a URL pronta.
  api.get('/gps/token', (_req, res) => res.json({ token: gpsToken(), obrigatorio: gpsToken() !== null }));
  api.all('/gps', exigirTokenGps, receberGps);
  api.all('/gps/osmand', exigirTokenGps, receberGps);
  api.post('/gps/traccar', exigirTokenGps, receberGps);

  // ---------------------------------------------------------------- WhatsApp (Meta Cloud API)
  api.post('/whatsapp/webhook', async (req, res) => {
    // Na internet (login ativado) ou na Vercel, sem o segredo do app qualquer um poderia forjar mensagens.
    if (!segredoWhatsappConfigurado() && (vercel || exigeLogin())) {
      return res.status(503).json({ erro: 'Webhook recusado: defina WHATSAPP_APP_SECRET (Meta > Configurações do app > Básico).' });
    }
    const corpoBruto = (req as Request & { corpoBruto?: Buffer }).corpoBruto;
    if (!assinaturaValida(corpoBruto, req.header('x-hub-signature-256'))) return res.sendStatus(401);
    if (!vercel) {
      res.sendStatus(200); // a Meta exige resposta rápida; o processamento continua em segundo plano
      processarWebhook(banco, req.body, notificarMudanca).catch((e) => console.error('[WhatsApp] webhook:', e));
      return;
    }
    // Vercel: a função congela depois da resposta, então processa e grava ANTES de responder.
    // Se não der para salvar, responde 503 e a Meta reenvia (mensagens repetidas são ignoradas pelo id).
    try {
      await processarWebhook(banco, req.body, notificarMudanca);
      await rotinasSeVencidas();
      await concluirGravacao();
      res.sendStatus(200);
    } catch (e) {
      responderErro(res, e);
    }
  });

  const EXTENSAO_FOTO: Record<string, string> = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' };
  api.post('/motos/:id/foto', async (req, res) => {
    try {
      const { base64, mime } = req.body as { base64?: string; mime?: string };
      const ext = EXTENSAO_FOTO[mime ?? ''];
      if (!base64 || !ext) throw new ErroNegocio('Envie uma foto nos formatos JPG, PNG ou WebP.');
      const dados = Buffer.from(base64, 'base64');
      if (dados.length === 0) throw new ErroNegocio('Foto vazia. Escolha outra imagem.');
      if (!conteudoCombinaComMime(dados, mime!)) throw new ErroNegocio('O arquivo não é uma imagem válida do tipo informado.');
      if (dados.length > limiteFotoBytes) throw new ErroNegocio(`Foto muito grande (máximo ${Math.floor(limiteFotoBytes / MB)} MB).`);
      const moto = banco.lista<Moto>('motos').find((m) => m.id === req.params.id);
      if (!moto) throw new ErroNegocio('Moto não encontrada.');
      const arquivo = `${moto.id}-${Date.now()}.${ext}`;
      const anterior = moto.foto;
      banco.transacao(() => {
        banco.salvarArquivo('fotos', arquivo, dados); // envio ao Supabase só depois do COMMIT
        moto.foto = `/api/fotos/${arquivo}`;
        banco.salvar('motos', moto);
        registrarAtividade(banco, {
          titulo: `Foto atualizada — ${moto.modelo}`,
          subtitulo: `Placa ${moto.placa}`,
          tipo: 'manutencao',
          referenciaId: moto.id,
        });
      });
      banco.apagarArquivoFoto(anterior);
      await concluirGravacao();
      notificarMudanca();
      res.json({ mensagem: 'Foto da moto salva ✓', sub: `${moto.modelo} • ${moto.placa}`, estado: banco.estado() });
    } catch (e) {
      responderErro(res, e);
    }
  });

  // Anexar comprovante pelo sistema (upload em base64)
  api.post('/manutencoes/:id/comprovante', async (req, res) => {
    try {
      const item = banco.lista<ManutencaoItem>('manutencoes').find((m) => m.id === req.params.id);
      if (!item) throw new ErroNegocio('Manutenção não encontrada.');
      const { base64, mime } = req.body as { base64?: string; mime?: string };
      if (!base64 || !mime) throw new ErroNegocio('Arquivo não enviado.');
      const dados = Buffer.from(base64, 'base64');
      if (dados.length > limiteUploadBytes) {
        throw new ErroNegocio(`Arquivo muito grande (máximo ${Math.floor(limiteUploadBytes / MB)} MB). Tire uma foto menor ou reduza o PDF.`);
      }
      if (!conteudoCombinaComMime(dados, mime)) throw new ErroNegocio('O conteúdo do arquivo não bate com o tipo informado. Envie uma foto ou PDF válido.');
      const comp = await registrarComprovante(banco, item, dados, mime, 'sistema');
      await concluirGravacao();
      notificarMudanca();
      res.json({
        mensagem: comp.aprovadoPor === 'automatico' ? 'Comprovante aprovado automaticamente ✓' : 'Comprovante anexado ✓',
        sub: comp.aprovadoPor === 'automatico' ? 'Tudo conferiu: a troca foi concluída e o cliente avisado' : comp.pendencias?.length ? `Não aprovado sozinho: ${comp.pendencias.join('; ')}` : comp.analise ? `Leitura automática: ${comp.analise.observacao}` : 'Confira e aprove na ordem de serviço',
        estado: banco.estado(),
      });
    } catch (e) {
      if (e instanceof Error && !(e instanceof ErroNegocio) && e.message.startsWith('Envie o comprovante')) {
        return res.status(400).json({ erro: e.message });
      }
      responderErro(res, e);
    }
  });

  api.get('/gps/desconhecidos', (_req, res) => {
    res.json([...rastreadoresDesconhecidos.entries()].map(([id, v]) => ({ id, ...v })));
  });

  api.get('/gps/trajeto/:motoId', (req, res) => {
    const horas = Math.min(Number(req.query.horas) || 24, 24 * 31);
    const desde = new Date(Date.now() - horas * 3.6e6).toISOString();
    res.json(banco.trajeto(req.params.motoId, desde));
  });

  /** Período pedido (?de=&ate= em ISO). Sem informar = hoje (horário de Brasília, UTC-3). */
  function periodoDaConsulta(q: Request['query']): { de: string; ate: string } {
    const valido = (v: unknown) => (typeof v === 'string' && !Number.isNaN(Date.parse(v)) ? new Date(v).toISOString() : null);
    const de = valido(q.de);
    const ate = valido(q.ate);
    if (de && ate) {
      if (Date.parse(ate) - Date.parse(de) > 32 * 86_400_000) throw new ErroNegocio('Escolha um período de no máximo 31 dias.');
      return { de, ate };
    }
    const BRT = 3 * 3.6e6;
    const inicio = Math.floor((Date.now() - BRT) / 86_400_000) * 86_400_000 + BRT;
    return { de: new Date(inicio).toISOString(), ate: new Date(inicio + 86_400_000 - 1).toISOString() };
  }

  // Viagens (liga/desliga) de uma moto + totais do período. Exige login (não é rota pública).
  api.get('/gps/viagens/:motoId', (req, res) => {
    try {
      const { de, ate } = periodoDaConsulta(req.query);
      res.json({ de, ate, ...viagensDaMoto(banco, req.params.motoId, de, ate) });
    } catch (e) {
      responderErro(res, e);
    }
  });

  // Pontos do trajeto (um dia ou uma viagem), reduzidos a no máximo ?max= (padrão 600).
  api.get('/gps/pontos/:motoId', (req, res) => {
    try {
      const { de, ate } = periodoDaConsulta(req.query);
      const max = Math.min(Math.max(Number(req.query.max) || 600, 50), 2000);
      res.json(banco.pontosDoPeriodo(req.params.motoId, de, ate, max));
    } catch (e) {
      responderErro(res, e);
    }
  });

  api.get('/relatorios/km', (req, res) => {
    const dias = Math.min(Number(req.query.dias) || 30, 3650);
    const desde = new Date(Date.now() - dias * 86_400_000).toISOString();
    res.json(banco.kmPorPeriodo(desde));
  });

  api.get('/rede', (_req, res) => {
    res.json({ porta, enderecos: vercel ? [] : enderecosLocais().map((ip) => `http://${ip}:${porta}`) });
  });

  api.get('/backup', (_req, res) => {
    const nome = `mkmotos-backup-${new Date().toISOString().slice(0, 10)}.json`;
    res.setHeader('Content-Disposition', `attachment; filename="${nome}"`);
    res.json({ geradoEm: new Date().toISOString(), ...banco.estado(), atividades: banco.lista('atividades') });
  });

  api.use((_req, res) => res.status(404).json({ erro: 'Rota da API não encontrada.' }));
  app.use('/api', api);

  // Middleware de erro para capturar SyntaxError do express.json e outros erros 4xx/5xx
  app.use((err: any, req: Request, res: Response, next: NextFunction) => {
    if (res.headersSent) return next(err);
    console.error(err);
    const status = (err.status || err.statusCode) ?? 500;
    const mensagem =
      status === 413 ? 'Arquivo ou dados grandes demais.' :
      status >= 400 && status < 500 ? 'Requisição inválida.' :
      'Erro interno no servidor.';
    res.status(status >= 400 && status < 600 ? status : 500).json({ erro: mensagem });
  });

  return { app, notificarMudanca, rodarRotinas };
}
