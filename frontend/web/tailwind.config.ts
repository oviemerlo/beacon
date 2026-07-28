import type { Config } from "tailwindcss";

/**
 * Design tokens — see /docs/DESIGN.md for the reasoning.
 * Signal metaphor: a beacon in the dark. Dusk-navy base, one warm amber
 * "signal" accent that's used sparingly (broadcast markers, active states,
 * the ping motif), not spread across every button.
 */
const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        dusk: {
          950: "#0D0E14",
          900: "#12131C",
          800: "#1B1D29",
          700: "#262838",
          600: "#383B52",
        },
        parchment: {
          100: "#F5F2EA",
          300: "#D9D5C9",
          500: "#8B8FA3",
        },
        signal: {
          400: "#F2B25C",
          500: "#EDA23F",
          600: "#D98A2A",
        },
        moss: {
          400: "#6FAE93",
          500: "#5B9A7F",
        },
        rust: {
          400: "#D9714E",
        },
      },
      fontFamily: {
        display: ["var(--font-display)", "sans-serif"],
        body: ["var(--font-body)", "sans-serif"],
        mono: ["var(--font-mono)", "monospace"],
      },
      borderRadius: {
        beacon: "0.625rem",
      },
      keyframes: {
        "ping-slow": {
          "0%": { transform: "scale(1)", opacity: "0.6" },
          "100%": { transform: "scale(2.4)", opacity: "0" },
        },
      },
      animation: {
        "ping-slow": "ping-slow 2.2s cubic-bezier(0,0,0.2,1) infinite",
      },
    },
  },
  plugins: [],
};

export default config;
