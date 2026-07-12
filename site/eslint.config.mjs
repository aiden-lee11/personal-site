import { dirname } from "path";
import { fileURLToPath } from "url";
import { FlatCompat } from "@eslint/eslintrc";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
});

const eslintConfig = [
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  {
    ignores: [
      "node_modules/**",
      ".next/**",
      "out/**",
      "build/**",
      "next-env.d.ts",
      // Emscripten-generated glue for the in-browser compiler — vendored build
      // artifacts, not hand-authored source. Next's own build lint skips
      // public/ already; keep the standalone `eslint` run consistent.
      "public/**",
    ],
  },
];

export default eslintConfig;
