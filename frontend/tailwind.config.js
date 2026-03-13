/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './index.html',
    './src/**/*.{js,ts,jsx,tsx}',
  ],
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['DM Mono', 'Courier New', 'monospace'],
      },
      colors: {
        glass: {
          bg: 'rgba(255, 255, 255, 0.08)',
          border: 'rgba(255, 255, 255, 0.15)',
        },
        surface: {
          900: '#0A0A0A',
          800: '#111111',
          700: '#1A1A1A',
        }
      },
      boxShadow: {
        glass: '0 8px 32px rgba(0, 0, 0, 0.15)',
      },
      backdropBlur: {
        glass: '12px',
      }
    },
  },
  plugins: [],
};
