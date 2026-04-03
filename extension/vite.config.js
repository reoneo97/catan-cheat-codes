import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  build: {
    outDir: "dist",
    // Inline assets so the popup works without extra file permissions in manifest
    assetsInlineLimit: 100000,
    rollupOptions: {
      input: { popup: "index.html" },
    },
  },
});
