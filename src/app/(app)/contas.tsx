import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { addDays, today } from '@/domain/dates';
import { accountBalance } from '@/domain/finance';
import { ACCOUNT_TYPE_LABEL } from '@/domain/labels';
import type { Account, AccountType } from '@/domain/types';
import { ColorPicker } from '@/features/CardForm';
import { InUseError, useData } from '@/state/data';
import { Button, Chip, Icon } from '@/ui/controls';
import { MoneyField, Row, Select, TextField } from '@/ui/fields';
import { Badge, EmptyState, Panel, Screen } from '@/ui/layout';
import { Sheet, useConfirm, useToast } from '@/ui/overlay';
import { Money, T } from '@/ui/Text';
import { colors, radius, swatches } from '@/ui/theme';

export default function Contas() {
  const data = useData();
  const [form, setForm] = useState<{ account?: Account } | null>(null);
  const [showArchived, setShowArchived] = useState(false);
  const T0 = today();
  const horizon = addDays(T0, 30);

  const rows = data.accounts
    .filter((a) => showArchived || !a.archived)
    .map((a) => {
      const balance = accountBalance(a, data.transactions, data.invoicePayments);
      let projected = balance;
      for (const t of data.transactions) {
        if (t.cardId || t.status !== 'aberto' || t.accountId !== a.id || t.dueDate > horizon) continue;
        projected += t.kind === 'receita' ? t.amount : -t.amount;
      }
      for (const [cardId, invoices] of data.invoicesByCard) {
        if (data.cardById.get(cardId)?.defaultAccountId !== a.id) continue;
        for (const inv of invoices) if (inv.dueDate <= horizon && inv.total > inv.paid) projected -= inv.total - inv.paid;
      }
      return { account: a, balance, projected };
    });
  const total = rows.filter((r) => !r.account.archived).reduce((s, r) => s + r.balance, 0);

  return (
    <Screen
      title="Contas"
      subtitle="Saldos de contas bancárias, carteira e investimentos"
      actions={
        <>
          {data.accounts.some((a) => a.archived) ? <Chip label="Mostrar arquivadas" selected={showArchived} onPress={() => setShowArchived((v) => !v)} /> : null}
          <Button label="Nova conta" icon="plus" onPress={() => setForm({})} />
        </>
      }
    >
      <View style={styles.total}>
        <T variant="label" color={colors.sidebarMuted}>Saldo total hoje</T>
        <Money variant="display" value={total} color={colors.sidebarInk} />
      </View>

      <Panel padded={false}>
        {rows.length === 0 ? (
          <EmptyState icon="briefcase" title="Nenhuma conta" message="Cadastre onde seu dinheiro fica: conta corrente, poupança, carteira." action={<Button label="Nova conta" icon="plus" onPress={() => setForm({})} />} />
        ) : (
          rows.map(({ account, balance, projected }) => (
            <Pressable
              key={account.id}
              onPress={() => setForm({ account })}
              style={({ hovered }: { hovered?: boolean }) => [styles.row, hovered && { backgroundColor: colors.surfaceAlt }]}
            >
              <View style={[styles.icon, { backgroundColor: account.color }]}>
                <Icon name={account.type === 'carteira' ? 'dollar-sign' : account.type === 'investimento' ? 'trending-up' : 'briefcase'} size={16} color="#fff" />
              </View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <View style={{ flexDirection: 'row', gap: 6, alignItems: 'center' }}>
                  <T weight="medium">{account.name}</T>
                  {account.archived ? <Badge label="Arquivada" /> : null}
                </View>
                <T variant="caption" color={colors.ink3}>{ACCOUNT_TYPE_LABEL[account.type]}</T>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Money weight="semibold" value={balance} tone={balance < 0 ? 'auto' : 'neutral'} />
                <T variant="caption" color={colors.ink3} tabular>
                  Previsto em 30 dias: <Money variant="caption" value={projected} color={colors.ink3} />
                </T>
              </View>
              <Icon name="chevron-right" size={16} color={colors.ink3} />
            </Pressable>
          ))
        )}
      </Panel>
      <T variant="caption" color={colors.ink3}>
        Saldo = saldo inicial + recebimentos − pagamentos − faturas pagas. O previsto soma os lançamentos em aberto e as faturas
        que vencem nos próximos 30 dias.
      </T>

      <AccountForm visible={!!form} account={form?.account} onClose={() => setForm(null)} />
    </Screen>
  );
}

