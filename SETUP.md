# Passo a passo — Deploy do sistema

## O que você vai precisar
- Conta gratuita no [Supabase](https://supabase.com)
- Conta gratuita no [Vercel](https://vercel.com)
- Conta no [GitHub](https://github.com) (você já tem: 1brunomoreno)
- [Node.js](https://nodejs.org) instalado no seu computador (versão 18+)

---

## PASSO 1 — Criar o banco de dados no Supabase

1. Acesse [supabase.com](https://supabase.com) → **Start your project**
2. Crie uma organização (pode ser "Colégio SER") e um projeto chamado `prenda-ser`
3. Escolha a senha do banco e a região **South America (São Paulo)**
4. Aguarde o projeto iniciar (~2 min)

### Criar as tabelas

No painel do Supabase, acesse **SQL Editor** e execute o script abaixo:

```sql
-- Barracas
create table barracas (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  responsavel text,
  created_at timestamptz default now()
);

-- Estoque inicial
create table estoque (
  id uuid primary key default gen_random_uuid(),
  p integer not null default 0,
  m integer not null default 0,
  g integer not null default 0,
  updated_at timestamptz default now()
);

-- Movimentos (saídas e retornos)
create table movimentos (
  id uuid primary key default gen_random_uuid(),
  barraca_id uuid references barracas(id) on delete set null,
  tipo text not null check (tipo in ('saida', 'retorno')),
  qtd_p integer not null default 0,
  qtd_m integer not null default 0,
  qtd_g integer not null default 0,
  retirado_por text,
  created_at timestamptz default now()
);

-- Liberar acesso público (sem login)
alter table barracas enable row level security;
alter table estoque enable row level security;
alter table movimentos enable row level security;

create policy "public_all" on barracas for all using (true) with check (true);
create policy "public_all" on estoque for all using (true) with check (true);
create policy "public_all" on movimentos for all using (true) with check (true);

-- Ativar Realtime (atualização automática entre celulares)
alter publication supabase_realtime add table barracas;
alter publication supabase_realtime add table estoque;
alter publication supabase_realtime add table movimentos;
```

### Pegar as credenciais

1. No painel do Supabase, vá em **Project Settings → API**
2. Copie:
   - **Project URL** (ex: `https://abcdef.supabase.co`)
   - **anon/public key** (chave longa começando com `eyJ...`)

---

## PASSO 2 — Configurar o projeto no seu computador

1. Baixe os arquivos do projeto (pasta `prenda-ser`)
2. Abra o terminal dentro da pasta
3. Crie o arquivo `.env`:

```
VITE_SUPABASE_URL=https://SEU_PROJETO.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

4. Instale as dependências:

```bash
npm install
```

5. Teste localmente:

```bash
npm run dev
```

Acesse `http://localhost:5173` — o app deve abrir.

---

## PASSO 3 — Subir para o GitHub

```bash
git init
git add .
git commit -m "feat: sistema de prendas festa junina"
git remote add origin https://github.com/1brunomoreno/prenda-ser.git
git push -u origin main
```

(Crie o repositório `prenda-ser` no GitHub antes, sem README)

---

## PASSO 4 — Deploy no Vercel

1. Acesse [vercel.com](https://vercel.com) → **Add New Project**
2. Conecte seu GitHub e selecione o repositório `prenda-ser`
3. O Vercel detecta automaticamente que é um projeto Vite
4. Em **Environment Variables**, adicione as duas variáveis:
   - `VITE_SUPABASE_URL` → sua URL do Supabase
   - `VITE_SUPABASE_ANON_KEY` → sua chave anon
5. Clique em **Deploy**

Em ~1 minuto você terá uma URL tipo `prenda-ser.vercel.app` 🎉

---

## PASSO 5 — Instalar no celular (Android e iOS)

### Android (Chrome)
1. Acesse a URL no Chrome
2. Toque nos **3 pontos** no canto superior direito
3. Toque em **"Adicionar à tela inicial"**
4. Confirme — o ícone aparece igual a um app

### iPhone/iPad (Safari)
1. Acesse a URL no **Safari** (obrigatório, não funciona no Chrome no iOS)
2. Toque no botão **Compartilhar** (quadrado com seta ↑)
3. Role até encontrar **"Adicionar à Tela de Início"**
4. Toque em **Adicionar**

O app abre sem barra do navegador, como um app nativo.

---

## Uso no dia da festa

1. **Antes:** Configure o estoque (aba Estoque) e cadastre as barracas
2. **Durante:** Dê saída conforme as barracas retiram prendas
3. **Ao fim:** Registre os retornos em cada barraca
4. **Depois:** Veja o Relatório — quantas foram usadas por tamanho e por barraca

> Múltiplos celulares funcionam simultaneamente — os dados sincronizam em tempo real via Supabase Realtime.
