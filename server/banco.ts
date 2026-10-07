import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import path from 'node:path';
import type { ConfigSistema, EstadoSistema, PosicaoGps } from '../src/types/mkMotos';
import { completarConfig } from '../src/lib/configPadrao';

// Cada coleção é uma tabela SQLite (id + documento JSON). Os dados ficam todos
// em memória no servidor e cada alteração é gravada no arquivo imediatamente.
export const COLECOES = [
  'motos',
  'clientes',
  'alugueis',
  'contratos',
  'pagamentos',
  'manutencoes',
  'leads',
  'campanhas',
  'atividades',
] as const;
export type Colecao = (typeof COLECOES)[number];

type Doc = { id: string };

export interface RegistroGps extends PosicaoGps {
  id: number;
  motoId: string;
  contratoId?: string;
  clienteId?: string;
  kmSomados: number;
}

export class Banco {
  readonly db: DatabaseSync;
  readonly dados = {} as { [K in Colecao]: Doc[] };
  config!: ConfigSistema;
  private sequencia = 0;

  constructor(readonly arquivo: string) {
    fs.mkdirSync(path.dirname(arquivo), { recursive: true });
    this.db = new DatabaseSync(arquivo);
    this.criarTabelas();
    this.carregar();
  }

  private criarTabelas() {
    for (const c of COLECOES) {
      this.db.exec(
        `CREATE TABLE IF NOT EXISTS ${c} (id TEXT PRIMARY KEY, dados TEXT NOT NULL, criado_em INTEGER NOT NULL)`
      );
    }
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS config (chave TEXT PRIMARY KEY, valor TEXT NOT NULL);

      CREATE TABLE IF NOT EXISTS gps_posicoes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        moto_id TEXT NOT NULL,
        contrato_id TEXT,
        cliente_id TEXT,
        lat REAL NOT NULL,
        lon REAL NOT NULL,
        velocidade_kmh REAL,
        odometro_km REAL,
        km_somados REAL NOT NULL DEFAULT 0,
        data_hora TEXT NOT NULL,
        recebido_em TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS ix_gps_moto ON gps_posicoes (moto_id, id);

      -- Regras de unicidade (CPF, placa e IMEI não podem repetir)
      CREATE UNIQUE INDEX IF NOT EXISTS ux_clientes_cpf
        ON clientes (replace(replace(json_extract(dados, '$.cpf'), '.', ''), '-', ''))
        WHERE coalesce(json_extract(dados, '$.cpf'), '') <> '';
      CREATE UNIQUE INDEX IF NOT EXISTS ux_motos_placa
        ON motos (upper(json_extract(dados, '$.placa')));
      CREATE UNIQUE INDEX IF NOT EXISTS ux_motos_imei
        ON motos (json_extract(dados, '$.gpsImei'))
        WHERE coalesce(json_extract(dados, '$.gpsImei'), '') <> '';
    `);
  }

  carregar() {
    for (const c of COLECOES) {
      const linhas = this.db
        .prepare(`SELECT dados FROM ${c} ORDER BY criado_em DESC, rowid DESC`)
        .all() as Array<{ dados: string }>;
      this.dados[c] = linhas.map((l) => JSON.parse(l.dados));
    }
    const cfg = this.db.prepare(`SELECT valor FROM config WHERE chave = 'sistema'`).get() as
      | { valor: string }
      | undefined;
    this.config = completarConfig(cfg ? JSON.parse(cfg.valor) : undefined);
  }

  vazio(): boolean {
    const r = this.db.prepare(`SELECT COUNT(*) AS n FROM motos`).get() as { n: number };
    const c = this.db.prepare(`SELECT COUNT(*) AS n FROM config`).get() as { n: number };
    return r.n === 0 && c.n === 0;
  }

  lista<T extends Doc>(c: Colecao): T[] {
    return this.dados[c] as T[];
  }

  /** Grava (insere ou atualiza) um documento. Documentos novos vão para o topo da lista. */
  salvar<T extends Doc>(c: Colecao, doc: T): T {
    const lista = this.dados[c];
    const idx = lista.findIndex((d) => d.id === doc.id);
    if (idx >= 0) {
      lista[idx] = doc;
      this.db.prepare(`UPDATE ${c} SET dados = ? WHERE id = ?`).run(JSON.stringify(doc), doc.id);
    } else {
      lista.unshift(doc);
      const criadoEm = Date.now() * 1000 + (this.sequencia++ % 1000);
      this.db
        .prepare(`INSERT INTO ${c} (id, dados, criado_em) VALUES (?, ?, ?)`)
        .run(doc.id, JSON.stringify(doc), criadoEm);
    }
    return doc;
  }

  /** Insere mantendo a ordem informada (usado na carga inicial). */
  inserirEmLote(c: Colecao, docs: Doc[]) {
    const base = Date.now() * 1000;
    const stmt = this.db.prepare(`INSERT INTO ${c} (id, dados, criado_em) VALUES (?, ?, ?)`);
    docs.forEach((d, i) => stmt.run(d.id, JSON.stringify(d), base - i));
  }

  remover(c: Colecao, id: string) {
    this.dados[c] = this.dados[c].filter((d) => d.id !== id);
    this.db.prepare(`DELETE FROM ${c} WHERE id = ?`).run(id);
  }

  salvarConfig(config: ConfigSistema) {
    this.config = config;
    this.db
      .prepare(`INSERT INTO config (chave, valor) VALUES ('sistema', ?)
                ON CONFLICT(chave) DO UPDATE SET valor = excluded.valor`)
      .run(JSON.stringify(config));
  }

  /** Executa tudo ou nada. Se der erro, desfaz no arquivo e recarrega a memória. */
  transacao<R>(fn: () => R): R {
    this.db.exec('BEGIN');
    try {
      const r = fn();
      this.db.exec('COMMIT');
      return r;
    } catch (e) {
      this.db.exec('ROLLBACK');
      this.carregar();
      throw e;
    }
  }

  apagarTudo() {
    for (const c of COLECOES) this.db.exec(`DELETE FROM ${c}`);
    this.db.exec(`DELETE FROM gps_posicoes`);
    this.carregar();
  }

  estado(): EstadoSistema {
    return {
      motos: this.lista('motos'),
      clientes: this.lista('clientes'),
      alugueis: this.lista('alugueis'),
      contratos: this.lista('contratos'),
      pagamentos: this.lista('pagamentos'),
      manutencoes: this.lista('manutencoes'),
      leads: this.lista('leads'),
      campanhas: this.lista('campanhas'),
      atividades: this.lista<Doc>('atividades').slice(0, 200) as EstadoSistema['atividades'],
      config: this.config,
    };
  }

  // ---------- GPS ----------

  inserirPosicao(r: Omit<RegistroGps, 'id'>) {
    this.db
      .prepare(
        `INSERT INTO gps_posicoes
          (moto_id, contrato_id, cliente_id, lat, lon, velocidade_kmh, odometro_km, km_somados, data_hora, recebido_em)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        r.motoId,
        r.contratoId ?? null,
        r.clienteId ?? null,
        r.lat,
        r.lon,
        r.velocidadeKmh ?? null,
        r.odometroKm ?? null,
        r.kmSomados,
        r.dataHora,
        new Date().toISOString()
      );
  }

  trajeto(motoId: string, desdeIso: string, limite = 2000): RegistroGps[] {
    const linhas = this.db
      .prepare(
        `SELECT id, moto_id, contrato_id, cliente_id, lat, lon, velocidade_kmh, odometro_km, km_somados, data_hora
           FROM gps_posicoes WHERE moto_id = ? AND data_hora >= ? ORDER BY id DESC LIMIT ?`
      )
      .all(motoId, desdeIso, limite) as Array<Record<string, unknown>>;
    return linhas.reverse().map((l) => ({
      id: l.id as number,
      motoId: l.moto_id as string,
      contratoId: (l.contrato_id as string) ?? undefined,
      clienteId: (l.cliente_id as string) ?? undefined,
      lat: l.lat as number,
      lon: l.lon as number,
      velocidadeKmh: (l.velocidade_kmh as number) ?? undefined,
      odometroKm: (l.odometro_km as number) ?? undefined,
      kmSomados: l.km_somados as number,
      dataHora: l.data_hora as string,
    }));
  }

  /** Km rodados por moto/contrato em um período (para relatórios). */
  kmPorPeriodo(desdeIso: string): Array<{ motoId: string; contratoId: string | null; km: number }> {
    return this.db
      .prepare(
        `SELECT moto_id AS motoId, contrato_id AS contratoId, SUM(km_somados) AS km
           FROM gps_posicoes WHERE data_hora >= ? GROUP BY moto_id, contrato_id`
      )
      .all(desdeIso) as Array<{ motoId: string; contratoId: string | null; km: number }>;
  }
}
