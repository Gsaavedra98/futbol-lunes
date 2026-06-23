import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./lib/**/*.{js,ts,jsx,tsx,mdx}"
  ],
  theme: {
    extend: {
      colors: {
        pitch: "#155b37",
        line: "#e8f2ea",
        mint: "#b9f6ca",
        ink: "#12231b",
        clay: "#c96f3a",
        sun: "#f6c453"
      },
      boxShadow: {
        soft: "0 18px 60px rgba(18, 35, 27, 0.12)"
      }
    }
  },
  plugins: []
};

export default config;
