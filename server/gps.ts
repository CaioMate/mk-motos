import type { Cliente, Moto, PosicaoGps, ViagemGps, ViagensDoPeriodo } from '../src/types/mkMotos';
import { linkMapa } from '../src/lib/formato';
import type { Banco } from './banco';
import { ErroNegocio, processarKm, registrarAtividade } from './automacao';
import { avisarDono, enfileirar } from './whatsapp';

/** A moto está dentro de alguma cidade permitida? (null = cerca desligada/sem cidades) */
export function dentroDaArea(b: Banco, p: { lat: number; lon: number }): boolean | null {
  const { ativo, cidades } = b.config.cercaVirtual;
  if (!ativo || !cidades.length) return null;
  return cidades.some((c) => distanciaKm(c, p) <= c.raioKm);
}

/** Avisa cliente e dono quando a moto sai das cidades permitidas, e o dono quando ela volta. */
function verificarCercaVirtual(b: Banco, moto: Moto, pos: PosicaoGps) {
  const dentro = dentroDaArea(b, pos);
  if (dentro === null) return;
  const cliente = b.lista<Cliente>('clientes').find((c) => c.id === moto.clienteAtualId);
  const mapa = linkMapa(pos.lat, pos.lon);

  if (!dentro && !moto.foraDaArea) {
    moto.foraDaArea = true;
    moto.foraDaAreaDesde = pos.dataHora;
    b.salvar('motos', moto);
    const cidades = b.config.cercaVirtual.cidades.map((c) => c.nome).join(', ');
    const msgDono = `ALERTA: ${moto.modelo} (${moto.placa}) saiu da área permitida${cliente ? ` com ${cliente.nome} (${cliente.telefone})` : ' (sem cliente vinculado!)'}. Localização: ${mapa}`;
    registrarAtividade(b, { titulo: `Moto fora da área permitida — ${moto.placa}`, subtitulo: msgDono, tipo: 'gps', referenciaId: moto.id });
    if (b.config.whatsapp.avisarCerca) {
      avisarDono(b, msgDono);
      if (cliente) {
        enfileirar(b, {
          telefone: cliente.telefone,
          clienteId: cliente.id,
          motivo: 'cerca',
          texto: `Identificamos pelo rastreador que a moto ${moto.placa} está fora da área permitida no contrato (${cidades}). Por favor, retorne à área de uso e, se houver algum problema, fale com a gente por aqui`,
        });
      }
    }
  } else if (dentro && moto.foraDaArea) {
    moto.foraDaArea = false;
    moto.foraDaAreaDesde = undefined;
    b.salvar('motos', moto);
    const msg = `${moto.modelo} (${moto.placa}) voltou para a área permitida.`;
    registrarAtividade(b, { titulo: `Moto voltou à área permitida — ${moto.placa}`, subtitulo: msg, tipo: 'gps', referenciaId: moto.id });
    if (b.config.whatsapp.avisarCerca) avisarDono(b, msg);
  }
}

/**
 * Formatos aceitos (todos no mesmo endereço /api/gps):
 *
 * 1. JSON simples (qualquer integração própria):
 *    { "imei": "123456789012345", "lat": -23.5, "lon": -46.6, "velocidadeKmh": 40, "odometroKm": 1520.4 }
 *    (pode usar "motoId" no lugar de "imei"; a placa NÃO é aceita como identificação)
 *
 * Todos os formatos exigem o token do GPS (?token=..., Authorization: Bearer ou X-GPS-Token) — ver server/seguranca.ts.
 *
 * 2. Protocolo OsmAnd (app "Traccar Client" no celular, versões antigas, e vários rastreadores):
 *    GET/POST /api/gps?id=IMEI&lat=-23.5&lon=-46.6&speed=20&timestamp=1700000000
 *    (speed em nós)
 *
 * 3. Traccar Client 9+ (JSON):
 *    { "device_id": "IMEI", "location": { "timestamp": "...", "coords": { "latitude", "longitude", "speed" (m/s) }, "odometer" (m) } }
 *
 * 4. Servidor Traccar (encaminhamento de posições — forward.url com forward.json=true):
 *    { "device": { "uniqueId": "IMEI" }, "position": { "latitude", "longitude", "speed" (nós), "fixTime", "attributes": { "totalDistance" (m) } } }
 *    Use este quando o rastreador da moto fala um protocolo próprio (GT06, TK103, Suntech, etc.):
 *    o Traccar recebe o rastreador e repassa as posições para cá.
 */
export interface LeituraGps {
  identificador: string;
  lat: number;
  lon: number;
  velocidadeKmh?: number;
  odometroKm?: number;
  /** true/false quando o rastreador informa a ignição; undefined (app de celular) = detecta por movimento */
  ignicao?: boolean;
  dataHora: string;
}

