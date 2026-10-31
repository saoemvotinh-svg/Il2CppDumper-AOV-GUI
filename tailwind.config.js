/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        app: {
          bg: '#151719',
          workspace: '#1D2022',
          elevated: '#24282B',
          elevatedHover: '#2C3135',
          panel: '#1A1C1E',
          border: '#34393C',
          borderSubtle: '#282C2E',
        },
        ink: {
          primary: '#E4E5E2',
          secondary: '#9AA19E',
          muted: '#656C69',
        },
        accent: {
          DEFAULT: '#AE8957',
          hover: '#BD9763',
          active: '#987547',
          subtle: 'rgba(174, 137, 87, 0.12)',
          border: 'rgba(174, 137, 87, 0.35)',
        },
        status: {
          ready: '#7F9D8B',
          warning: '#D1A567',
          error: '#CB7775',
          info: '#8B949E',
        }
      },
      fontFamily: {
        mono: ['"JetBrains Mono"', 'ui-monospace', 'SFMono-Regular', 'Menlo', 'Consolas', 'monospace'],
        sans: ['Inter', '-apple-system', 'BlinkMacSystemFont', '"Segoe UI"', 'Roboto', 'sans-serif'],
      },
      borderRadius: {
        'sm': '3px',
        DEFAULT: '4px',
        'md': '6px',
        'lg': '8px',
      }
    },
  },
  plugins: [],
}
