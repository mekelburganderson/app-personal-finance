import { Platform, useWindowDimensions } from 'react-native';

export const colors = {
  bg: '#F4F2EC',
  surface: '#FFFFFF',
  surfaceAlt: '#FAF8F3',
  sunken: '#EDEAE2',
  ink: '#15171A',
  ink2: '#4A4D52',
  ink3: '#85878A',
  line: '#E6E2D8',
  lineStrong: '#D3CEC1',

  income: '#1E6B4E',
  incomeSoft: '#E3EFE8',
  expense: '#B5432C',
  expenseSoft: '#F6E4DE',
  warn: '#9A6413',
  warnSoft: '#F5EBD6',
  info: '#2F5D8A',
  infoSoft: '#E2EAF2',

  sidebar: '#15171A',
  sidebarInk: '#E9E6DE',
  sidebarMuted: '#8C8A84',
  focus: '#2F5D8A',

  // Séries de gráfico (par validado para daltonismo; não usar verde x vermelho).
  chartIncome: '#2F6DB0',
  chartExpense: '#C8642A',
  grid: '#EEEBE3',
} as const;

export const font = {
  regular: 'IBMPlexSans_400Regular',
  medium: 'IBMPlexSans_500Medium',
  semibold: 'IBMPlexSans_600SemiBold',
  bold: 'IBMPlexSans_700Bold',
} as const;

export const radius = { sm: 8, md: 12, lg: 16, pill: 999 } as const;

export const space = (n: number) => n * 4;

/** Paleta para cores de contas, cartões e categorias. */
export const swatches = [
  '#B5523A', '#C98B2B', '#6E7B4F', '#2F7D5B', '#3E7C86', '#3C6E8F',
  '#5B6C8F', '#6B3FA0', '#8E5B8C', '#7D4E3A', '#B4541A', '#3D2A5C', '#15171A', '#8A8580',
];

export const isWeb = Platform.OS === 'web';

export function useLayout() {
  const { width } = useWindowDimensions();
  return { width, isWide: width >= 960, isMedium: width >= 640 };
}

/** Sombra discreta compatível com web e nativo. */
export const shadow = Platform.select({
  web: { boxShadow: '0 1px 2px rgba(21,23,26,0.04), 0 8px 24px -12px rgba(21,23,26,0.12)' } as object,
  default: { shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 2 },
});
