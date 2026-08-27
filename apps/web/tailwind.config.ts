import type { Config } from 'tailwindcss'

/**
 * One warm, low-chroma palette.
 *
 * The old config carried four unrelated accents (violet `accent`, purple
 * `primary`, orange `striver`, blue `gemini`) which never resolved into a single
 * voice. Every token name is kept so existing markup keeps compiling — only the
 * values change, which re-skins all pages at once.
 *
 * Greys are warm rather than blue-grey, so white cards sit on a cream page
 * without the cold cast a neutral ramp gives.
 */
const config: Config = {
  darkMode: 'class',
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
    '../../packages/design-system/src/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        // Dark surfaces, warmed to match the light palette.
        obsidian: {
          canvas: '#1B1A19',
          surface: '#232220',
          hover: '#2C2B28',
          elevated: '#292825',
          border: '#38362F',
          faint: '#8C8880',
        },
        ink: {
          primary: '#F5F4EE',
          muted: '#A5A199',
        },
        // Terracotta. The single accent — actions, focus, selected state.
        accent: {
          DEFAULT: '#C15F3C',
          hover: '#A94E2F',
          light: '#F7EAE3',
          dark: '#8F4529',
        },
        // Kept for markup that still names them; folded into the one accent
        // so no stray hue survives.
        striver: { DEFAULT: '#C15F3C', hover: '#A94E2F' },
        gemini: { DEFAULT: '#4A6FA5' },
        uv: { DEFAULT: '#8A6A9B' },
        primary: {
          50: '#FBF1EC',
          100: '#F7EAE3',
          200: '#EFD2C4',
          300: '#E3B49E',
          400: '#D28A69',
          500: '#C15F3C',
          600: '#A94E2F',
          700: '#8F4529',
          800: '#6E3520',
          900: '#4E2617',
        },
        // Warm neutral ramp: 50 is the page cream, 900 the near-black ink.
        gray: {
          50: '#FAF9F5',
          100: '#F5F3EC',
          200: '#E9E6DC',
          300: '#D8D4C7',
          400: '#A8A498',
          500: '#78756B',
          600: '#5C5A52',
          700: '#44423C',
          800: '#2B2A26',
          900: '#141413',
        },
        success: { DEFAULT: '#3F7A56', light: '#E4F0E8', dark: '#2F5E42' },
        warning: { DEFAULT: '#B7791F', light: '#FBF0DC', dark: '#8C5C13' },
        error: { DEFAULT: '#B4413A', light: '#FAE7E5', dark: '#8C302A' },
        info: { DEFAULT: '#4A6FA5', light: '#E6EDF6', dark: '#375580' },
        /*
         * Raw Tailwind palettes, restated in the same warm, low-chroma key.
         *
         * ~600 usages of `zinc-*`, `blue-*`, `emerald-*` and friends are spread
         * across the pages. Rewriting each one risked breaking dark-mode
         * contrast, where a light shade is load-bearing. Redefining the ramps
         * instead keeps every 50→900 relationship intact while pulling the hues
         * into the palette, so stock Tailwind blue stops fighting the cream.
         */
        // Neutrals collapse onto the warm grey ramp.
        zinc: { 50: '#FAF9F5', 100: '#F5F3EC', 200: '#E9E6DC', 300: '#D8D4C7', 400: '#A8A498', 500: '#78756B', 600: '#5C5A52', 700: '#44423C', 800: '#2B2A26', 900: '#141413', 950: '#0D0D0C' },
        slate: { 50: '#FAF9F5', 100: '#F5F3EC', 200: '#E9E6DC', 300: '#D8D4C7', 400: '#A8A498', 500: '#78756B', 600: '#5C5A52', 700: '#44423C', 800: '#2B2A26', 900: '#141413', 950: '#0D0D0C' },
        neutral: { 50: '#FAF9F5', 100: '#F5F3EC', 200: '#E9E6DC', 300: '#D8D4C7', 400: '#A8A498', 500: '#78756B', 600: '#5C5A52', 700: '#44423C', 800: '#2B2A26', 900: '#141413', 950: '#0D0D0C' },
        stone: { 50: '#FAF9F5', 100: '#F5F3EC', 200: '#E9E6DC', 300: '#D8D4C7', 400: '#A8A498', 500: '#78756B', 600: '#5C5A52', 700: '#44423C', 800: '#2B2A26', 900: '#141413', 950: '#0D0D0C' },
        // Informational — muted steel.
        blue: { 50: '#EFF3F9', 100: '#DDE6F0', 200: '#C2D2E4', 300: '#9CB4D0', 400: '#7191B4', 500: '#4A6FA5', 600: '#3B5A87', 700: '#31496C', 800: '#293C58', 900: '#1F2D42', 950: '#141E2C' },
        sky: { 50: '#EFF3F9', 100: '#DDE6F0', 200: '#C2D2E4', 300: '#9CB4D0', 400: '#7191B4', 500: '#4A6FA5', 600: '#3B5A87', 700: '#31496C', 800: '#293C58', 900: '#1F2D42', 950: '#141E2C' },
        cyan: { 50: '#EFF3F9', 100: '#DDE6F0', 200: '#C2D2E4', 300: '#9CB4D0', 400: '#7191B4', 500: '#4A6FA5', 600: '#3B5A87', 700: '#31496C', 800: '#293C58', 900: '#1F2D42', 950: '#141E2C' },
        indigo: { 50: '#EFF3F9', 100: '#DDE6F0', 200: '#C2D2E4', 300: '#9CB4D0', 400: '#7191B4', 500: '#4A6FA5', 600: '#3B5A87', 700: '#31496C', 800: '#293C58', 900: '#1F2D42', 950: '#141E2C' },
        // Positive — muted moss.
        emerald: { 50: '#EDF4EF', 100: '#DAE9DF', 200: '#B9D5C4', 300: '#8FBBA1', 400: '#639C7B', 500: '#3F7A56', 600: '#346548', 700: '#2B533B', 800: '#244430', 900: '#1A3223', 950: '#102117' },
        green: { 50: '#EDF4EF', 100: '#DAE9DF', 200: '#B9D5C4', 300: '#8FBBA1', 400: '#639C7B', 500: '#3F7A56', 600: '#346548', 700: '#2B533B', 800: '#244430', 900: '#1A3223', 950: '#102117' },
        teal: { 50: '#EDF4EF', 100: '#DAE9DF', 200: '#B9D5C4', 300: '#8FBBA1', 400: '#639C7B', 500: '#3F7A56', 600: '#346548', 700: '#2B533B', 800: '#244430', 900: '#1A3223', 950: '#102117' },
        lime: { 50: '#EDF4EF', 100: '#DAE9DF', 200: '#B9D5C4', 300: '#8FBBA1', 400: '#639C7B', 500: '#3F7A56', 600: '#346548', 700: '#2B533B', 800: '#244430', 900: '#1A3223', 950: '#102117' },
        // Negative — muted brick.
        red: { 50: '#FBEFEE', 100: '#F6DDDB', 200: '#EBBFBB', 300: '#DC9993', 400: '#C86B64', 500: '#B4413A', 600: '#963530', 700: '#7B2B27', 800: '#652421', 900: '#4A1A18', 950: '#2F100F' },
        rose: { 50: '#FBEFEE', 100: '#F6DDDB', 200: '#EBBFBB', 300: '#DC9993', 400: '#C86B64', 500: '#B4413A', 600: '#963530', 700: '#7B2B27', 800: '#652421', 900: '#4A1A18', 950: '#2F100F' },
        pink: { 50: '#FBEFEE', 100: '#F6DDDB', 200: '#EBBFBB', 300: '#DC9993', 400: '#C86B64', 500: '#B4413A', 600: '#963530', 700: '#7B2B27', 800: '#652421', 900: '#4A1A18', 950: '#2F100F' },
        // Caution — muted ochre.
        amber: { 50: '#FBF3E3', 100: '#F6E6C6', 200: '#EDD095', 300: '#DFB463', 400: '#CC9738', 500: '#B7791F', 600: '#98631A', 700: '#7C5115', 800: '#654212', 900: '#4A300D', 950: '#2E1E08' },
        yellow: { 50: '#FBF3E3', 100: '#F6E6C6', 200: '#EDD095', 300: '#DFB463', 400: '#CC9738', 500: '#B7791F', 600: '#98631A', 700: '#7C5115', 800: '#654212', 900: '#4A300D', 950: '#2E1E08' },
        orange: { 50: '#FBF1EC', 100: '#F7EAE3', 200: '#EFD2C4', 300: '#E3B49E', 400: '#D28A69', 500: '#C15F3C', 600: '#A94E2F', 700: '#8F4529', 800: '#6E3520', 900: '#4E2617', 950: '#2F160E' },
        // Tertiary — muted plum, the one hue kept distinct from the accent.
        purple: { 50: '#F4F0F7', 100: '#E9E1EE', 200: '#D4C4DE', 300: '#B8A0C8', 400: '#9B7DAF', 500: '#8A6A9B', 600: '#71547F', 700: '#5C4468', 800: '#4B3755', 900: '#36273D', 950: '#231928' },
        violet: { 50: '#F4F0F7', 100: '#E9E1EE', 200: '#D4C4DE', 300: '#B8A0C8', 400: '#9B7DAF', 500: '#8A6A9B', 600: '#71547F', 700: '#5C4468', 800: '#4B3755', 900: '#36273D', 950: '#231928' },
        fuchsia: { 50: '#F4F0F7', 100: '#E9E1EE', 200: '#D4C4DE', 300: '#B8A0C8', 400: '#9B7DAF', 500: '#8A6A9B', 600: '#71547F', 700: '#5C4468', 800: '#4B3755', 900: '#36273D', 950: '#231928' },
        border: '#E9E6DC',
      },
      borderRadius: {
        sm: '6px',
        md: '10px',
        lg: '14px',
        xl: '18px',
        '2xl': '22px',
        '3xl': '28px',
      },
      // Shadows are near-neutral and low-opacity: on cream, a grey shadow
      // reads as dirt, so these lean warm and stay faint.
      boxShadow: {
        card: '0 1px 2px rgba(20, 20, 19, 0.04), 0 4px 12px rgba(20, 20, 19, 0.05)',
        cardHover: '0 2px 4px rgba(20, 20, 19, 0.05), 0 12px 28px rgba(20, 20, 19, 0.08)',
        elevated: '0 8px 24px rgba(20, 20, 19, 0.10), 0 2px 6px rgba(20, 20, 19, 0.06)',
        glow: '0 0 0 3px rgba(193, 95, 60, 0.18)',
      },
      fontFamily: {
        // Set by next/font in layout.tsx; the stacks here are the fallback.
        sans: ['var(--font-sans)', 'Inter', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'sans-serif'],
        display: ['var(--font-display)', 'Newsreader', 'Georgia', 'Times New Roman', 'serif'],
      },
      letterSpacing: {
        tightest: '-0.03em',
      },
      spacing: {
        18: '4.5rem',
        88: '22rem',
      },
    },
  },
  plugins: [],
}

export default config
