/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: [
          '-apple-system',
          'BlinkMacSystemFont',
          '"SF Pro Display"',
          '"SF Pro Text"',
          '"Helvetica Neue"',
          'Helvetica',
          'Arial',
          'sans-serif'
        ],
        mono: [
          '"SF Mono"',
          'SFMono-Regular',
          'ui-monospace',
          'Menlo',
          'Monaco',
          'Consolas',
          'monospace'
        ],
        pixel: ['"Press Start 2P"', 'monospace'],
      },
      colors: {
        chassis: {
          cream: '#ECE9E0',
          beige: '#E1DDCF',
          dark: '#1C1D21',
          slate: '#2B2D33'
        },
        crt: {
          bg: '#14161B',
          screen: '#1A1D24',
          phosphor: '#E6E9EF',
          accent: '#FF3B30',
          green: '#1DB954'
        }
      }
    },
  },
  plugins: [],
}
