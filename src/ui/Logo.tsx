import { View } from 'react-native';
import Svg, { Rect } from 'react-native-svg';

import { T } from './Text';

/** Marca: três linhas de razão contábil com a última em destaque. */
export function LogoMark({ size = 28, ink = '#15171A', accent = '#1E6B4E', paper = '#F4F2EC' }: { size?: number; ink?: string; accent?: string; paper?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 32 32">
      <Rect x="0" y="0" width="32" height="32" rx="8" fill={ink} />
      <Rect x="8" y="9" width="16" height="2.6" rx="1.3" fill={paper} opacity={0.55} />
      <Rect x="8" y="14.7" width="11" height="2.6" rx="1.3" fill={paper} opacity={0.8} />
      <Rect x="8" y="20.4" width="16" height="2.6" rx="1.3" fill={accent} />
    </Svg>
  );
}

export function Logo({ color = '#15171A', light }: { color?: string; light?: boolean }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
      <LogoMark ink={light ? '#F4F2EC' : '#15171A'} paper={light ? '#15171A' : '#F4F2EC'} accent={light ? '#3FA77C' : '#1E6B4E'} />
      <T variant="title" weight="semibold" color={color} style={{ letterSpacing: -0.2 }}>
        Personal Finance
      </T>
    </View>
  );
}
