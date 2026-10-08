-- MK MOTOS - esquema do Supabase.
-- Como usar: no painel do Supabase abra "SQL Editor" > "New query", cole TUDO isto e clique em "Run".
-- Pode rodar de novo sem problema (não apaga nada).

-- Todos os dados do sistema (motos, clientes, contratos, pagamentos... e as configurações)
-- ficam aqui, um documento por linha.
--   colecao   = tipo do dado (motos, clientes, alugueis, ... ou 'config' para as configurações)
--   id        = identificador do documento
--   dados     = o conteúdo (JSON)
--   criado_em = ordem de criação (o sistema usa para listar do mais novo para o mais antigo)
create table if not exists public.documentos (
  colecao text not null,
  id text not null,
  dados jsonb not null,
  criado_em bigint,
  atualizado_em timestamptz not null default now(),
  primary key (colecao, id)
);

-- Segurança: RLS ligado e NENHUMA policy = ninguém acessa pela chave pública (anon).
-- Só o servidor do sistema, com a chave service_role, consegue ler e gravar.
alter table public.documentos enable row level security;

-- Pasta privada para fotos das motos e comprovantes. O servidor também cria o bucket sozinho
-- ao iniciar; este comando é só uma garantia extra (privado, sem acesso público).
insert into storage.buckets (id, name, public)
values ('arquivos', 'arquivos', false)
on conflict (id) do nothing;
