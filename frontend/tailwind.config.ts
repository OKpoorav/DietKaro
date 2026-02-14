import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "var(--background)",
        foreground: "var(--foreground)",
        brand: {
          DEFAULT: '#17cf54',
          50:  '#edfff3',
          100: '#d5ffe4',
          200: '#aeffcb',
          300: '#6fffa3',
          400: '#33f57e',
          500: '#17cf54',
          600: '#0ba843',
          700: '#0d8438',
          800: '#106830',
          900: '#0e5629',
          950: '#013014',
        },
      },
    },
  },
  plugins: [],
};
export default config;
