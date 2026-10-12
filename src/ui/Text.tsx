import { Text as RNText, type TextProps, type TextStyle } from 'react-native';

import { fmtMoney } from '@/domain/money';
import { colors, font } from './theme';

type Variant = 'display' | 'h1' | 'h2' | 'title' | 'body' | 'small' | 'caption' | 'label';

const variants: Record<Variant, TextStyle> = {
  display: { fontFamily: font.semibold, fontSize: 32, lineHeight: 38, letterSpacing: -0.8 },
  h1: { fontFamily: font.semibold, fontSize: 24, lineHeight: 30, letterSpacing: -0.5 },
  h2: { fontFamily: font.semibold, fontSize: 18, lineHeight: 24, letterSpacing: -0.2 },
  title: { fontFamily: font.medium, fontSize: 15, lineHeight: 20 },
  body: { fontFamily: font.regular, fontSize: 14, lineHeight: 20 },
  small: { fontFamily: font.regular, fontSize: 13, lineHeight: 18 },
  caption: { fontFamily: font.regular, fontSize: 12, lineHeight: 16 },
  label: { fontFamily: font.medium, fontSize: 11, lineHeight: 14, letterSpacing: 0.8, textTransform: 'uppercase' },
};

export interface TProps extends TextProps {
  variant?: Variant;
  color?: string;
  weight?: keyof typeof font;
  align?: TextStyle['textAlign'];
  tabular?: boolean;
}

export function T({ variant = 'body', color = colors.ink, weight, align, tabular, style, ...rest }: TProps) {
  return (
    <RNText
      {...rest}
      style={[
        variants[variant],
        { color },
        weight && { fontFamily: font[weight] },
        align && { textAlign: align },
        tabular && { fontVariant: ['tabular-nums'] },
        style,
      ]}
    />
  );
}

export function Money({
  value,
  tone = 'neutral',
  signed,
  ...rest
}: Omit<TProps, 'children'> & { value: number; tone?: 'neutral' | 'income' | 'expense' | 'auto'; signed?: boolean }) {
  const resolved = tone === 'auto' ? (value < 0 ? 'expense' : 'income') : tone;
  const color = resolved === 'income' ? colors.income : resolved === 'expense' ? colors.expense : rest.color;
  const prefix = signed ? (value > 0 ? '+ ' : value < 0 ? '− ' : '') : value < 0 ? '− ' : '';
  return (
    <T tabular {...rest} color={color ?? colors.ink}>
      {prefix}
      {fmtMoney(Math.abs(value))}
    </T>
  );
}