const num = (v: unknown): number | undefined => {
  if (v === undefined || v === null || v === '') return undefined;
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
};

/** Aceita true/false, 1/0, 'on'/'off', 'true'/'false'. Qualquer outra coisa = não informado. */
const booleano = (v: unknown): boolean | undefined => {
  if (typeof v === 'boolean') return v;
  if (v === 1 || v === 0) return v === 1;
  if (typeof v !== 'string') return undefined;
  const t = v.trim().toLowerCase();
  if (['true', '1', 'on', 'yes', 'sim'].includes(t)) return true;
  if (['false', '0', 'off', 'no', 'nao', 'não'].includes(t)) return false;
  return undefined;
};

function dataDe(v: unknown): string {
  if (v === undefined || v === null || v === '') return new Date().toISOString();
  const n = Number(v);
  if (Number.isFinite(n)) {
    // segundos ou milissegundos desde 1970
    return new Date(n < 1e12 ? n * 1000 : n).toISOString();
  }
  const d = new Date(String(v));
  return Number.isNaN(d.getTime()) ? new Date().toISOString() : d.toISOString();
}

export function normalizarLeitura(corpo: Record<string, any>, query: Record<string, any>): LeituraGps {
  const q = { ...query, ...(corpo && typeof corpo === 'object' ? corpo : {}) };
  let r: Partial<LeituraGps> = {};

  if (q.position && q.device) {
    // Servidor Traccar
    const p = q.position;
    const totalM = num(p.attributes?.totalDistance) ?? num(p.attributes?.odometer);
    r = {
      identificador: String(q.device.uniqueId ?? ''),
      lat: num(p.latitude),
      lon: num(p.longitude),
      velocidadeKmh: num(p.speed) !== undefined ? num(p.speed)! * 1.852 : undefined,
      odometroKm: totalM !== undefined ? totalM / 1000 : undefined,
      ignicao: booleano(p.attributes?.ignition),
      dataHora: dataDe(p.fixTime ?? p.deviceTime),
    };
  } else if (q.location && (q.device_id || q.deviceId)) {
    // Traccar Client 9+
    const loc = q.location;
    const c = loc.coords ?? {};
    r = {
      identificador: String(q.device_id ?? q.deviceId),
      lat: num(c.latitude),
      lon: num(c.longitude),
      velocidadeKmh: num(c.speed) !== undefined && num(c.speed)! >= 0 ? num(c.speed)! * 3.6 : undefined,
      odometroKm: num(loc.odometer) !== undefined ? num(loc.odometer)! / 1000 : undefined,
      ignicao: booleano(loc.extras?.ignition ?? loc.attributes?.ignition),
      dataHora: dataDe(loc.timestamp),
    };
  } else if (q.velocidadeKmh !== undefined || q.imei || q.motoId) {
    // JSON simples
    r = {
      identificador: String(q.imei ?? q.motoId ?? q.id ?? ''),
      lat: num(q.lat ?? q.latitude),
      lon: num(q.lon ?? q.lng ?? q.longitude),
      velocidadeKmh: num(q.velocidadeKmh),
      odometroKm: num(q.odometroKm),
      ignicao: booleano(q.ignicao ?? q.ignition),
      dataHora: dataDe(q.dataHora ?? q.timestamp),
    };
  } else {
    // OsmAnd
    const odo = num(q.odometer);
    r = {
      identificador: String(q.id ?? q.deviceid ?? ''),
      lat: num(q.lat ?? q.latitude),
      lon: num(q.lon ?? q.longitude),
      velocidadeKmh: num(q.speed) !== undefined ? num(q.speed)! * 1.852 : undefined,
      odometroKm: odo !== undefined ? odo / 1000 : undefined,
      ignicao: booleano(q.ignition ?? q.ignicao),
      dataHora: dataDe(q.timestamp),
    };
  }

  if (!r.identificador) throw new ErroNegocio('Identificador do rastreador (IMEI / id) não informado.');
  if (r.lat === undefined || r.lon === undefined || Math.abs(r.lat) > 90 || Math.abs(r.lon) > 180) {
    throw new ErroNegocio('Latitude/longitude ausentes ou inválidas.');
  }
  if (r.lat === 0 && r.lon === 0) throw new ErroNegocio('Posição 0,0 descartada (GPS sem sinal).');
  return r as LeituraGps;
}

