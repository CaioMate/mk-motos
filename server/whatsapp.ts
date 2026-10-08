// Integração com a API oficial do WhatsApp (Meta WhatsApp Business Cloud API).
// Variáveis no arquivo .env (veja .env.example e Configurações → WhatsApp):
//   WHATSAPP_TOKEN, WHATSAPP_PHONE_NUMBER_ID, WHATSAPP_VERIFY_TOKEN, WHATSAPP_APP_SECRET,
//   WHATSAPP_TEMPLATE (padrão aviso_mk_motos), WHATSAPP_TEMPLATE_IDIOMA (padrão pt_BR)
import crypto from 'node:crypto';
import type { Cliente, MensagemWhatsApp } from '../src/types/mkMotos';
import { somenteDigitos } from '../src/lib/formato';
import type { Banco } from './banco';
import { novoId } from './util';

const env = () => ({
  token: process.env.WHATSAPP_TOKEN ?? '',
  phoneId: process.env.WHATSAPP_PHONE_NUMBER_ID ?? '',
  verifyToken: process.env.WHATSAPP_VERIFY_TOKEN ?? '',
  appSecret: process.env.WHATSAPP_APP_SECRET ?? '',
  template: process.env.WHATSAPP_TEMPLATE || 'aviso_mk_motos',
  idioma: process.env.WHATSAPP_TEMPLATE_IDIOMA || 'pt_BR',
  versao: process.env.WHATSAPP_API_VERSION || 'v21.0',
});

export const whatsappConfigurado = () => !!(env().token && env().phoneId);
export const segredoWhatsappConfigurado = () => !!env().appSecret;
export const tokenVerificacao = () => env().verifyToken;

/** Número no formato internacional só com dígitos (55 + DDD + número). */
export function numeroInternacional(telefone: string): string {
  const d = somenteDigitos(telefone);
  return d.length <= 11 ? `55${d}` : d;
}

/**
 * Chave para comparar números brasileiros: DDD + últimos 8 dígitos.
 * (o WhatsApp às vezes entrega o número sem o 9 extra do celular)
 */
export function chaveTelefone(telefone: string): string {
  let d = somenteDigitos(telefone);
  if (d.startsWith('55') && d.length >= 12) d = d.slice(2);
  return d.length >= 10 ? `${d.slice(0, 2)}${d.slice(-8)}` : d;
}

export function clientePorTelefone(b: Banco, telefone: string): Cliente | undefined {
  const k = chaveTelefone(telefone);
  return b.lista<Cliente>('clientes').find((c) => c.telefone && chaveTelefone(c.telefone) === k);
}

/** Confere a assinatura X-Hub-Signature-256 enviada pela Meta. */
export function assinaturaValida(corpoBruto: Buffer | undefined, assinatura: string | undefined): boolean {
  const segredo = env().appSecret;
  if (!segredo) return true; // só na rede local sem senha: quem chama (app.ts) recusa quando há login ou Vercel
  if (!corpoBruto || !assinatura?.startsWith('sha256=')) return false;
  const esperado = crypto.createHmac('sha256', segredo).update(corpoBruto).digest('hex');
  const recebido = assinatura.slice(7);
  return esperado.length === recebido.length && crypto.timingSafeEqual(Buffer.from(esperado), Buffer.from(recebido));
}

async function chamarGraph(caminho: string, corpo: unknown) {
  const { token, versao } = env();
  const r = await fetch(`https://graph.facebook.com/${versao}/${caminho}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(corpo),
  });
  const json = (await r.json().catch(() => ({}))) as { messages?: Array<{ id: string }>; error?: { message: string } };
  if (!r.ok) throw new Error(json.error?.message || `HTTP ${r.status}`);
  return json;
}

/** Texto livre — só é aceito pela Meta até 24h depois da última mensagem do cliente. */
async function enviarTexto(para: string, texto: string) {
  return chamarGraph(`${env().phoneId}/messages`, {
    messaging_product: 'whatsapp',
    to: para,
    type: 'text',
    text: { body: texto.slice(0, 4000), preview_url: false },
  });
}

/**
 * Modelo aprovado pela Meta (obrigatório para iniciar conversa fora da janela de 24h).
 * Corpo do modelo a cadastrar: "Olá {{1}}! Aviso da {{2}}: {{3}}. Responda esta mensagem se tiver dúvidas."
 */
async function enviarModelo(para: string, nome: string, empresa: string, texto: string) {
  // Parâmetros de modelo não aceitam quebra de linha nem tabulação
  const limpar = (s: string) => s.replace(/[\r\n\t]+/g, ' ').replace(/ {4,}/g, '   ').trim().slice(0, 900);
  return chamarGraph(`${env().phoneId}/messages`, {
    messaging_product: 'whatsapp',
    to: para,
    type: 'template',
    template: {
      name: env().template,
      language: { code: env().idioma },
      components: [
        {
          type: 'body',
          parameters: [
            { type: 'text', text: limpar(nome) || 'cliente' },
            { type: 'text', text: limpar(empresa) },
            { type: 'text', text: limpar(texto.replace(/\.$/, '')) },
          ],
        },
      ],
    },
  });
}

/** Baixa uma mídia (foto/PDF) recebida pelo webhook. */
export async function baixarMidia(mediaId: string): Promise<{ dados: Buffer; mime: string }> {
  const { token, versao } = env();
  const info = (await (
    await fetch(`https://graph.facebook.com/${versao}/${mediaId}`, { headers: { Authorization: `Bearer ${token}` } })
  ).json()) as { url?: string; mime_type?: string; error?: { message: string } };
  if (!info.url) throw new Error(info.error?.message || 'Mídia não encontrada');
  const r = await fetch(info.url, { headers: { Authorization: `Bearer ${token}` } });
  if (!r.ok) throw new Error(`Falha ao baixar mídia (HTTP ${r.status})`);
  return { dados: Buffer.from(await r.arrayBuffer()), mime: info.mime_type || r.headers.get('content-type') || '' };
}

