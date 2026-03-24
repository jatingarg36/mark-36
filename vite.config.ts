import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"]
  },
  build: {
    outDir: "dist",
    emptyOutDir: true,
    chunkSizeWarningLimit: 3000,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes("node_modules")) {
            if (id.includes("mermaid")) {
              return "vendor-mermaid";
            }
            if (id.includes("katex")) {
              return "vendor-katex";
            }
            if (id.includes("codemirror") || id.includes("@codemirror") || id.includes("@uiw/react-codemirror")) {
              return "vendor-codemirror";
            }
            if (id.includes("highlight.js")) {
              return "vendor-highlight";
            }
            if (id.includes("docx")) {
              return "vendor-docx";
            }
            if (id.includes("react") || id.includes("react-dom") || id.includes("scheduler")) {
              return "vendor-react";
            }
            return "vendor";
          }
        }
      }
    }
  }
});
