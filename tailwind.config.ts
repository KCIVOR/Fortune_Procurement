import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      backgroundImage: {
        'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
        'gradient-conic':
          'conic-gradient(from 180deg at 50% 50%, var(--tw-gradient-stops))',
      },
      /* ── v2.0 Typography — delegates to next/font-injected CSS vars ── */
      fontFamily: {
        sans: ['var(--font-sans)', 'system-ui', 'sans-serif'],
        mono: ['var(--font-mono)', 'ui-monospace', 'monospace'],
      },
      /* ── v2.0 Border Radius Scale ───────────────────────────────
         Unlocked from the legacy 4px hard cap to support the full
         ProcureIQ design token range (--r-sm through --r-2xl).     */
      borderRadius: {
        none:    '0px',
        xs:      '2px',
        sm:      'var(--r-sm)',   /* 4px  */
        DEFAULT: 'var(--r-sm)',   /* 4px  */
        md:      'var(--r-md)',   /* 6px  */
        lg:      'var(--r-lg)',   /* 8px  */
        xl:      'var(--r-xl)',   /* 12px */
        '2xl':   'var(--r-2xl)', /* 16px */
        full:    'var(--r-full)', /* 9999px */
      },
      colors: {
        /* ── ProcureIQ v2.0 Design Token Colors ─────────────────── */
        'pq-primary': {
          900: 'var(--primary-900)',
          800: 'var(--primary-800)',
          700: 'var(--primary-700)',
          600: 'var(--primary-600)',
          500: 'var(--primary-500)',
          400: 'var(--primary-400)',
          300: 'var(--primary-300)',
          200: 'var(--primary-200)',
          100: 'var(--primary-100)',
          50:  'var(--primary-50)',
        },
        'pq-accent': {
          600: 'var(--accent-600)',
          500: 'var(--accent-500)',
          400: 'var(--accent-400)',
          100: 'var(--accent-100)',
        },
        'pq-success': {
          900: 'var(--success-900)',
          700: 'var(--success-700)',
          600: 'var(--success-600)',
          500: 'var(--success-500)',
          400: 'var(--success-400)',
          200: 'var(--success-200)',
          100: 'var(--success-100)',
          50:  'var(--success-50)',
        },
        'pq-warning': {
          900: 'var(--warning-900)',
          700: 'var(--warning-700)',
          600: 'var(--warning-600)',
          500: 'var(--warning-500)',
          400: 'var(--warning-400)',
          200: 'var(--warning-200)',
          100: 'var(--warning-100)',
          50:  'var(--warning-50)',
        },
        'pq-danger': {
          900: 'var(--danger-900)',
          700: 'var(--danger-700)',
          600: 'var(--danger-600)',
          500: 'var(--danger-500)',
          400: 'var(--danger-400)',
          200: 'var(--danger-200)',
          100: 'var(--danger-100)',
          50:  'var(--danger-50)',
        },
        'pq-neutral': {
          950: 'var(--neutral-950)',
          900: 'var(--neutral-900)',
          800: 'var(--neutral-800)',
          700: 'var(--neutral-700)',
          600: 'var(--neutral-600)',
          500: 'var(--neutral-500)',
          400: 'var(--neutral-400)',
          300: 'var(--neutral-300)',
          200: 'var(--neutral-200)',
          150: 'var(--neutral-150)',
          100: 'var(--neutral-100)',
          50:  'var(--neutral-50)',
        },
        'pq-white': 'var(--white)',

        /* ── Legacy brand primitives (preserved for backward compat) */
        brand: {
          primary:             '#1E4BFF',
          navy:                '#0F1F3A',
          'dark-bg':           '#0B1426',
          canvas:              '#FFFFFF',
          'muted-bg':          '#F7F9FC',
          'border-light':      '#D8E2FF',
          'border-dark':       '#22304A',
          'text-dark-primary': '#FFFFFF',
          'text-dark-secondary': '#BFC7D5',
          'text-light-primary':  '#0F1F3A',
          'text-light-secondary': '#40527A',
        },

        /* ── shadcn/ui semantic aliases (preserved — do not remove) */
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        card: {
          DEFAULT:    'hsl(var(--card))',
          foreground: 'hsl(var(--card-foreground))',
        },
        popover: {
          DEFAULT:    'hsl(var(--popover))',
          foreground: 'hsl(var(--popover-foreground))',
        },
        primary: {
          DEFAULT:    'hsl(var(--primary))',
          foreground: 'hsl(var(--primary-foreground))',
        },
        secondary: {
          DEFAULT:    'hsl(var(--secondary))',
          foreground: 'hsl(var(--secondary-foreground))',
        },
        muted: {
          DEFAULT:    'hsl(var(--muted))',
          foreground: 'hsl(var(--muted-foreground))',
        },
        accent: {
          DEFAULT:    'hsl(var(--accent))',
          foreground: 'hsl(var(--accent-foreground))',
        },
        destructive: {
          DEFAULT:    'hsl(var(--destructive))',
          foreground: 'hsl(var(--destructive-foreground))',
        },
        border: 'hsl(var(--border))',
        input:  'hsl(var(--input))',
        ring:   'hsl(var(--ring))',
        chart: {
          '1': 'hsl(var(--chart-1))',
          '2': 'hsl(var(--chart-2))',
          '3': 'hsl(var(--chart-3))',
          '4': 'hsl(var(--chart-4))',
          '5': 'hsl(var(--chart-5))',
        },
      },
      letterSpacing: {
        label: '0.12em',
      },
      keyframes: {
        'accordion-down': {
          from: { height: '0' },
          to:   { height: 'var(--radix-accordion-content-height)' },
        },
        'accordion-up': {
          from: { height: 'var(--radix-accordion-content-height)' },
          to:   { height: '0' },
        },
      },
      animation: {
        'accordion-down': 'accordion-down 0.2s ease-out',
        'accordion-up':   'accordion-up 0.2s ease-out',
      },
    },
  },
  plugins: [require('tailwindcss-animate')],
};
export default config;