/** Distância em km entre dois pontos (fórmula de Haversine). */
export function distanciaKm(a: { lat: number; lon: number }, b: { lat: number; lon: number }): number {
  const R = 6371;
  const rad = (g: number) => (g * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLon = rad(b.lon - a.lon);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/** Rastreadores que mandaram posição mas não estão cadastrados em nenhuma moto. */
export const rastreadoresDesconhecidos = new Map<string, { ultimaVez: string; lat: number; lon: number }>();

export function encontrarMoto(b: Banco, identificador: string): Moto | undefined {
  const id = identificador.trim().toUpperCase();
  return b
    .lista<Moto>('motos')
    .find(
      (m) =>
        (m.gpsImei && m.gpsImei.trim().toUpperCase() === id) ||
        m.id.toUpperCase() === id
    );
}

const MIN = 60_000;
const SEM_SINAL_IGNICAO_MS = 12 * 60 * MIN; // viagem com ignição ligada e sem nenhuma posição há 12 h: considera encerrada

/**
 * Viagens, de forma incremental (uma leitura de cada vez; nada é recalculado).
 * - Rastreador que informa ignição: liga = começa, desliga = termina (origem 'ignicao').
 * - Sem ignição (app de celular): começa quando passa de config.gps.velocidadeMovimentoKmh (ou desloca de verdade);
 *   termina depois de config.gps.minutosParadaFimViagem parada (origem 'movimento').
 * Os km vêm do mesmo cálculo da cobrança (delta), então nunca divergem; a cobrança em si não muda.
 */
function atualizarViagens(b: Banco, motoId: string, antes: PosicaoGps | undefined, atual: PosicaoGps, delta: number) {
  if (antes && Date.parse(atual.dataHora) < Date.parse(antes.dataHora)) return; // posição atrasada: só fica no histórico
  const regra = b.config.gps;
  const t = Date.parse(atual.dataHora);
  let aberta = b.viagemAberta(motoId);
  const fechar = (fim: string) => {
    if (aberta) b.atualizarViagem(aberta.id, { fim });
    aberta = undefined;
  };

  // velocidade conhecida ou deduzida do deslocamento entre as duas últimas posições
  let vel = atual.velocidadeKmh;
  if (vel === undefined && antes) {
    const dt = (t - Date.parse(antes.dataHora)) / 3.6e6;
    const d = distanciaKm(antes, atual);
    if (dt > 0 && d * 1000 >= regra.distanciaMinimaM && d / dt <= regra.velocidadeMaxKmh) vel = d / dt;
  }

  if (atual.ignicao !== undefined) {
    if (aberta && aberta.origem === 'movimento') fechar(aberta.ultimoMov);
    if (aberta && t - Date.parse(aberta.ultimoMov) > SEM_SINAL_IGNICAO_MS) fechar(aberta.ultimoMov);
    if (atual.ignicao) {
      aberta ??= b.abrirViagem(motoId, atual.dataHora, 'ignicao');
      b.atualizarViagem(aberta.id, { km: delta, vel, ultimoMov: atual.dataHora });
    } else if (aberta) {
      b.atualizarViagem(aberta.id, { km: delta, vel, ultimoMov: atual.dataHora, fim: atual.dataHora });
    }
    return;
  }

  const paradoMs = regra.minutosParadaFimViagem * MIN;
  if (aberta && aberta.origem === 'ignicao') aberta = undefined; // misto: deixa a viagem por ignição quieta
  const movendo = (vel ?? 0) > regra.velocidadeMovimentoKmh;
  if (aberta && t - Date.parse(aberta.ultimoMov) > paradoMs) fechar(aberta.ultimoMov);
  if (movendo) {
    if (!aberta) {
      const colar = antes && t - Date.parse(antes.dataHora) <= paradoMs; // começa no ponto parado anterior
      aberta = b.abrirViagem(motoId, colar ? antes!.dataHora : atual.dataHora, 'movimento');
    }
    b.atualizarViagem(aberta.id, { km: delta, vel, ultimoMov: atual.dataHora });
  } else if (aberta) {
    b.atualizarViagem(aberta.id, { km: delta });
  }
}

/** Fecha viagens por movimento paradas há mais que o limite (chamado nas rotinas). */
export function fecharViagensParadas(b: Banco) {
  const agora = Date.now();
  b.fecharViagensParadas(
    new Date(agora - b.config.gps.minutosParadaFimViagem * MIN).toISOString(),
    new Date(agora - SEM_SINAL_IGNICAO_MS).toISOString()
  );
}

/** Viagens de uma moto no período, já com duração e totais (nº de viagens = quantas vezes ligou). */
export function viagensDaMoto(b: Banco, motoId: string, de: string, ate: string): ViagensDoPeriodo {
  const agora = Date.now();
  const paradoMs = b.config.gps.minutosParadaFimViagem * MIN;
  const viagens: ViagemGps[] = b.viagensDoPeriodo(motoId, de, ate).map((v) => {
    let fim = v.fim;
    // movimento sem novas posições há mais que o limite: já terminou no último movimento (a rotina só grava depois)
    if (!fim && v.origem === 'movimento' && agora - Date.parse(v.ultimoMov) > paradoMs) fim = v.ultimoMov;
    const ateQuando = fim ?? v.ultimoMov;
    return {
      id: v.id,
      motoId: v.motoId,
      inicio: v.inicio,
      fim,
      km: Math.round(v.km * 100) / 100,
      duracaoMin: Math.max(0, Math.round((Date.parse(ateQuando) - Date.parse(v.inicio)) / MIN)),
      velocidadeMaxKmh: Math.round(v.velMax),
      origem: v.origem,
    };
  });
  return {
    viagens,
    totais: {
      viagens: viagens.length,
      km: Math.round(viagens.reduce((s, v) => s + v.km, 0) * 100) / 100,
      minutosRodando: viagens.reduce((s, v) => s + v.duracaoMin, 0),
      velocidadeMaxKmh: viagens.reduce((m, v) => Math.max(m, v.velocidadeMaxKmh), 0),
    },
  };
}

/**
 * Registra a posição e soma a distância percorrida.
 * - Se o rastreador informa hodômetro, usa a diferença do hodômetro (mais preciso).
 * - Senão, soma a distância em linha reta entre os pontos, descartando ruído
 *   (movimentos menores que distanciaMinimaM) e saltos impossíveis (acima de velocidadeMaxKmh).
 */
export function registrarPosicao(b: Banco, leitura: LeituraGps) {
  const moto = encontrarMoto(b, leitura.identificador);
  if (!moto) {
    rastreadoresDesconhecidos.set(leitura.identificador, {
      ultimaVez: new Date().toISOString(),
      lat: leitura.lat,
      lon: leitura.lon,
    });
    throw new ErroNegocio(
      `Rastreador "${leitura.identificador}" não está vinculado a nenhuma moto. Cadastre o IMEI na moto (Frota > Editar).`
    );
  }
  rastreadoresDesconhecidos.delete(leitura.identificador);

  const regra = b.config.gps;
  const atual: PosicaoGps = {
    lat: leitura.lat,
    lon: leitura.lon,
    velocidadeKmh: leitura.velocidadeKmh,
    odometroKm: leitura.odometroKm,
    ignicao: leitura.ignicao,
    dataHora: leitura.dataHora,
  };
  const ref = moto.gpsReferencia;
  let delta = 0;
  let novaRef: PosicaoGps | undefined = ref;

  if (!ref) {
    novaRef = atual;
  } else if (new Date(atual.dataHora) < new Date(ref.dataHora)) {
    // posição antiga chegando atrasada (rastreador descarregando memória): só guarda no histórico
  } else if (atual.odometroKm !== undefined && ref.odometroKm !== undefined) {
    const d = atual.odometroKm - ref.odometroKm;
    const horas = Math.max((new Date(atual.dataHora).getTime() - new Date(ref.dataHora).getTime()) / 3.6e6, 1 / 3600);
    if (d > 0 && d / horas <= regra.velocidadeMaxKmh * 1.5) delta = d;
    novaRef = atual; // hodômetro reiniciado ou salto: recomeça a partir daqui
  } else {
    const d = distanciaKm(ref, atual);
    const horas = Math.max((new Date(atual.dataHora).getTime() - new Date(ref.dataHora).getTime()) / 3.6e6, 1 / 3600);
    if (d * 1000 >= regra.distanciaMinimaM) {
      if (d / horas <= regra.velocidadeMaxKmh) delta = d;
      novaRef = atual;
    }
  }

  b.transacao(() => {
    b.inserirPosicao({
      ...atual,
      motoId: moto.id,
      contratoId: moto.contratoAtualId,
      clienteId: moto.clienteAtualId,
      kmSomados: delta,
    });
    const anterior = moto.gpsUltimaPosicao;
    atualizarViagens(b, moto.id, anterior, atual, delta);
    const primeiraVez = !anterior;
    moto.gpsUltimaPosicao = atual;
    moto.gpsReferencia = novaRef;
    b.salvar('motos', moto);
    if (primeiraVez) {
      registrarAtividade(b, {
        titulo: `GPS conectado — ${moto.modelo}`,
        subtitulo: `Primeira posição recebida do rastreador ${leitura.identificador} (placa ${moto.placa})`,
        tipo: 'gps',
        referenciaId: moto.id,
      });
    }
    processarKm(b, moto, delta, 'gps');
    verificarCercaVirtual(b, moto, atual);
  });

  return { motoId: moto.id, placa: moto.placa, kmSomados: Math.round(delta * 1000) / 1000, kmAtual: moto.kmAtual };
}
