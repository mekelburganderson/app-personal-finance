import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { fmtShort, fmtRef } from '@/domain/dates';
import { cardUsedLimit } from '@/domain/finance';
import { INVOICE_STATUS_LABEL } from '@/domain/labels';
import type { CreditCard } from '@/domain/types';
import { CardForm } from '@/features/CardForm';
import { CardVisual } from '@/features/CardVisual';
import { useEditor } from '@/features/Editor';
import { useData } from '@/state/data';
import { Button, Chip } from '@/ui/controls';
import { Badge, EmptyState, Panel, Screen } from '@/ui/layout';
import { Money, T } from '@/ui/Text';
import { colors } from '@/ui/theme';

export default function Cartoes() {
  const data = useData();
  const editor = useEditor();
  const [form, setForm] = useState<{ card?: CreditCard } | null>(null);
  const [showArchived, setShowArchived] = useState(false);
  const cards = data.cards.filter((c) => showArchived || !c.archived);
  const hasArchived = data.cards.some((c) => c.archived);

  return (
    <Screen
      title="Cartões de crédito"
      subtitle="Faturas, limites e compras no cartão"
      actions={
        <>
          {hasArchived ? <Chip label="Mostrar arquivados" selected={showArchived} onPress={() => setShowArchived((v) => !v)} /> : null}
          <Button label="Novo cartão" variant="secondary" icon="plus" onPress={() => setForm({})} />
        </>
      }
    >
      {cards.length === 0 ? (
        <Panel>
          <EmptyState
            icon="credit-card"
            title="Nenhum cartão cadastrado"
            message="Cadastre o cartão com o dia de fechamento e de vencimento para que as compras caiam na fatura certa."
            action={<Button label="Cadastrar cartão" icon="plus" onPress={() => setForm({})} />}
          />
        </Panel>
      ) : (
        <View style={styles.grid}>
          {cards.map((card) => {
            const invoices = data.invoicesByCard.get(card.id) ?? [];
            const used = cardUsedLimit(invoices);
            const toPay = invoices.filter((i) => i.status === 'fechada');
            const open = invoices.find((i) => i.status === 'aberta');
            return (
              <View key={card.id} style={styles.item}>
                <Pressable onPress={() => router.navigate(`/cartoes/${card.id}` as never)}>
                  <CardVisual card={card} used={used} />
                </Pressable>
                <Panel>
                  {toPay.map((inv) => (
                    <View key={inv.ref} style={styles.line}>
                      <View style={{ flex: 1 }}>
                        <View style={{ flexDirection: 'row', gap: 6, alignItems: 'center' }}>
                          <T weight="medium">Fatura {fmtRef(inv.ref)}</T>
                          <Badge label={INVOICE_STATUS_LABEL[inv.status]} tone="warn" />
                        </View>
                        <T variant="caption" color={colors.ink3}>Vence {fmtShort(inv.dueDate)}</T>
                      </View>
                      <Money weight="semibold" value={inv.total - inv.paid} />
                      <Button size="sm" label="Pagar" onPress={() => editor.payInvoice(card, inv)} />
                    </View>
                  ))}
                  {open ? (
                    <View style={styles.line}>
                      <View style={{ flex: 1 }}>
                        <View style={{ flexDirection: 'row', gap: 6, alignItems: 'center' }}>
                          <T weight="medium">Fatura {fmtRef(open.ref)}</T>
                          <Badge label="Aberta" tone="info" />
                        </View>
                        <T variant="caption" color={colors.ink3}>Fecha {fmtShort(open.closingDate)} · vence {fmtShort(open.dueDate)}</T>
                      </View>
                      <Money weight="semibold" value={open.total - open.paid} />
                    </View>
                  ) : null}
                  <View style={[styles.line, { justifyContent: 'space-between' }]}>
                    <T variant="small" color={colors.ink3}>Limite disponível</T>
                    <Money variant="small" weight="medium" value={Math.max(0, card.limit - used)} />
                  </View>
                  <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
                    <Button size="sm" label="Nova compra" icon="plus" onPress={() => editor.create({ kind: 'despesa', cardId: card.id })} />
                    <Button size="sm" variant="secondary" label="Ver faturas" onPress={() => router.navigate(`/cartoes/${card.id}` as never)} />
                    <Button size="sm" variant="ghost" label="Editar" icon="edit-2" onPress={() => setForm({ card })} />
                  </View>
                </Panel>
              </View>
            );
          })}
        </View>
      )}
      <CardForm visible={!!form} card={form?.card} onClose={() => setForm(null)} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 20 },
  item: { flexGrow: 1, flexBasis: 320, maxWidth: 560, gap: 10 },
  line: { flexDirection: 'row', alignItems: 'center', gap: 10 },
});
