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
        'gradient-x': 'gradientX 3s ease infinite',
        'gradient-flow': 'gradientFlow 8s ease infinite',
        'shimmer': 'shimmer 2s linear infinite',
        'glow-pulse': 'glowPulse 2s ease-in-out infinite',
        'float': 'float 3s ease-in-out infinite',
        'scale-pulse': 'scalePulse 2s ease-in-out infinite',
        'border-glow': 'borderGlow 2s ease-in-out infinite',
        'text-glow': 'textGlow 2s ease-in-out infinite',
        'spin-slow': 'spin 8s linear infinite',
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
        gradientX: {
          '0%, 100%': { backgroundPosition: '0% 50%' },
          '50%': { backgroundPosition: '100% 50%' },
        },
        gradientFlow: {
          '0%': { backgroundPosition: '0% 50%' },
          '50%': { backgroundPosition: '100% 50%' },
          '100%': { backgroundPosition: '0% 50%' },
        },
        shimmer: {
          '0%': { transform: 'translateX(-100%)' },
          '100%': { transform: 'translateX(100%)' },
        },
        glowPulse: {
          '0%, 100%': { opacity: '0.5', transform: 'scale(1)' },
          '50%': { opacity: '1', transform: 'scale(1.05)' },
        },
        float: {
          '0%, 100%': { transform: 'translateY(0px)' },
          '50%': { transform: 'translateY(-4px)' },
        },
        scalePulse: {
          '0%, 100%': { transform: 'scale(1)' },
          '50%': { transform: 'scale(1.02)' },
        },
        borderGlow: {
          '0%, 100%': { borderColor: 'rgba(131, 110, 249, 0.3)' },
          '50%': { borderColor: 'rgba(131, 110, 249, 0.8)' },
        },
        textGlow: {
          '0%, 100%': { textShadow: '0 0 10px rgba(251, 191, 36, 0.5)' },
          '50%': { textShadow: '0 0 20px rgba(251, 191, 36, 1), 0 0 30px rgba(251, 191, 36, 0.5)' },
        },
      },
    },
  },
  plugins: [],
};

export default config;
