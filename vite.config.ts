import { defineConfig } from "vite";

// base "/" weil die App unter einer eigenen Domain läuft (nicht unter /repo-name/)
export default defineConfig({
  base: "/",
  build: { outDir: "dist", sourcemap: false }
});
