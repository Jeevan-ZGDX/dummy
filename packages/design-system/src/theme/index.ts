export const colors = {
  // Base
  white: '#FFFFFF',
  black: '#000000',
  transparent: 'transparent',

  // Grays
  gray50: '#F9FAFB',
  gray100: '#F3F4F6',
  gray200: '#E5E7EB',
  gray300: '#D1D5DB',
  gray400: '#9CA3AF',
  gray500: '#6B7280',
  gray600: '#4B5563',
  gray700: '#374151',
  gray800: '#1F2937',
  gray900: '#111827',

  // Primary - Violet/Purple
  primary50: '#F5F3FF',
  primary100: '#EDE9FE',
  primary200: '#DDD6FE',
  primary300: '#C4B5FD',
  primary400: '#A78BFA',
  primary500: '#8B5CF6',
  primary600: '#7C3AED',
  primary700: '#6D28D9',
  primary800: '#5B21B6',
  primary900: '#4C1D95',

  // Accent (specific violet from design)
  accent: '#6C4CF1',
  accentHover: '#7B61FF',
  accentLight: '#EDE9FE',
  accentDark: '#5B21B6',

  // Semantic
  success: '#10B981',
  successLight: '#D1FAE5',
  successDark: '#059669',
  warning: '#F97316',
  warningLight: '#FFEDD5',
  warningDark: '#EA580C',
  error: '#EF4444',
  errorLight: '#FEE2E2',
  errorDark: '#DC2626',
  info: '#3B82F6',
  infoLight: '#DBEAFE',
  infoDark: '#2563EB',

  // Status colors
  pending: '#F97316',
  verified: '#10B981',
  completed: '#3B82F6',
  rejected: '#EF4444',

  // Backgrounds
  background: '#FFFFFF',
  surface: '#FFFFFF',
  surfaceSecondary: '#F9FAFB',
  surfaceTertiary: '#F3F4F6',
  overlay: 'rgba(0, 0, 0, 0.5)',
  backdrop: 'rgba(0, 0, 0, 0.3)',

  // Borders
  border: '#E5E7EB',
  borderStrong: '#D1D5DB',
  divider: '#F3F4F6',

  // Text
  textPrimary: '#111827',
  textSecondary: '#4B5563',
  textTertiary: '#9CA3AF',
  textInverse: '#FFFFFF',
  textDisabled: '#D1D5DB',
  textLink: '#6C4CF1'
} as const

export type ColorKeys = keyof typeof colors

export const spacing = {
  0: '0',
  1: '4px',
  2: '8px',
  3: '12px',
  4: '16px',
  5: '20px',
  6: '24px',
  7: '28px',
  8: '32px',
  10: '40px',
  12: '48px',
  16: '64px',
  20: '80px',
  24: '96px'
} as const

export const borderRadius = {
  none: '0',
  sm: '4px',
  md: '8px',
  lg: '12px',
  xl: '16px',
  '2xl': '20px',
  '3xl': '24px',
  full: '9999px'
} as const

export const shadows = {
  none: 'none',
  xs: '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
  sm: '0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px -1px rgba(0, 0, 0, 0.1)',
  md: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -2px rgba(0, 0, 0, 0.1)',
  lg: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -4px rgba(0, 0, 0, 0.1)',
  xl: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)',
  card: '0 2px 8px rgba(0, 0, 0, 0.06), 0 1px 3px rgba(0, 0, 0, 0.04)',
  cardHover: '0 8px 24px rgba(0, 0, 0, 0.08), 0 4px 12px rgba(0, 0, 0, 0.04)'
} as const

export const typography = {
  fontFamily: {
    sans: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
    mono: "'JetBrains Mono', 'Fira Code', monospace"
  },
  fontSize: {
    xs: ['12px', { lineHeight: '16px', letterSpacing: '0.01em' }],
    sm: ['14px', { lineHeight: '20px', letterSpacing: '0.01em' }],
    base: ['16px', { lineHeight: '24px', letterSpacing: '0.01em' }],
    lg: ['18px', { lineHeight: '28px', letterSpacing: '0.01em' }],
    xl: ['20px', { lineHeight: '28px', letterSpacing: '0.01em' }],
    '2xl': ['24px', { lineHeight: '32px', letterSpacing: '-0.01em' }],
    '3xl': ['30px', { lineHeight: '36px', letterSpacing: '-0.02em' }],
    '4xl': ['36px', { lineHeight: '40px', letterSpacing: '-0.02em' }],
    '5xl': ['48px', { lineHeight: '52px', letterSpacing: '-0.03em' }]
  },
  fontWeight: {
    normal: '400',
    medium: '500',
    semibold: '600',
    bold: '700'
  },
  lineHeight: {
    tight: '1.1',
    normal: '1.5',
    relaxed: '1.75'
  }
} as const

export const breakpoints = {
  sm: '640px',
  md: '768px',
  lg: '1024px',
  xl: '1280px',
  '2xl': '1536px'
} as const

export const transitions = {
  fast: '150ms ease',
  normal: '200ms ease',
  slow: '300ms ease'
} as const

export const zIndex = {
  hide: -1,
  base: 0,
  dropdown: 1000,
  sticky: 1100,
  modal: 1300,
  popover: 1400,
  tooltip: 1500,
  toast: 1700
} as const