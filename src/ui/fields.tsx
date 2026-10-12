import { createContext, createElement, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { Pressable, StyleSheet, TextInput, View, type TextInputProps } from 'react-native';

import { brToISO, fmtDate, isValidISO } from '@/domain/dates';
import { fmtPlain, parseMoney } from '@/domain/money';
import { Icon } from './controls';
import { Sheet } from './overlay';
import { T } from './Text';
import { colors, font, isWeb, radius } from './theme';

/** Dentro de <Row>, campos dividem a largura igualmente. */
const InRow = createContext(false);

export function Field({
  label,
  error,
  hint,
  children,
  style,
}: {
  label?: string;
  error?: string | null;
  hint?: string;
  children: ReactNode;
  style?: object;
}) {
  const inRow = useContext(InRow);
  return (
    <View style={[{ gap: 6 }, inRow && { flexGrow: 1, flexBasis: 0, minWidth: 140 }, style]}>
      {label ? <T variant="small" weight="medium" color={colors.ink2}>{label}</T> : null}
      {children}
      {error ? (
        <T variant="caption" color={colors.expense}>{error}</T>
      ) : hint ? (
        <T variant="caption" color={colors.ink3}>{hint}</T>
      ) : null}
    </View>
  );
}

export function Row({ children, gap = 12 }: { children: ReactNode; gap?: number }) {
  return (
    <InRow.Provider value>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap }}>{children}</View>
    </InRow.Provider>
  );
}

export function TextField({
  label,
  error,
  hint,
  prefix,
  style,
  ...input
}: TextInputProps & { label?: string; error?: string | null; hint?: string; prefix?: string }) {
  const [focused, setFocused] = useState(false);
  return (
    <Field label={label} error={error} hint={hint} style={style as object}>
      <View style={[styles.box, focused && styles.focused, !!error && { borderColor: colors.expense }]}>
        {prefix ? <T color={colors.ink3}>{prefix}</T> : null}
        <TextInput
          placeholderTextColor={colors.ink3}
          {...input}
          onFocus={(e) => {
            setFocused(true);
            input.onFocus?.(e);
          }}
          onBlur={(e) => {
            setFocused(false);
            input.onBlur?.(e);
          }}
          style={[styles.input, input.multiline && { minHeight: 72, paddingTop: 10, textAlignVertical: 'top' }]}
        />
      </View>
    </Field>
  );
}

