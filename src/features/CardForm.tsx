import { useEffect, useState } from 'react';
import { Pressable, View } from 'react-native';

import { invoiceDates, invoiceRefForDate } from '@/domain/finance';
import { fmtDate, today } from '@/domain/dates';
import type { CreditCard } from '@/domain/types';
import { InUseError, useData } from '@/state/data';
import { Button, Icon } from '@/ui/controls';
import { MoneyField, Row, Select, TextField } from '@/ui/fields';
import { Sheet, useConfirm, useToast } from '@/ui/overlay';
import { T } from '@/ui/Text';
import { colors, swatches } from '@/ui/theme';
import { accountOptions } from './options';

export function ColorPicker({ value, onChange }: { value: string; onChange: (c: string) => void }) {
  return (
    <View style={{ gap: 6 }}>
      <T variant="small" weight="medium" color={colors.ink2}>Cor</T>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {swatches.map((c) => (
          <Pressable
            key={c}
            onPress={() => onChange(c)}
            accessibilityLabel={`Cor ${c}`}
            accessibilityState={{ selected: value === c }}
            style={{
              width: 28,
              height: 28,
              borderRadius: 14,
              backgroundColor: c,
              alignItems: 'center',
              justifyContent: 'center',
              borderWidth: 2,
              borderColor: value === c ? colors.ink : 'transparent',
            }}
          >
            {value === c ? <Icon name="check" size={14} color="#fff" /> : null}
          </Pressable>
        ))}
      </View>
    </View>
  );
}

const dayOk = (s: string) => {
  const n = Number(s);
  return Number.isInteger(n) && n >= 1 && n <= 28;
};

export function CardForm({ visible, onClose, card }: { visible: boolean; onClose: () => void; card?: CreditCard | null }) {
  const data = useData();
  const toast = useToast();
  const confirm = useConfirm();
  const [name, setName] = useState('');
  const [lastDigits, setLastDigits] = useState('');
  const [limit, setLimit] = useState<number | null>(null);
  const [closingDay, setClosingDay] = useState('');
  const [dueDay, setDueDay] = useState('');
  const [color, setColor] = useState(swatches[11]);
  const [accountId, setAccountId] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!visible) return;
    setName(card?.name ?? '');
    setLastDigits(card?.lastDigits ?? '');
    setLimit(card?.limit ?? null);
    setClosingDay(card ? String(card.closingDay) : '');
    setDueDay(card ? String(card.dueDay) : '');
    setColor(card?.color ?? swatches[11]);
    setAccountId(card?.defaultAccountId ?? data.accounts.find((a) => !a.archived)?.id ?? null);
    setErrors({});
  }, [visible, card, data.accounts]);

  const preview =
    dayOk(closingDay) && dayOk(dueDay) && closingDay !== dueDay
      ? (() => {
          const c = { closingDay: Number(closingDay), dueDay: Number(dueDay) };
          const ref = invoiceRefForDate(c, today());
          const d = invoiceDates(c, ref);
          return `Uma compra feita hoje entra na fatura que fecha em ${fmtDate(d.closingDate)} e vence em ${fmtDate(d.dueDate)}.`;
        })()
      : null;

  const save = async () => {
    const e: Record<string, string> = {};
    if (!name.trim()) e.name = 'Dê um nome ao cartão.';
    if (lastDigits && !/^\d{4}$/.test(lastDigits)) e.lastDigits = 'Use 4 dígitos.';
    if (!limit || limit <= 0) e.limit = 'Informe o limite.';
    if (!dayOk(closingDay)) e.closingDay = 'Dia entre 1 e 28.';
    if (!dayOk(dueDay)) e.dueDay = 'Dia entre 1 e 28.';
    if (!e.closingDay && !e.dueDay && closingDay === dueDay) e.dueDay = 'Vencimento deve ser diferente do fechamento.';
    setErrors(e);
    if (Object.keys(e).length) return;
    await data.saveCard({
      id: card?.id,
      name: name.trim(),
      lastDigits,
      limit: limit!,
      closingDay: Number(closingDay),
      dueDay: Number(dueDay),
      color,
      defaultAccountId: accountId,
      archived: card?.archived ?? false,
    });
    toast(card ? 'Cartão atualizado' : 'Cartão cadastrado');
    onClose();
  };

  const remove = async () => {
    if (!card) return;
    const ok = await confirm({ title: 'Excluir cartão?', message: `"${card.name}" será removido.`, confirmLabel: 'Excluir', destructive: true });
    if (!ok) return;
    try {
      await data.deleteCard(card.id);
      toast('Cartão excluído');
      onClose();
    } catch (err) {
      if (err instanceof InUseError) {
        const archive = await confirm({ title: 'Não é possível excluir', message: err.message, confirmLabel: 'Arquivar cartão' });
        if (archive) {
          await data.saveCard({ ...card, archived: true });
          toast('Cartão arquivado');
          onClose();
        }
      }
    }
  };

  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      title={card ? 'Editar cartão' : 'Novo cartão de crédito'}
      footer={
        <>
          {card ? <Button label="Excluir" variant="ghost" icon="trash-2" onPress={remove} style={{ marginRight: 'auto' }} /> : null}
          {card?.archived ? <Button label="Reativar" variant="secondary" onPress={async () => { await data.saveCard({ ...card, archived: false }); onClose(); }} /> : null}
          <Button label="Cancelar" variant="secondary" onPress={onClose} />
          <Button label="Salvar" onPress={save} />
        </>
      }
    >
      <Row>
        <TextField label="Nome" value={name} onChangeText={setName} error={errors.name} placeholder="Ex.: Nubank" style={{ flexGrow: 2 }} />
        <TextField label="Final" value={lastDigits} onChangeText={(v) => setLastDigits(v.replace(/\D/g, '').slice(0, 4))} error={errors.lastDigits} placeholder="1234" inputMode="numeric" />
      </Row>
      <Row>
        <MoneyField label="Limite" value={limit} onChange={setLimit} error={errors.limit} />
        <TextField label="Dia do fechamento" value={closingDay} onChangeText={(v) => setClosingDay(v.replace(/\D/g, '').slice(0, 2))} error={errors.closingDay} inputMode="numeric" />
        <TextField label="Dia do vencimento" value={dueDay} onChangeText={(v) => setDueDay(v.replace(/\D/g, '').slice(0, 2))} error={errors.dueDay} inputMode="numeric" />
      </Row>
      {preview ? <T variant="small" color={colors.ink3}>{preview}</T> : null}
      <Select
        label="Conta padrão para pagar a fatura"
        value={accountId}
        options={accountOptions(data.accounts, accountId)}
        onChange={setAccountId}
        allowClear
      />
      <ColorPicker value={color} onChange={setColor} />
    </Sheet>
  );
}
