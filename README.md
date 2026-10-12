# Personal Finance

Aplicativo Web/PWA de finanças pessoais: receitas, despesas, cartões de crédito e faturas, contas, categorias, relatórios e dashboard.

> **Protótipo.** Ainda não há backend: autenticação e dados ficam no armazenamento local do navegador, isolados por usuário. A camada de dados (`src/data/repository.ts`) já define o contrato que a implementação com Supabase vai seguir.

## Stack

- **React Native + Expo SDK 57** (react-native-web), **Expo Router** (rotas por arquivo em `src/app`)
- TypeScript estrito, IBM Plex Sans, ícones Feather
- PWA: `public/manifest.json`, `public/sw.js`, ícones em `public/icons`
- Hospedagem prevista: **Cloudflare** (Workers com assets estáticos, `wrangler.jsonc`)

## Como rodar

```bash
npm install
npm run web          # http://localhost:8081
```

Na tela de login, use **"Explorar com a conta de demonstração"** (e-mail `demo@personalfinance.app`, senha `demo1234`, dados fictícios de 3 meses) ou crie uma conta nova, que começa vazia e com categorias padrão.

| Comando | O que faz |
|---|---|
| `npm run web` | Servidor de desenvolvimento (web) |
| `npm test` | Testes das regras de negócio (fatura, parcelas, recorrência, saldos, indicadores) |
| `npm run typecheck` | Verificação de tipos |
| `npm run build:web` | Gera o site estático em `dist/` |
| `npm run icons` | Regera os ícones a partir de `assets/brand/*.svg` |
| `npm run deploy` | Build + `wrangler deploy` (requer conta Cloudflare; **não executado ainda**) |

Para zerar os dados locais: DevTools → Application → Local Storage → apagar chaves `pf:v1:*`.

## Estrutura

```
src/
  app/                 rotas (Expo Router)
    (auth)/            login, cadastro
    (app)/             área autenticada: dashboard, lançamentos, cartões, contas, categorias, relatórios
  domain/              regras puras (sem React): tipos, datas, dinheiro, faturas, parcelas, indicadores
  data/                repositório (contrato + implementação local), seed de demonstração
  state/               providers de sessão e dados
  features/            formulários e componentes de negócio (lançamento, pagamento, cartão…)
  ui/                  design system (tema, textos, campos, botões, modais, gráficos)
tests/                 testes de domínio (node:test)
docs/                  contexto, requisitos, decisões e acompanhamento
```

## Documentação

- [docs/requisitos.md](docs/requisitos.md) — critérios de aceite e onde cada um está implementado
- [docs/decisoes.md](docs/decisoes.md) — regras de negócio adotadas e decisões técnicas
- [docs/acompanhamento.md](docs/acompanhamento.md) — o que foi verificado, pendências e próximos passos
- [docs/supabase-schema.sql](docs/supabase-schema.sql) — proposta de schema com RLS para a próxima fase
