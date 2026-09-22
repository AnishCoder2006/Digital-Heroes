import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: { DEFAULT: "#17153B", soft: "#4A4870", faint: "#8C8AAE" },
        mist: { DEFAULT: "#F1F0FF", deep: "#E4E1FF" },
        violet: { DEFAULT: "#5B4BFF", deep: "#3B2FD1", soft: "#DAD6FF" },
        marigold: { DEFAULT: "#FFC24B", soft: "#FFEBC2" },
        rose: { DEFAULT: "#FF5C8A", soft: "#FFD9E4" },
        mint: { DEFAULT: "#23C9A0", soft: "#C9F4E8" },
      },
      fontFamily: {
        display: ["var(--font-display)", "ui-sans-serif", "system-ui", "sans-serif"],
        sans: ["var(--font-body)", "ui-sans-serif", "system-ui", "sans-serif"],
      },
      borderRadius: { panel: "2rem", blob: "3rem" },
      boxShadow: {
        lift: "0 24px 60px -24px rgba(59, 47, 209, 0.35)",
        pop: "0 10px 0 -2px rgba(23, 21, 59, 0.9)",
      },
    },
  },
  plugins: [],
};
export default config;
