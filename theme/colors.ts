export const colors = {
  bg: '#0b0f0d',
  bgElevated: '#11171a',
  card: '#161e21',
  cardHover: '#1d262a',
  border: '#22302f',
  borderStrong: '#34474a',

  text: '#e7efe9',
  textMuted: '#90a39c',
  textDim: '#5d6f6a',

  profit: '#4ade80',
  loss: '#f87171',
  neutral: '#9ca3af',

  accent: '#16a34a',
  accentDark: '#0f5e2e',
  accentSoft: '#1f3a2a',

  warn: '#f59e0b',
  danger: '#dc2626',

  felt: '#0f3a23',
};

export const radius = {
  sm: 6,
  md: 10,
  lg: 14,
  xl: 20,
  pill: 999,
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
};

export const typography = {
  display: 28,
  title: 22,
  heading: 18,
  body: 15,
  small: 13,
  micro: 11,
};

export function pnlColor(value: number) {
  if (value > 0) return colors.profit;
  if (value < 0) return colors.loss;
  return colors.neutral;
}
