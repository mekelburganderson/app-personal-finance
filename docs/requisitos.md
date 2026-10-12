# Requisitos e rastreabilidade

Fonte: especificação "Personal Finance" enviada pelo usuário em 12/10/2026.

## Critérios de aceite

| Nº | Critério | Implementação | Validação |
|----|----------|---------------|-----------|
| 01 | App financeiro para receitas e despesas | Todo o app; formulário em `src/features/TransactionSheet.tsx` | Manual (navegador) |
| 02 | Autenticação com e-mail e senha; login único | `src/data/local-repository.ts` (`signUp`/`signIn`, e-mail normalizado em minúsculas) | Manual: cadastro com e-mail já existente (em maiúsculas) foi recusado |
| 03 | Opção de cadastro na tela de login | `src/app/(auth)/login.tsx` → `cadastro.tsx` | Manual |
| 04 | Lançamentos vinculados ao usuário logado | `userId` em toda entidade; repositório grava por usuário e valida sessão (`assertSession`) | Manual |
| 05 | Usuário não vê lançamentos de outro | Dados em chaves separadas por usuário + filtro por `userId` no `load` | Manual: novo usuário iniciou com tudo zerado |
| 06 | Lançar receitas e despesas | `TransactionSheet` (alternador Despesa/Receita) | Manual |
| 07 | Receitas únicas, recorrentes ou parceladas | Repetição: Única / Parcelada / Recorrente | Teste unitário + manual |
| 08 | Despesas avulsas recorrentes ou parceladas | Idem | Teste unitário + manual |
| 09 | Despesas na fatura do cartão, única ou parcelada | Forma "Cartão de crédito" + seleção de fatura; parcelas distribuídas nas faturas seguintes | Teste unitário + manual (compra 10x criada) |
| 10 | Data de lançamento, vencimento, recorrência, parcelas e vencimento de cada parcela | Campos de data; recorrência por frequência + "após N vezes" ou "até data"; pré-visualização editável (data e valor) por parcela | Teste unitário + manual |
| 11 | Forma de pagamento | Pix, dinheiro, boleto, débito, transferência, débito automático, cartão de crédito | Manual |
| 12 | Cartão → escolher o cartão e lançar na fatura em aberto | Fatura sugerida pela data de compra e dia de fechamento; pode escolher outra | Teste unitário + manual |
| 13 | Cadastrar cartão com data de fechamento | `src/features/CardForm.tsx` (fechamento, vencimento, limite, conta padrão) | Manual |
| 14 | Pagar faturas | Pagamento total ou parcial, estorno; `Editor.tsx` → `InvoicePaySheet` | Teste unitário (saldo) |
| 15 | Pagar despesas e receber receitas | `SettleSheet` (data, conta, valor efetivo); desfazer pagamento | Manual: saldo e indicadores atualizados |
| 16 | Categorias e subcategorias de receitas e despesas | `src/app/(app)/categorias.tsx` | Manual |
| 17 | CRUD de lançamentos e categorias | Criar, ver, editar (escopo: só este / este e próximos / todos), excluir | Manual |
| 18 | Consultar lançamentos por período | `src/app/(app)/lancamentos.tsx`: período, por vencimento ou lançamento, tipo, status, origem, conta, cartão, categoria, busca | Manual |
| 19 | Dashboard: receitas, despesas, saldo; padrão 30 dias; 7/60/90/personalizado | `src/app/(app)/index.tsx` + `computeDashboard` | Teste unitário + manual |
| 20 | Provisões a receber/pagar nos próximos 7 dias (em aberto) | Painel "Próximos 7 dias" (inclui faturas) + alerta de vencidos | Teste unitário + manual |

## Hipóteses adotadas (validar com o usuário)

- **Cartão de crédito apenas para despesas** e apenas única/parcelada (critério 09). Assinaturas recorrentes no cartão ficam para uma próxima versão.
- **Itens de cartão não são pagos individualmente**: são quitados pelo pagamento da fatura.
- **Recorrência** gera de 2 a 120 lançamentos de uma vez (não é infinita), conforme escolhido pelo usuário.
- **Alterar uma série** (escopo "este e próximos"/"todos") propaga descrição, valor, categoria, forma de pagamento, conta e observações; datas mudam só no item editado.
- Não é possível mudar a quantidade de parcelas de uma série já criada: exclua e lance novamente.
- **Categoria é obrigatória**; subcategoria é opcional.
- Exclusão de conta/cartão com lançamentos é bloqueada; o app oferece **arquivar**.

## Pendências

- Recuperação de senha e confirmação de e-mail (dependem do Supabase Auth).
- Transferência entre contas (não estava no escopo).
- Exportação (CSV/PDF) dos relatórios.
