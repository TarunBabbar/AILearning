/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // Claude-inspired warm beige palette
        cream: {
          50: "#faf9f5",
          100: "#f5f2e9",
          200: "#e9e3d3",
          300: "#d9cfb8",
          400: "#c4b495",
          500: "#a8996f",
          600: "#8a7b55",
          700: "#6d5f43",
          800: "#4c4232",
          900: "#2d2820",
        },
        accent: {
          DEFAULT: "#b8692c",
          hover: "#9c5622",
          soft: "#f0e2d2",
        },
      },
      fontFamily: {
        sans: [
          "ui-sans-serif",
          "system-ui",
          "-apple-system",
          "Segoe UI",
          "Roboto",
          "Helvetica Neue",
          "Arial",
          "sans-serif",
        ],
      },
    },
  },
  plugins: [],
};
