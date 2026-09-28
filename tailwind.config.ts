import type { Config } from "tailwindcss";

// الهوية البصرية الرسمية لجامعة القصيم: الكحلي والفيروزي (انظر src/lib/brand.ts)
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
          // 700 = الكحلي الرسمي #0F486E
          navy: { 50: "#eef4f9", 100: "#d6e4ef", 200: "#afcadf", 500: "#1b6597", 600: "#145782", 700: "#0f486e", 800: "#0b3653", 900: "#072438" },
          // 400/500 = الفيروزي الرسمي (زخرفي)، 700 = للنصوص والأزرار (تباين 5:1)
          teal: { 50: "#e8f8f8", 100: "#c7eeef", 300: "#6fd8d0", 400: "#18c5b8", 500: "#17afb2", 600: "#0d89a8", 700: "#0b7a93", 800: "#085c70" },
          gray: { 50: "#f7f8f9", 100: "#f2f2f2", 300: "#c9ccd1", 500: "#7b8088", 700: "#4a4f57", 900: "#1d2330" },
        },
      },
      borderRadius: { lg: "var(--radius)", md: "calc(var(--radius) - 2px)", sm: "calc(var(--radius) - 4px)" },
    },
  },
  plugins: [],
};
export default config;
