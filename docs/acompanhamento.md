# Acompanhamento

## 12/10/2026 — Protótipo funcional

### Entregue
- Autenticação local (cadastro/login/sair), dados isolados por usuário, conta de demonstração.
- Lançamentos (receita/despesa) únicos, parcelados e recorrentes, com pré-visualização editável das parcelas.
- Cartões: cadastro, fatura sugerida pela data de fechamento, parcelas nas faturas seguintes, pagamento total/parcial e estorno.
- Pagar despesa / receber receita (valor efetivo, data, conta) e desfazer.
- Contas com saldo e saldo previsto em 30 dias; categorias e subcategorias (CRUD).
- Lançamentos por período (vencimento ou lançamento) com filtros.
- Dashboard (7/30/60/90 dias/personalizado) e provisões dos próximos 7 dias.
- Relatórios: por categoria, evolução mensal, faturas por cartão, despesas fixas e parcelamentos ativos.
- PWA (manifest, ícones, service worker) e configuração para Cloudflare.

### Verificado
| Tipo | Resultado |
|---|---|
| Testes de domínio (`npm test`) | 10/10 passando |
| Typecheck (`npm run typecheck`) | Sem erros |
| Build de produção (`npm run build:web`) | Gerado em `dist/` (bundle JS ~1,8 MB) |
| Navegador — desktop 1360px | Login demo, dashboard, compra 10x no cartão, relatórios, cartões, lançamentos, pagamento de conta vencida (saldo e indicadores atualizados) |
| Navegador — mobile 375px | Dashboard e lançamentos sem rolagem horizontal |
| Isolamento | E-mail duplicado recusado; novo usuário começa vazio |

### Não verificado
- **Service worker**: o navegador embutido usado nos testes não permite registrar service workers. O arquivo é servido corretamente e tem sintaxe válida; validar a instalação do PWA no Chrome/Edge após publicar.
- App nativo (Android/iOS): não testado; o foco é Web/PWA.
- Aceite humano dos fluxos e do visual.

### Próximos passos
1. Revisar as hipóteses em `requisitos.md`.
2. Criar o projeto no Supabase, aplicar `supabase-schema.sql` (após revisão) e implementar `SupabaseRepository`.
3. Criar o repositório Git remoto (GitHub/GitLab) e configurar CI (typecheck + testes + build).
4. Publicar no Cloudflare (`npm run deploy`, requer conta e autorização).

### Riscos
- Dados do protótipo vivem só no navegador: limpar o armazenamento apaga tudo.
- O bundle inclui todas as fontes de ícones do `@expo/vector-icons`; dá para reduzir importando só o Feather.
