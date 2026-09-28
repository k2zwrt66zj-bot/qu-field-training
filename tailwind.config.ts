import type { Config } from "tailwindcss";

// الهوية البصرية لجامعة القصيم: الأخضر والذهبي والرمادي
// (عدّل القيم الدقيقة وفق دليل الهوية الرسمي للجامعة)
const config: Config = {
  darkMode: "class",
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    container: { center: true, padding: "1rem", screens: { "2xl": "1400px" } },
    extend: {
      fontFamily: {
        sans: ["var(--font-arabic)", "system-ui", "sans-serif"],
      },
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: { DEFAULT: "hsl(var(--primary))", foreground: "hsl(var(--primary-foreground))" },
        secondary: { DEFAULT: "hsl(var(--secondary))", foreground: "hsl(var(--secondary-foreground))" },
        destructive: { DEFAULT: "hsl(var(--destructive))", foreground: "hsl(var(--destructive-foreground))" },
        muted: { DEFAULT: "hsl(var(--muted))", foreground: "hsl(var(--muted-foreground))" },
        accent: { DEFAULT: "hsl(var(--accent))", foreground: "hsl(var(--accent-foreground))" },
        card: { DEFAULT: "hsl(var(--card))", foreground: "hsl(var(--card-foreground))" },
        qu: {
          green: { 50: "#ecf7f1", 100: "#d2ecdf", 500: "#138a55", 600: "#0f6b45", 700: "#0b5537", 800: "#08412a", 900: "#052c1d" },
          gold: { 50: "#faf5e9", 100: "#f2e6c4", 400: "#d1b161", 500: "#b8963e", 600: "#9a7a2c" },
          gray: { 50: "#f6f7f7", 100: "#eceeed", 300: "#c9cdcb", 500: "#7b817e", 700: "#4a4f4d", 900: "#222524" },
        },
      },
      borderRadius: { lg: "var(--radius)", md: "calc(var(--radius) - 2px)", sm: "calc(var(--radius) - 4px)" },
    },
  },
  plugins: [],
};
export default config;
