-- Proposta de schema para a fase Supabase (NÃO aplicado).
-- Espelha src/domain/types.ts. Valores em centavos (bigint), datas sem fuso (date).
-- Toda tabela tem RLS: cada usuário só lê e escreve as próprias linhas.

create type entry_kind as enum ('receita', 'despesa');
create type payment_method as enum ('dinheiro','pix','boleto','debito','transferencia','debito_automatico','cartao_credito');
create type account_type as enum ('corrente','poupanca','carteira','investimento');
create type series_type as enum ('unico','parcelado','recorrente');
create type frequency as enum ('semanal','quinzenal','mensal','bimestral','trimestral','semestral','anual');

create table accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  name text not null,
  type account_type not null,
  initial_balance bigint not null default 0,
  color text not null,
  archived boolean not null default false
);

create table categories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  name text not null,
  kind entry_kind not null,
  parent_id uuid references categories on delete cascade,
  color text not null,
  unique (user_id, kind, parent_id, name)
);

create table credit_cards (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  name text not null,
  last_digits char(4),
  credit_limit bigint not null,
  closing_day smallint not null check (closing_day between 1 and 28),
  due_day smallint not null check (due_day between 1 and 28 and due_day <> closing_day),
  color text not null,
  default_account_id uuid references accounts on delete set null,
  archived boolean not null default false
);

create table transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  kind entry_kind not null,
  description text not null,
  amount bigint not null check (amount > 0),
  category_id uuid references categories on delete restrict,
  subcategory_id uuid references categories on delete restrict,
  launch_date date not null,
  due_date date not null,
  payment_method payment_method not null,
  account_id uuid references accounts on delete restrict,
  card_id uuid references credit_cards on delete restrict,
  invoice_ref char(7),                        -- YYYY-MM
  status text not null default 'aberto' check (status in ('aberto','pago')),
  paid_at date,
  paid_amount bigint,
  series_id uuid,
  series_type series_type not null default 'unico',
  series_index int not null default 1,
  series_total int not null default 1,
  frequency frequency,
  notes text not null default '',
  created_at timestamptz not null default now(),
  check ((card_id is null) = (invoice_ref is null))
);
create index on transactions (user_id, due_date);
create index on transactions (user_id, launch_date);
create index on transactions (card_id, invoice_ref);
create index on transactions (series_id);

create table invoice_payments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  card_id uuid not null references credit_cards on delete restrict,
  invoice_ref char(7) not null,
  paid_at date not null,
  account_id uuid not null references accounts on delete restrict,
  amount bigint not null check (amount > 0)
);

-- RLS: mesmo isolamento para todas as tabelas.
do $$
declare t text;
begin
  foreach t in array array['accounts','categories','credit_cards','transactions','invoice_payments'] loop
    execute format('alter table %I enable row level security', t);
    execute format('create policy own_rows on %I for all to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()))', t);
  end loop;
end $$;
