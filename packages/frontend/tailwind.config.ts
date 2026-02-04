import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        poker: {
          green: '#1a5f2a',
          felt: '#2d7a3d',
          gold: '#d4af37',
          red: '#c62828',
          black: '#1a1a1a',
        },
        monad: {
          primary: '#836EF9',
          secondary: '#4F3ED8',
          dark: '#0d0d0d',
        },
      },
      fontFamily: {
        display: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
      animation: {
        'card-flip': 'cardFlip 0.6s ease-in-out',
        'chip-stack': 'chipStack 0.3s ease-out',
        'pulse-glow': 'pulseGlow 2s ease-in-out infinite',
      },
      keyframes: {
        cardFlip: {
          '0%': { transform: 'rotateY(0deg)' },
          '100%': { transform: 'rotateY(180deg)' },
        },
        chipStack: {
          '0%': { transform: 'translateY(-20px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        pulseGlow: {
          '0%, 100%': { boxShadow: '0 0 5px rgba(131, 110, 249, 0.5)' },
          '50%': { boxShadow: '0 0 20px rgba(131, 110, 249, 0.8)' },
        },
      },
    },
  },
  plugins: [],
};

export default config;