function AccountForm({ visible, onClose, account }: { visible: boolean; onClose: () => void; account?: Account }) {
  const data = useData();
  const toast = useToast();
  const confirm = useConfirm();
  const [name, setName] = useState('');
  const [type, setType] = useState<AccountType>('corrente');
  const [initial, setInitial] = useState<number | null>(0);
  const [negative, setNegative] = useState(false);
  const [color, setColor] = useState(swatches[3]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!visible) return;
    setName(account?.name ?? '');
    setType(account?.type ?? 'corrente');
    setInitial(Math.abs(account?.initialBalance ?? 0));
    setNegative((account?.initialBalance ?? 0) < 0);
    setColor(account?.color ?? swatches[3]);
    setError(null);
  }, [visible, account]);

  const save = async () => {
    if (!name.trim()) return setError('Dê um nome à conta.');
    await data.saveAccount({
      id: account?.id,
      name: name.trim(),
      type,
      initialBalance: (initial ?? 0) * (negative ? -1 : 1),
      color,
      archived: account?.archived ?? false,
    });
    toast(account ? 'Conta atualizada' : 'Conta criada');
    onClose();
  };

  const remove = async () => {
    if (!account) return;
    const ok = await confirm({ title: 'Excluir conta?', message: `"${account.name}" será removida.`, confirmLabel: 'Excluir', destructive: true });
    if (!ok) return;
    try {
      await data.deleteAccount(account.id);
      toast('Conta excluída');
      onClose();
    } catch (err) {
      if (err instanceof InUseError) {
        const archive = await confirm({ title: 'Não é possível excluir', message: err.message, confirmLabel: 'Arquivar conta' });
        if (archive) {
          await data.saveAccount({ ...account, archived: true });
          toast('Conta arquivada');
          onClose();
        }
      }
    }
  };

  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      title={account ? 'Editar conta' : 'Nova conta'}
      width={500}
      footer={
        <>
          {account ? <Button label="Excluir" variant="ghost" icon="trash-2" onPress={remove} style={{ marginRight: 'auto' }} /> : null}
          {account?.archived ? <Button label="Reativar" variant="secondary" onPress={async () => { await data.saveAccount({ ...account, archived: false }); onClose(); }} /> : null}
          <Button label="Cancelar" variant="secondary" onPress={onClose} />
          <Button label="Salvar" onPress={save} />
        </>
      }
    >
      <TextField label="Nome" value={name} onChangeText={setName} error={error} placeholder="Ex.: Conta Itaú" />
      <Row>
        <Select
          label="Tipo"
          value={type}
          options={(Object.keys(ACCOUNT_TYPE_LABEL) as AccountType[]).map((k) => ({ value: k, label: ACCOUNT_TYPE_LABEL[k] }))}
          onChange={(v) => v && setType(v)}
        />
        <MoneyField label="Saldo inicial" value={initial} onChange={setInitial} />
      </Row>
      <View style={{ flexDirection: 'row', gap: 6 }}>
        <Chip label="Saldo positivo" selected={!negative} onPress={() => setNegative(false)} />
        <Chip label="Saldo negativo" selected={negative} onPress={() => setNegative(true)} tone={colors.expense} />
      </View>
      <ColorPicker value={color} onChange={setColor} />
    </Sheet>
  );
}

const styles = StyleSheet.create({
  total: { backgroundColor: colors.sidebar, borderRadius: radius.lg, padding: 20, gap: 4 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
  },
  icon: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
});
