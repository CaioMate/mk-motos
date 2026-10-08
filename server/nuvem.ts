// Armazenamento permanente no Supabase (API REST com a chave service_role).
// Sem SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY o sistema funciona só com arquivos locais.
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

export const BUCKET = 'arquivos';
export const TABELA = 'documentos';

/** O Supabase não aceitou a gravação/leitura (rede, chave, projeto pausado...). Vira HTTP 503 na Vercel. */
export class ErroNuvem extends Error {}

export interface LinhaNuvem {
  colecao: string;
  id: string;
  dados: unknown;
  criado_em: number | null;
}

/** Contrato usado pelo Banco. O Supabase real implementa; os testes usam um falso. */
export interface ArmazenamentoNuvem {
  garantirBucket(): Promise<void>;
  listarDocumentos(): Promise<LinhaNuvem[]>;
  gravarDocumentos(linhas: LinhaNuvem[]): Promise<void>;
  apagarDocumentos(colecao: string, ids: string[]): Promise<void>;
  enviarArquivo(caminho: string, dados: Buffer, mime: string): Promise<void>;
  /** null = o arquivo não existe no Storage. Erros de rede/permissão lançam exceção. */
  baixarArquivo(caminho: string): Promise<Buffer | null>;
  apagarArquivos(caminhos: string[]): Promise<void>;
  listarArquivos(pasta: string): Promise<string[]>;
  /** Pequenos registros de controle (colecao='meta'): marcador de revisão, tentativas de login. Não entram em listarDocumentos. */
  lerMeta(id: string): Promise<unknown | null>;
  gravarMeta(id: string, dados: unknown): Promise<void>;
  apagarMeta(id: string): Promise<void>;
}

export const COLECAO_META = 'meta';

function falhou(contexto: string, erro: { message: string } | null) {
  if (erro) throw new Error(`${contexto}: ${erro.message}`);
}

/** Valor seguro para o filtro in.(...) do PostgREST. */
const aspas = (v: string) => `"${v.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;

class SupabaseNuvem implements ArmazenamentoNuvem {
  private readonly cliente: SupabaseClient;

  constructor(url: string, chave: string) {
    this.cliente = createClient(url, chave, {
      auth: { persistSession: false, autoRefreshToken: false },
      // evita que uma conexão travada deixe o servidor esperando para sempre
      global: { fetch: (entrada, init) => fetch(entrada, { ...init, signal: init?.signal ?? AbortSignal.timeout(30_000) }) },
    });
  }

  async garantirBucket() {
    const { error } = await this.cliente.storage.createBucket(BUCKET, { public: false });
    if (error && !/already exists|duplicate|exists/i.test(error.message)) falhou('Criar bucket', error);
  }

  async listarDocumentos() {
    const todas: LinhaNuvem[] = [];
    const tamanho = 1000; // limite padrão do Supabase por requisição
    for (let de = 0; ; de += tamanho) {
      const { data, error } = await this.cliente
        .from(TABELA)
        .select('colecao,id,dados,criado_em')
        .neq('colecao', COLECAO_META)
        .order('colecao')
        .order('id')
        .range(de, de + tamanho - 1);
      falhou('Baixar documentos', error);
      const pagina = (data ?? []) as LinhaNuvem[];
      todas.push(...pagina);
      if (pagina.length < tamanho) return todas;
    }
  }

  async gravarDocumentos(linhas: LinhaNuvem[]) {
    const { error } = await this.cliente
      .from(TABELA)
      .upsert(
        linhas.map((l) => ({ ...l, atualizado_em: new Date().toISOString() })),
        { onConflict: 'colecao,id' }
      );
    falhou('Gravar documentos', error);
  }

  async apagarDocumentos(colecao: string, ids: string[]) {
    const { error } = await this.cliente.from(TABELA).delete().eq('colecao', colecao).in('id', ids.map(aspas));
    falhou('Apagar documentos', error);
  }

  async lerMeta(id: string) {
    const { data, error } = await this.cliente.from(TABELA).select('dados').eq('colecao', COLECAO_META).eq('id', id).maybeSingle();
    falhou(`Ler ${id}`, error);
    return (data as { dados: unknown } | null)?.dados ?? null;
  }

  async gravarMeta(id: string, dados: unknown) {
    const { error } = await this.cliente
      .from(TABELA)
      .upsert({ colecao: COLECAO_META, id, dados, criado_em: null, atualizado_em: new Date().toISOString() }, { onConflict: 'colecao,id' });
    falhou(`Gravar ${id}`, error);
  }

  async apagarMeta(id: string) {
    const { error } = await this.cliente.from(TABELA).delete().eq('colecao', COLECAO_META).eq('id', id);
    falhou(`Apagar ${id}`, error);
  }

  async enviarArquivo(caminho: string, dados: Buffer, mime: string) {
    const { error } = await this.cliente.storage.from(BUCKET).upload(caminho, dados, { contentType: mime, upsert: true });
    falhou(`Enviar ${caminho}`, error);
  }

  async baixarArquivo(caminho: string) {
    const { data, error } = await this.cliente.storage.from(BUCKET).download(caminho);
    if (error) {
      if (/not found|404|does not exist/i.test(error.message) || /404/.test(String((error as { status?: number }).status))) return null;
      // o supabase-js às vezes devolve só "{}" no corpo de um 400 "Object not found"
      const resposta = (error as { originalError?: { status?: number } }).originalError;
      if (resposta?.status === 400 || resposta?.status === 404) return null;
      throw new Error(`Baixar ${caminho}: ${error.message}`);
    }
    return Buffer.from(await data.arrayBuffer());
  }

  async apagarArquivos(caminhos: string[]) {
    const { error } = await this.cliente.storage.from(BUCKET).remove(caminhos);
    falhou('Apagar arquivos', error);
  }

  async listarArquivos(pasta: string) {
    const nomes: string[] = [];
    for (let de = 0; ; de += 100) {
      const { data, error } = await this.cliente.storage.from(BUCKET).list(pasta, { limit: 100, offset: de });
      falhou(`Listar ${pasta}`, error);
      const itens = data ?? [];
      nomes.push(...itens.filter((i) => i.id).map((i) => `${pasta}/${i.name}`));
      if (itens.length < 100) return nomes;
    }
  }
}

/** Devolve o Supabase se as duas variáveis estiverem definidas; senão null (só local). */
export function criarNuvem(): ArmazenamentoNuvem | null {
  const url = process.env.SUPABASE_URL?.trim();
  const chave = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!url || !chave) return null;
  return new SupabaseNuvem(url, chave);
}
