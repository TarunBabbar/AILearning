import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // Claude beige/light theme
        sidebar: {
          bg: "#f5f0eb",
          text: "#4a4a4a",
          hover: "#e8e0d8",
          active: "#dcd3c9",
        },
        claude: {
          beige: "#f5f0eb",
          "beige-light": "#faf7f3",
          "beige-dark": "#e8e0d8",
          accent: "#c95a3f",
          "accent-hover": "#b04a32",
          surface: "#ffffff",
          border: "#e2dcd5",
          text: "#1a1a1a",
          "text-muted": "#6b6b6b",
          "text-light": "#8a8a8a",
        },
        message: {
          user: "#e8e0d8",
          assistant: "#ffffff",
        },
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "-apple-system", "sans-serif"],
      },
    },
  },
  plugins: [],
};

export default config;
