/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: {
          0: '#120e1c',
          1: '#241a38',
          2: '#3a2c55',
          3: '#5b4a7a'
        },
        grass: {
          0: '#1f3d2b',
          1: '#2f6b3a',
          2: '#4f9a42',
          3: '#a7d05a'
        },
        water: {
          0: '#17304f',
          1: '#1f5a8a',
          2: '#3b8fc4',
          3: '#8fd3ef'
        },
        stone: {
          0: '#3c3a41',
          1: '#5e5b66',
          2: '#8c8996',
          3: '#c4c1c9'
        },
        earth: {
          0: '#3b2418',
          1: '#6b4226',
          2: '#9a6a3a',
          3: '#d09a5a'
        },
        gold: {
          0: '#7a4e12',
          1: '#c98a1b',
          2: '#f2c14e',
          3: '#fff0a8'
        },
        ember: {
          0: '#4a1420',
          1: '#8c2434',
          2: '#d4483b',
          3: '#f2845c'
        },
        magic: {
          0: '#1e8f8a',
          1: '#5ee0c8',
          2: '#c05ad0',
          3: '#f0a5f0'
        }
      },
      fontFamily: {
        pixel: ['"Press Start 2P"', 'monospace'],
        mono: ['"IBM Plex Mono"', 'ui-monospace', 'monospace']
      }
    }
  },
  plugins: []
};
