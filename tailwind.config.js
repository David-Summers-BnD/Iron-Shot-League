/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{svelte,js,ts}"
  ],
  theme: {
    extend: {
      colors: {
        'iron': {
          50: '#fef7ee',
          100: '#fdedd3',
          200: '#fad7a6',
          300: '#f6bb6e',
          400: '#f19535',
          500: '#ee7a12',
          600: '#df6008',
          700: '#b94809',
          800: '#93390f',
          900: '#773110',
          950: '#401606',
        }
      }
    }
  },
  plugins: [require("daisyui")],
  daisyui: {
    themes: [
      {
        ironshot: {
          "primary": "#3B82F6",
          "secondary": "#22C55E",
          "accent": "#F97316",
          "neutral": "#1E293B",
          "base-100": "#0F172A",
          "base-200": "#1E293B",
          "base-300": "#334155",
          "info": "#38BDF8",
          "success": "#22C55E",
          "warning": "#F59E0B",
          "error": "#EF4444",
        },
      },
    ],
  },
}
