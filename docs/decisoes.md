# Decisões

Estado: **implementado** no protótipo, salvo indicação.

## Produto (respondidas pelo usuário em 12/10/2026)

| Decisão | Escolha |
|---|---|
| Saldo em contas | Cadastro de várias contas com saldo inicial; cada pagamento/recebimento indica a conta |
| Persistência no protótipo | Local no navegador + login simulado, com conta de demonstração |
| Recorrência | Frequência + quantidade ou data final; cada ocorrência é editável/pagável |

## Regras de negócio

**Fatura do cartão.** A fatura é identificada pelo mês de vencimento (`invoiceRef = YYYY-MM`). Uma compra feita **antes** do dia de fechamento entra na fatura que fecha naquele mês; **no dia do fechamento ou depois**, entra na seguinte. Se o vencimento é menor que o fechamento (ex.: fecha 25, vence 5), o vencimento cai no mês seguinte ao fechamento. Dias de fechamento/vencimento limitados a 1–28 para evitar meses curtos.

**Status da fatura** (derivado, não persistido): *paga* (pagamentos ≥ total), *fechada* (passou do fechamento e não está paga), *aberta* (a que recebe compras hoje) e *futura* (parcelas lançadas adiante).

**Parcelamento.** O valor informado pode ser o total (dividido; a diferença de centavos vai para a 1ª parcela) ou o valor de cada parcela. Fora do cartão, os vencimentos são mensais a partir do 1º vencimento e podem ser ajustados um a um antes de salvar. No cartão, cada parcela vai para a fatura do mês seguinte.

**Saldo da conta** = saldo inicial + receitas recebidas − despesas pagas (fora do cartão) − pagamentos de fatura. Valor pago pode diferir do previsto (juros/desconto).

**Indicadores do dashboard** (período padrão: últimos 30 dias):
- *Receitas recebidas / Despesas pagas / Resultado* — regime de caixa (data do pagamento). Despesas pagas incluem pagamentos de fatura; compras no cartão não entram aqui para não contar duas vezes.
- *Compras no cartão no período* — pela data da compra.
- *Onde você gastou* — pela data de lançamento (competência), incluindo cartão e itens em aberto.
- *Próximos 7 dias* — lançamentos em aberto e faturas com vencimento entre hoje e +7 dias; vencidos aparecem num alerta separado.

## Técnicas

| Decisão | Motivo |
|---|---|
| Expo SDK 57 + Expo Router com saída web `single` (SPA) | React Native pedido na especificação; mesma base pode virar app nativo. SPA evita renderização no servidor de páginas que dependem da sessão local |
| Valores em centavos (inteiros) e datas ISO locais `YYYY-MM-DD` | Sem erro de ponto flutuante nem deslocamento de fuso |
| Regras em `src/domain` como funções puras | Testáveis com `node:test` sem React; reaproveitáveis no backend (ex.: Edge Functions) |
| Contrato `Repository` com implementação local | Troca para Supabase sem alterar telas |
| Gráficos próprios (Views) em vez de biblioteca | Bundle menor e controle visual; par de cores receitas azul × despesas laranja validado para daltonismo (verde × vermelho reprovou) |
| Paleta "papel e tinta", IBM Plex Sans, sem gradientes | Pedido de layout moderno sem aparência genérica |
| Cloudflare Workers com assets estáticos (`wrangler.jsonc`) e fallback SPA | Recomendação atual da Cloudflare para sites estáticos; `_headers` e `_redirects` também funcionam em Pages |

## Proposta para a fase Supabase (não implementado)

- Supabase Auth (e-mail/senha, confirmação e recuperação de senha).
- Tabelas com `user_id uuid references auth.users` e **RLS** `user_id = auth.uid()` em todas — ver `supabase-schema.sql`.
- `SupabaseRepository` implementando `Repository`; a geração de parcelas pode continuar no cliente (inserção em lote numa transação via RPC) ou migrar para uma função.