// ---------------------------------------------------------------------------
// FILA DE ENVIO — as mensagens são gravadas como "pendente" dentro da transação
// e enviadas depois, fora dela (rede não pode travar o banco).
// ---------------------------------------------------------------------------

export interface NovaMensagem {
  telefone: string;
  clienteId?: string;
  texto: string;
  motivo: NonNullable<MensagemWhatsApp['motivo']>;
}

export function enfileirar(b: Banco, m: NovaMensagem): MensagemWhatsApp | undefined {
  if (!somenteDigitos(m.telefone)) return undefined;
  return b.salvar<MensagemWhatsApp>('mensagens', {
    id: novoId('msg'),
    telefone: numeroInternacional(m.telefone),
    clienteId: m.clienteId,
    direcao: 'saida',
    tipo: 'texto',
    texto: m.texto,
    status: 'pendente',
    motivo: m.motivo,
    criadoEm: new Date().toISOString(),
  });
}

/** Avisa o dono (número em Configurações → WhatsApp). */
export function avisarDono(b: Banco, texto: string) {
  const numero = b.config.whatsapp.numeroDono;
  if (numero) enfileirar(b, { telefone: numero, texto, motivo: 'dono' });
}

/** Última mensagem recebida desse número nas últimas 24h → pode mandar texto livre. */
function dentroDaJanela(b: Banco, telefone: string): boolean {
  const k = chaveTelefone(telefone);
  const ultima = b
    .lista<MensagemWhatsApp>('mensagens')
    .find((m) => m.direcao === 'entrada' && chaveTelefone(m.telefone) === k);
  return !!ultima && Date.now() - new Date(ultima.criadoEm).getTime() < 23.5 * 3.6e6;
}

let processando = false;

/** Envia o que estiver pendente. Chamado a cada poucos segundos pelo servidor. */
export async function processarFila(b: Banco, aoMudar: () => void) {
  if (processando || !whatsappConfigurado()) return;
  processando = true;
  try {
    const pendentes = b
      .lista<MensagemWhatsApp>('mensagens')
      .filter((m) => m.status === 'pendente' && m.direcao === 'saida')
      .reverse()
      .slice(0, 20);
    for (const m of pendentes) {
      try {
        const cliente = b.lista<Cliente>('clientes').find((c) => c.id === m.clienteId);
        const primeiroNome = cliente?.nome.split(' ')[0] ?? (m.motivo === 'dono' ? 'equipe' : 'cliente');
        const r = dentroDaJanela(b, m.telefone)
          ? await enviarTexto(m.telefone, m.texto)
          : await enviarModelo(m.telefone, primeiroNome, b.config.empresa.nome || 'MK Motos', m.texto);
        b.transacao(() => b.salvar('mensagens', { ...m, status: 'enviada', waId: r.messages?.[0]?.id, erro: undefined }));
      } catch (e) {
        const erro = e instanceof Error ? e.message : String(e);
        b.transacao(() => b.salvar('mensagens', { ...m, status: 'erro', erro }));
        console.warn(`[WhatsApp] Falha ao enviar para ${m.telefone}: ${erro}`);
      }
      aoMudar();
    }
  } finally {
    processando = false;
  }
}

export const filaPendente = (b: Banco) =>
  b.lista<MensagemWhatsApp>('mensagens').filter((m) => m.status === 'pendente').length;
