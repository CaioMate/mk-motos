import { DatabaseSync } from 'node:sqlite';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import type { ConfigSistema, EstadoSistema, PosicaoGps, StatusIntegracoes } from '../src/types/mkMotos';
import { completarConfig } from '../src/lib/configPadrao';
import { ErroNuvem, type ArmazenamentoNuvem, type LinhaNuvem } from './nuvem';

/** Item que precisa ser enviado ao Supabase depois do COMMIT. */
type ItemFila =
  | { tipo: 'doc'; colecao: string; id: string }
  | { tipo: 'arquivo'; caminho: string } // envia se existir localmente, senão apaga do Storage
  | { tipo: 'limparPasta'; caminho: string };

const chaveItem = (i: ItemFila) => (i.tipo === 'doc' ? `d:${i.colecao}:${i.id}` : `${i.tipo}:${i.caminho}`);
const dormir = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
const MIME_ARQUIVO: Record<string, string> = {
  jpg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  gif: 'image/gif',
  pdf: 'application/pdf',
};
const em = <T>(lista: T[], n: number) => Array.from({ length: Math.ceil(lista.length / n) }, (_, i) => lista.slice(i * n, i * n + n));

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
  'mensagens',
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
  /** Pasta onde ficam os comprovantes recebidos (fotos/PDF) */
  readonly pastaComprovantes: string;
  /** Pasta onde ficam as fotos das motos enviadas pelo dono */
  readonly pastaFotos: string;
  /** Preenchido pelo servidor: estado das integrações externas */
  statusIntegracoes: () => StatusIntegracoes = () => ({ whatsappConfigurado: false, iaConfigurada: false, filaPendente: 0 });

  /** Pasta que contém o banco, as fotos e os comprovantes */
  private readonly pastaBase: string;
  // ---- envio ao Supabase (só usado quando `nuvem` existe)
  private emTransacao = false;
  private readonly sujos = new Map<string, ItemFila>(); // alterados na transação em andamento
  private readonly fila = new Map<string, ItemFila>(); // já com COMMIT, esperando envio
  private rodando: Promise<void> | null = null;
  private temporizador: NodeJS.Timeout | undefined;
  private falhas = 0;
  // ---- vários servidores ao mesmo tempo (Vercel): marcador de revisão guardado no Supabase
  /** Ligado pelo modo Vercel: cada envio atualiza o marcador e cada requisição confere se mudou. */
  usarRevisao = false;
  private revisaoLocal: string | null = null;
  private conferindo: Promise<boolean> | null = null;

  constructor(
    readonly arquivo: string,
    readonly nuvem: ArmazenamentoNuvem | null = null
  ) {
    this.pastaBase = path.dirname(arquivo);
    fs.mkdirSync(path.dirname(arquivo), { recursive: true });
    this.pastaComprovantes = path.join(path.dirname(arquivo), 'comprovantes');
    fs.mkdirSync(this.pastaComprovantes, { recursive: true });
    this.pastaFotos = path.join(path.dirname(arquivo), 'fotos');
    fs.mkdirSync(this.pastaFotos, { recursive: true });
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
    this.marcar({ tipo: 'doc', colecao: c, id: doc.id });
    return doc;
  }

  /** Insere mantendo a ordem informada (usado na carga inicial). */
  inserirEmLote(c: Colecao, docs: Doc[]) {
    const base = Date.now() * 1000;
    const stmt = this.db.prepare(`INSERT INTO ${c} (id, dados, criado_em) VALUES (?, ?, ?)`);
    docs.forEach((d, i) => {
      stmt.run(d.id, JSON.stringify(d), base - i);
      this.marcar({ tipo: 'doc', colecao: c, id: d.id });
    });
  }

  remover(c: Colecao, id: string) {
    this.dados[c] = this.dados[c].filter((d) => d.id !== id);
    this.db.prepare(`DELETE FROM ${c} WHERE id = ?`).run(id);
    this.marcar({ tipo: 'doc', colecao: c, id });
  }

  /** Marca de migração/controle simples guardada na tabela config. */
  meta(chave: string): string | undefined {
    const r = this.db.prepare(`SELECT valor FROM config WHERE chave = ?`).get(`meta:${chave}`) as { valor: string } | undefined;
    return r?.valor;
  }

  definirMeta(chave: string, valor: string) {
    this.db
      .prepare(`INSERT INTO config (chave, valor) VALUES (?, ?) ON CONFLICT(chave) DO UPDATE SET valor = excluded.valor`)
      .run(`meta:${chave}`, valor);
    this.marcar({ tipo: 'doc', colecao: 'config', id: `meta:${chave}` });
  }

  salvarConfig(config: ConfigSistema) {
    this.config = config;
    this.db
      .prepare(`INSERT INTO config (chave, valor) VALUES ('sistema', ?)
                ON CONFLICT(chave) DO UPDATE SET valor = excluded.valor`)
      .run(JSON.stringify(config));
    this.marcar({ tipo: 'doc', colecao: 'config', id: 'sistema' });
  }

  /** Executa tudo ou nada. Se der erro, desfaz no arquivo e recarrega a memória. */
  transacao<R>(fn: () => R): R {
    this.db.exec('BEGIN');
    this.emTransacao = true;
    this.sujos.clear();
    try {
      const r = fn();
      this.db.exec('COMMIT');
      this.emTransacao = false;
      this.liberarSujos(); // só depois do COMMIT algo vai para o Supabase
      return r;
    } catch (e) {
      this.emTransacao = false;
      this.sujos.clear(); // rollback: nada vai para o Supabase
      this.db.exec('ROLLBACK');
      this.carregar();
      throw e;
    }
  }

  /** Apaga o arquivo de uma foto de moto (aceita '/api/fotos/<arquivo>'). */
  apagarArquivoFoto(foto?: string) {
    const nome = path.basename(foto ?? '');
    if (!/^[\w-]+\.(jpg|png|webp)$/.test(nome)) return;
    try {
      fs.rmSync(path.join(this.pastaFotos, nome), { force: true });
    } catch {
      /* arquivo em uso ou já removido: ignora */
    }
    this.marcar({ tipo: 'arquivo', caminho: `fotos/${nome}` });
  }

  private apagarFotosArquivos() {
    for (const f of fs.readdirSync(this.pastaFotos)) this.apagarArquivoFoto(f);
  }

  apagarTudo() {
    for (const c of COLECOES) {
      const ids = this.db.prepare(`SELECT id FROM ${c}`).all() as Array<{ id: string }>;
      for (const { id } of ids) this.marcar({ tipo: 'doc', colecao: c, id });
      this.db.exec(`DELETE FROM ${c}`);
    }
    this.db.exec(`DELETE FROM gps_posicoes`);
    this.apagarFotosArquivos();
    this.marcar({ tipo: 'limparPasta', caminho: 'fotos' }); // fotos que só existem no Storage
    this.carregar();
  }

  // ---------- Arquivos (fotos e comprovantes): local + Storage do Supabase

  /** Grava o arquivo no disco e, se houver Supabase, agenda o envio (depois do COMMIT). */
  salvarArquivo(pasta: 'fotos' | 'comprovantes', nome: string, dados: Buffer) {
    fs.writeFileSync(path.join(this.pastaBase, pasta, nome), dados);
    this.marcar({ tipo: 'arquivo', caminho: `${pasta}/${nome}` });
  }

  /** Se o arquivo não está no disco (ex.: Render reiniciou), baixa do Storage e guarda. Devolve true se existe. */
  async garantirArquivo(pasta: 'fotos' | 'comprovantes', nome: string): Promise<boolean> {
    const local = path.join(this.pastaBase, pasta, nome);
    if (fs.existsSync(local)) return true;
    if (!this.nuvem) return false;
    try {
      const dados = await this.nuvem.baixarArquivo(`${pasta}/${nome}`);
      if (!dados) return false;
      const temp = `${local}.${process.pid}.tmp`;
      fs.writeFileSync(temp, dados);
      fs.renameSync(temp, local);
      return true;
    } catch (e) {
      console.error(`[Supabase] Não foi possível baixar ${pasta}/${nome}:`, e instanceof Error ? e.message : e);
      return false;
    }
  }

  // ---------- Supabase: fila de envio

  /** Registra algo que mudou. Dentro de transação só vale depois do COMMIT. */
  private marcar(item: ItemFila) {
    if (!this.nuvem) return;
    if (this.emTransacao) this.sujos.set(chaveItem(item), item);
    else this.entrarNaFila([item]);
  }

  private liberarSujos() {
    if (this.sujos.size === 0) return;
    const itens = [...this.sujos.values()];
    this.sujos.clear();
    this.entrarNaFila(itens);
  }

  private entrarNaFila(itens: ItemFila[]) {
    for (const i of itens) {
      const k = chaveItem(i);
      this.fila.delete(k); // reinsere no fim: mantém a ordem real dos acontecimentos
      this.fila.set(k, i);
    }
    if (!this.temporizador) this.agendar(300);
  }

  private agendar(ms: number) {
    clearTimeout(this.temporizador);
    this.temporizador = setTimeout(() => {
      this.temporizador = undefined;
      this.processarFilaNuvem().catch((e) => console.error('[Supabase] Erro na fila:', e));
    }, ms);
  }

  /** Quantidade de itens esperando envio ao Supabase. */
  get pendentesNuvem(): number {
    return this.fila.size;
  }

  /** Envia a fila (uma execução por vez). Se falhar, devolve os itens e tenta de novo com espera crescente. */
  processarFilaNuvem(): Promise<void> {
    if (!this.rodando) {
      this.rodando = this.enviarFila().finally(() => {
        this.rodando = null;
      });
    }
    return this.rodando;
  }

  private async enviarFila() {
    while (this.fila.size > 0) {
      const lote = [...this.fila.values()];
      this.fila.clear();
      try {
        await this.enviarLote(lote);
        this.falhas = 0;
      } catch (e) {
        for (const i of lote) {
          const k = chaveItem(i);
          // se mudou de novo enquanto enviava, a posição nova (mais recente) é mantida
          if (!this.fila.has(k)) this.fila.set(k, i);
        }
        this.falhas++;
        const espera = Math.min(60_000, 2_000 * 2 ** Math.min(this.falhas - 1, 5));
        console.error(
          `[Supabase] Falha ao enviar (${this.fila.size} item(ns) na fila, tentativa ${this.falhas}). Nova tentativa em ${espera / 1000}s:`,
          e instanceof Error ? e.message : e
        );
        this.agendar(espera);
        return;
      }
    }
  }

  private linhaLocal(colecao: string, id: string): LinhaNuvem | null {
    if (colecao === 'config') {
      const r = this.db.prepare(`SELECT valor FROM config WHERE chave = ?`).get(id) as { valor: string } | undefined;
      return r ? { colecao, id, dados: { valor: r.valor }, criado_em: null } : null;
    }
    if (!(COLECOES as readonly string[]).includes(colecao)) return null;
    const r = this.db.prepare(`SELECT dados, criado_em FROM ${colecao} WHERE id = ?`).get(id) as
      | { dados: string; criado_em: number }
      | undefined;
    return r ? { colecao, id, dados: JSON.parse(r.dados), criado_em: Number(r.criado_em) } : null;
  }

  /** Lê o estado ATUAL do SQLite de cada item (sempre a versão mais nova) e manda para o Supabase. */
  private async enviarLote(lote: ItemFila[]) {
    const nuvem = this.nuvem!;
    const gravar: LinhaNuvem[] = [];
    const apagar = new Map<string, string[]>();
    for (const i of lote) {
      if (i.tipo !== 'doc') continue;
      const l = this.linhaLocal(i.colecao, i.id);
      if (l) gravar.push(l);
      else apagar.set(i.colecao, [...(apagar.get(i.colecao) ?? []), i.id]);
    }
    for (const parte of em(gravar, 200)) await nuvem.gravarDocumentos(parte);
    for (const [colecao, ids] of apagar) for (const parte of em(ids, 100)) await nuvem.apagarDocumentos(colecao, parte);

    for (const i of lote) {
      if (i.tipo === 'arquivo') {
        const local = path.join(this.pastaBase, i.caminho);
        if (fs.existsSync(local)) {
          const ext = path.extname(local).slice(1).toLowerCase();
          await nuvem.enviarArquivo(i.caminho, fs.readFileSync(local), MIME_ARQUIVO[ext] ?? 'application/octet-stream');
        } else {
          await nuvem.apagarArquivos([i.caminho]);
        }
      } else if (i.tipo === 'limparPasta') {
        const nomes = await nuvem.listarArquivos(i.caminho);
        for (const parte of em(nomes, 100)) await nuvem.apagarArquivos(parte);
      }
    }
    await this.publicarRevisao();
  }

  /** Esvazia a fila (usado ao desligar). Devolve true se terminou dentro do limite. */
  async esvaziarNuvem(limiteMs: number): Promise<boolean> {
    if (!this.nuvem) return true;
    clearTimeout(this.temporizador);
    this.temporizador = undefined;
    const fim = Date.now() + limiteMs;
    for (;;) {
      await this.processarFilaNuvem();
      if (this.fila.size === 0) return true;
      if (Date.now() >= fim) return false;
      await dormir(Math.min(1000, fim - Date.now()));
    }
  }

  // ---------- Supabase: carga na inicialização

  /**
   * Chamar ANTES de abrir o servidor. Lança erro se o Supabase não responder (quem chama decide tentar de novo ou encerrar).
   * - Supabase com dados: substitui o SQLite local pelo conteúdo do Supabase.
   * - Supabase vazio e banco local com dados (primeira vez): envia o local para o Supabase.
   */
  async sincronizarComNuvem() {
    const nuvem = this.nuvem;
    if (!nuvem) return;
    await nuvem.garantirBucket();
    const revisao = await this.lerRevisao(); // lida ANTES dos dados: se mudar no meio, a próxima requisição recarrega
    const linhas = await nuvem.listarDocumentos();
    this.revisaoLocal = revisao;
    if (linhas.length > 0) {
      this.substituirPelaNuvem(linhas);
      console.log(`  Supabase: ${linhas.length} documentos baixados.`);
      return;
    }
    const tabelas = [...COLECOES, 'config'];
    const temDados = tabelas.some((t) => (this.db.prepare(`SELECT COUNT(*) AS n FROM ${t}`).get() as { n: number }).n > 0);
    if (!temDados) {
      console.log('  Supabase: vazio (sistema novo).');
      return;
    }
    console.log('  Supabase: vazio. Enviando os dados locais pela primeira vez...');
    for (const c of COLECOES) {
      for (const { id } of this.db.prepare(`SELECT id FROM ${c}`).all() as Array<{ id: string }>) {
        this.fila.set(`d:${c}:${id}`, { tipo: 'doc', colecao: c, id });
      }
    }
    for (const { chave } of this.db.prepare(`SELECT chave FROM config`).all() as Array<{ chave: string }>) {
      this.fila.set(`d:config:${chave}`, { tipo: 'doc', colecao: 'config', id: chave });
    }
    for (const pasta of ['fotos', 'comprovantes']) {
      for (const nome of fs.readdirSync(path.join(this.pastaBase, pasta))) {
        this.fila.set(`arquivo:${pasta}/${nome}`, { tipo: 'arquivo', caminho: `${pasta}/${nome}` });
      }
    }
    if (!(await this.esvaziarNuvem(120_000))) throw new Error('Não foi possível enviar os dados locais ao Supabase.');
  }

  // ---------- Supabase: consistência entre servidores (Vercel)

  private async lerRevisao(): Promise<string | null> {
    if (!this.usarRevisao || !this.nuvem) return null;
    const m = (await this.nuvem.lerMeta('revisao')) as { valor?: string } | null;
    return m?.valor ?? null;
  }

  /** Marca no Supabase que os dados mudaram. Se ninguém mais mexeu desde a nossa última carga, este servidor continua em dia. */
  private async publicarRevisao() {
    if (!this.usarRevisao || !this.nuvem) return;
    const antes = await this.lerRevisao();
    const nova = crypto.randomUUID();
    await this.nuvem.gravarMeta('revisao', { valor: nova });
    if (antes === this.revisaoLocal) this.revisaoLocal = nova;
  }

  /** Antes de atender uma requisição: se outro servidor gravou algo, baixa tudo de novo. Devolve true se recarregou. */
  conferirRevisao(): Promise<boolean> {
    if (!this.nuvem || !this.usarRevisao) return Promise.resolve(false);
    this.conferindo ??= this.recarregarSeMudou().finally(() => {
      this.conferindo = null;
    });
    return this.conferindo;
  }

  private async recarregarSeMudou(): Promise<boolean> {
    if (this.fila.size > 0 || this.rodando) return false; // há gravação nossa a caminho: não pisar em cima
    const revisao = await this.lerRevisao();
    if (revisao === this.revisaoLocal) return false;
    const linhas = await this.nuvem!.listarDocumentos();
    if (this.fila.size > 0 || this.rodando || this.emTransacao) return false;
    this.substituirPelaNuvem(linhas);
    this.revisaoLocal = revisao;
    return true;
  }

  /**
   * Vercel: antes de responder, garante que tudo o que foi gravado já está no Supabase (a função congela depois da resposta).
   * Se não conseguir, DESFAZ o que estava pendente (recarrega do Supabase na próxima requisição) e lança ErroNuvem.
   */
  async garantirEnvio(limiteMs = 15_000) {
    if (!this.nuvem) return;
    clearTimeout(this.temporizador);
    this.temporizador = undefined;
    const fim = Date.now() + limiteMs;
    for (let espera = 500; ; espera *= 2) {
      await this.processarFilaNuvem();
      if (this.fila.size === 0 && !this.rodando) return;
      if (Date.now() + espera >= fim) break;
      await dormir(espera);
    }
    clearTimeout(this.temporizador);
    this.temporizador = undefined;
    this.fila.clear();
    this.sujos.clear();
    this.revisaoLocal = '?'; // força recarregar do Supabase na próxima requisição
    throw new ErroNuvem('Não consegui salvar no Supabase agora, então a alteração NÃO foi feita. Tente de novo em instantes.');
  }

  private substituirPelaNuvem(linhas: LinhaNuvem[]) {
    this.db.exec('BEGIN');
    try {
      for (const c of COLECOES) this.db.exec(`DELETE FROM ${c}`);
      this.db.exec(`DELETE FROM config`);
      const base = Date.now() * 1000;
      linhas.forEach((l, n) => {
        if (l.colecao === 'config') {
          const valor = (l.dados as { valor?: unknown } | null)?.valor;
          if (typeof valor !== 'string') return;
          this.db.prepare(`INSERT INTO config (chave, valor) VALUES (?, ?)`).run(l.id, valor);
        } else if ((COLECOES as readonly string[]).includes(l.colecao)) {
          this.db
            .prepare(`INSERT INTO ${l.colecao} (id, dados, criado_em) VALUES (?, ?, ?)`)
            .run(l.id, JSON.stringify(l.dados), l.criado_em ?? base - n);
        }
      });
      this.db.exec('COMMIT');
    } catch (e) {
      this.db.exec('ROLLBACK');
      throw e;
    }
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
      mensagens: this.lista<Doc>('mensagens').slice(0, 1000) as EstadoSistema['mensagens'],
      config: this.config,
      integracoes: this.statusIntegracoes(),
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
