import type { Config } from "tailwindcss"

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        'claude-bg': '#FAF7F2',
        'claude-surface': '#FFFFFF',
        'claude-border': '#E8E2D9',
        'claude-text': '#2D2D2D',
        'claude-text-secondary': '#6B6258',
        'claude-text-muted': '#9E9485',
        'claude-accent': '#D97706',
        'claude-accent-light': '#F59E0B',
        'claude-accent-bg': '#FEF3C7',
        'claude-warm': '#FFF7ED',
        'claude-sidebar': '#FAF7F2',
        'claude-hover': '#F5F0E8',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
export default config