export function MoneyField({
  value,
  onChange,
  ...rest
}: { value: number | null; onChange: (cents: number | null) => void; label?: string; error?: string | null; hint?: string; autoFocus?: boolean }) {
  const [text, setText] = useState(value != null ? fmtPlain(value) : '');
  useEffect(() => {
    // Sincroniza quando o valor muda por fora (ex.: edição carregada).
    if (value == null) return;
    if (parseMoney(text) !== value) setText(fmtPlain(value));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);
  return (
    <TextField
      {...rest}
      prefix="R$"
      value={text}
      inputMode="decimal"
      keyboardType="decimal-pad"
      placeholder="0,00"
      onChangeText={(t) => {
        setText(t);
        onChange(parseMoney(t));
      }}
      onBlur={() => {
        const v = parseMoney(text);
        if (v != null) setText(fmtPlain(v));
      }}
    />
  );
}

/** Campo de data: usa o seletor nativo do navegador na web e dd/mm/aaaa no app. */
export function DateField({
  label,
  value,
  onChange,
  error,
  hint,
  min,
}: {
  label?: string;
  value: string;
  onChange: (iso: string) => void;
  error?: string | null;
  hint?: string;
  min?: string;
}) {
  const [text, setText] = useState(fmtDate(value));
  useEffect(() => setText(fmtDate(value)), [value]);

  if (isWeb) {
    return (
      <Field label={label} error={error} hint={hint}>
        {createElement('input', {
          type: 'date',
          value,
          min,
          'aria-label': label,
          onChange: (e: { target: { value: string } }) => {
            if (isValidISO(e.target.value)) onChange(e.target.value);
          },
          style: {
            height: 42,
            borderRadius: radius.sm,
            border: `1px solid ${error ? colors.expense : colors.lineStrong}`,
            padding: '0 12px',
            fontFamily: font.regular,
            fontSize: 14,
            color: colors.ink,
            backgroundColor: colors.surface,
            outlineColor: colors.focus,
            minWidth: 0,
            width: '100%',
            boxSizing: 'border-box',
          },
        })}
      </Field>
    );
  }
  return (
    <TextField
      label={label}
      error={error}
      hint={hint}
      value={text}
      placeholder="dd/mm/aaaa"
      keyboardType="number-pad"
      onChangeText={(t) => {
        setText(t);
        const iso = brToISO(t);
        if (iso) onChange(iso);
      }}
    />
  );
}

export interface SelectOption<V extends string = string> {
  value: V;
  label: string;
  hint?: string;
  color?: string;
  indent?: boolean;
  group?: string;
}

export function Select<V extends string>({
  label,
  value,
  options,
  onChange,
  placeholder = 'Selecionar',
  error,
  hint,
  allowClear,
}: {
  label?: string;
  value: V | null;
  options: SelectOption<V>[];
  onChange: (v: V | null) => void;
  placeholder?: string;
  error?: string | null;
  hint?: string;
  allowClear?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const selected = options.find((o) => o.value === value);
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? options.filter((o) => o.label.toLowerCase().includes(q) || o.group?.toLowerCase().includes(q)) : options;
  }, [options, query]);

  return (
    <Field label={label} error={error} hint={hint}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={label}
        onPress={() => setOpen(true)}
        style={({ hovered }: { hovered?: boolean }) => [styles.box, hovered && { borderColor: colors.ink3 }, !!error && { borderColor: colors.expense }]}
      >
        {selected?.color ? <View style={[styles.dot, { backgroundColor: selected.color }]} /> : null}
        <T numberOfLines={1} style={{ flex: 1 }} color={selected ? colors.ink : colors.ink3}>
          {selected ? (selected.group && selected.indent ? `${selected.group} › ${selected.label}` : selected.label) : placeholder}
        </T>
        <Icon name="chevron-down" size={16} color={colors.ink3} />
      </Pressable>
      <Sheet visible={open} onClose={() => setOpen(false)} title={label ?? placeholder} width={460}>
        <InRow.Provider value={false}>
        {options.length > 8 ? (
          <TextField placeholder="Buscar…" value={query} onChangeText={setQuery} autoFocus />
        ) : null}
        <View style={{ gap: 2 }}>
          {allowClear && value ? (
            <Pressable
              onPress={() => {
                onChange(null);
                setOpen(false);
              }}
              style={styles.option}
            >
              <T color={colors.ink3}>Nenhum</T>
            </Pressable>
          ) : null}
          {filtered.map((o) => {
            const active = o.value === value;
            return (
              <Pressable
                key={o.value}
                onPress={() => {
                  onChange(o.value);
                  setOpen(false);
                  setQuery('');
                }}
                style={({ hovered }: { hovered?: boolean }) => [
                  styles.option,
                  o.indent && { paddingLeft: 34 },
                  (hovered || active) && { backgroundColor: colors.surfaceAlt },
                ]}
              >
                {o.color ? <View style={[styles.dot, { backgroundColor: o.color }, o.indent && { opacity: 0.5 }]} /> : null}
                <View style={{ flex: 1 }}>
                  <T weight={active || !o.indent ? 'medium' : 'regular'}>{o.label}</T>
                  {o.hint ? <T variant="caption" color={colors.ink3}>{o.hint}</T> : null}
                </View>
                {active ? <Icon name="check" size={16} /> : null}
              </Pressable>
            );
          })}
          {filtered.length === 0 ? <T color={colors.ink3}>Nada encontrado.</T> : null}
        </View>
        </InRow.Provider>
      </Sheet>
    </Field>
  );
}

const styles = StyleSheet.create({
  box: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    minHeight: 42,
    paddingHorizontal: 12,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.lineStrong,
    backgroundColor: colors.surface,
  },
  focused: { borderColor: colors.focus },
  input: {
    flex: 1,
    minWidth: 0,
    paddingVertical: 10,
    fontFamily: font.regular,
    fontSize: 14,
    color: colors.ink,
    ...(isWeb ? ({ outlineStyle: 'none' } as object) : {}),
  },
  dot: { width: 10, height: 10, borderRadius: 5 },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: radius.sm,
  },
});
