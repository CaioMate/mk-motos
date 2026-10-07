import type { Moto, PosicaoGps } from '../src/types/mkMotos';
import type { Banco } from './banco';
import { ErroNegocio, processarKm, registrarAtividade } from './automacao';

/**
 * Formatos aceitos (todos no mesmo endereço /api/gps):
 *
 * 1. JSON simples (qualquer integração própria):
 *    { "imei": "123456789012345", "lat": -23.5, "lon": -46.6, "velocidadeKmh": 40, "odometroKm": 1520.4 }
 *    (pode usar "motoId" ou "placa" no lugar de "imei")
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
  dataHora: string;
}

const num = (v: unknown): number | undefined => {
  if (v === undefined || v === null || v === '') return undefined;
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
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
      dataHora: dataDe(loc.timestamp),
    };
  } else if (q.velocidadeKmh !== undefined || q.imei || q.motoId || q.placa) {
    // JSON simples
    r = {
      identificador: String(q.imei ?? q.motoId ?? q.placa ?? q.id ?? ''),
      lat: num(q.lat ?? q.latitude),
      lon: num(q.lon ?? q.lng ?? q.longitude),
      velocidadeKmh: num(q.velocidadeKmh),
      odometroKm: num(q.odometroKm),
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
        m.id.toUpperCase() === id ||
        m.placa.toUpperCase() === id
    );
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
    const primeiraVez = !moto.gpsUltimaPosicao;
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
  });

  return { motoId: moto.id, placa: moto.placa, kmSomados: Math.round(delta * 1000) / 1000, kmAtual: moto.kmAtual };
}
