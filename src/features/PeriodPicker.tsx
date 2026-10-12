import { useState } from 'react';
import { View } from 'react-native';

import { addDays, addMonths, endOfMonth, fmtDate, startOfMonth, today } from '@/domain/dates';
import type { Period } from '@/domain/finance';
import { Button, Chip } from '@/ui/controls';
import { DateField, Row } from '@/ui/fields';
import { Sheet } from '@/ui/overlay';

export type PresetKey = '7' | '30' | '60' | '90' | 'mes' | 'prox30' | 'custom';

const LABEL: Record<PresetKey, string> = {
  '7': '7 dias',
  '30': '30 dias',
  '60': '60 dias',
  '90': '90 dias',
  mes: 'Este mês',
  prox30: 'Próximos 30 dias',
  custom: 'Personalizado',
};

export function presetPeriod(key: Exclude<PresetKey, 'custom'>): Period {
  const t = today();
  switch (key) {
    case 'mes':
      return { from: startOfMonth(t), to: endOfMonth(t) };
    case 'prox30':
      return { from: t, to: addDays(t, 30) };
    default:
      return { from: addDays(t, -(Number(key) - 1)), to: t };
  }
}

export interface PeriodValue {
  preset: PresetKey;
  period: Period;
}

export function usePeriod(initial: Exclude<PresetKey, 'custom'> = '30') {
  return useState<PeriodValue>({ preset: initial, period: presetPeriod(initial) });
}

export function PeriodPicker({
  value,
  onChange,
  presets = ['7', '30', '60', '90'],
}: {
  value: PeriodValue;
  onChange: (v: PeriodValue) => void;
  presets?: Exclude<PresetKey, 'custom'>[];
}) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<Period>(value.period);

  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, flexShrink: 1, maxWidth: '100%' }}>
      {presets.map((p) => (
        <Chip key={p} label={LABEL[p]} selected={value.preset === p} onPress={() => onChange({ preset: p, period: presetPeriod(p) })} />
      ))}
      <Chip
        icon="calendar"
        label={value.preset === 'custom' ? `${fmtDate(value.period.from)} – ${fmtDate(value.period.to)}` : LABEL.custom}
        selected={value.preset === 'custom'}
        onPress={() => {
          setDraft(value.period);
          setOpen(true);
        }}
      />
      <Sheet
        visible={open}
        onClose={() => setOpen(false)}
        title="Período personalizado"
        width={460}
        footer={
          <>
            <Button label="Cancelar" variant="secondary" onPress={() => setOpen(false)} />
            <Button
              label="Aplicar"
              disabled={draft.to < draft.from}
              onPress={() => {
                onChange({ preset: 'custom', period: draft });
                setOpen(false);
              }}
            />
          </>
        }
      >
        <Row>
          <DateField label="De" value={draft.from} onChange={(from) => setDraft((d) => ({ ...d, from }))} />
          <DateField
            label="Até"
            value={draft.to}
            onChange={(to) => setDraft((d) => ({ ...d, to }))}
            error={draft.to < draft.from ? 'A data final deve ser depois da inicial.' : null}
          />
        </Row>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
          <Chip label="Mês passado" onPress={() => {
            const ref = addMonths(today(), -1);
            setDraft({ from: startOfMonth(ref), to: endOfMonth(ref) });
          }} />
          <Chip label="Este mês" onPress={() => setDraft(presetPeriod('mes'))} />
          <Chip label="Próximo mês" onPress={() => {
            const ref = addMonths(today(), 1);
            setDraft({ from: startOfMonth(ref), to: endOfMonth(ref) });
          }} />
          <Chip label="Este ano" onPress={() => setDraft({ from: `${today().slice(0, 4)}-01-01`, to: `${today().slice(0, 4)}-12-31` })} />
        </View>
      </Sheet>
    </View>
  );
}
