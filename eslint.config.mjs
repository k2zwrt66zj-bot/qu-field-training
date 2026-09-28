import { FlatCompat } from "@eslint/eslintrc";
const compat = new FlatCompat({ baseDirectory: import.meta.dirname });
export default [
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  {
    rules: {
      // المتغيرات المبدوءة بـ _ مستبعدة عمداً (إسقاط حقول عند التفكيك)
      "@typescript-eslint/no-unused-vars": ["warn", { varsIgnorePattern: "^_", argsIgnorePattern: "^_", ignoreRestSiblings: true }],
    },
  },
  { ignores: [".next/**", "node_modules/**"] },
];
