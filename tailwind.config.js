/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,js,html}'],
  theme: {
    extend: {
      colors: {
        line: {
          green:  '#06C755',
          dark:   '#00B900',
          light:  '#E8F9ED'
        },
        runner: {
          primary:   '#1a1a2e',
          secondary: '#4A90D9',
          accent:    '#FF6B35',
          success:   '#00C851',
          warning:   '#FF8800',
          danger:    '#FF4444'
        }
      },
      fontFamily: {
        sans: ['Noto Sans Thai', 'Noto Sans', 'sans-serif']
      },
      animation: {
        'spin-slow':    'spin 1.5s linear infinite',
        'pulse-fast':   'pulse 0.8s ease-in-out infinite',
        'slide-up':     'slideUp 0.3s ease-out',
        'fade-in':      'fadeIn 0.25s ease-out'
      },
      keyframes: {
        slideUp:  { '0%': { transform: 'translateY(20px)', opacity: '0' },
                    '100%': { transform: 'translateY(0)', opacity: '1' } },
        fadeIn:   { '0%': { opacity: '0' }, '100%': { opacity: '1' } }
      }
    }
  },
  plugins: []
};
