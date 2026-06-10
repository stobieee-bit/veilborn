import { defineConfig } from "vite";

export default defineConfig({
  base: "./",
  server: {
    host: "127.0.0.1",
    // Respect an assigned PORT (preview harness) but default to 5173.
    port: Number(process.env.PORT) || 5173,
    open: false,
  },
  build: {
    target: "es2022",
    outDir: "dist",
    sourcemap: true,
  },
});
