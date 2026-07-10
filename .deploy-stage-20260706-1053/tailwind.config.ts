import type { Config } from "tailwindcss";
import tailwindcssAnimate from "tailwindcss-animate";

const config: Config = {
  darkMode: ["class"],
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}",
  ],
  theme: {
    container: {
      center: true,
      padding: "2rem",
      screens: { "2xl": "1400px" },
    },
    extend: {
      colors: {
        // Kerala CMO palette (Section 11)
        "kerala-blue": "#003580",
        "cmo-gold": "#C8A951",
        "success-green": "#16A34A",
        "warning-amber": "#D97706",
        "error-red": "#DC2626",

        // Public portal palette (HDP redesign)
        "hdp-green": "#1B5E20",       // primary deep green
        "hdp-green-active": "#2E7D32", // active / hover green
        "hdp-gold": "#C8A951",        // accent gold
        "hdp-success": "#4CAF50",     // status success
        "hdp-warning": "#FF8F00",     // status warning
        "hdp-danger": "#E53935",      // status error / not started
        "hdp-bg": "#F8FAF8",          // page background

        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      fontFamily: {
        sans: ["Inter", "ui-sans-serif", "system-ui"],
        mono: ["JetBrains Mono", "ui-monospace"],
        malayalam: ['"Noto Sans Malayalam"', "sans-serif"],
      },
    },
  },
  plugins: [tailwindcssAnimate],
};

export default config;
