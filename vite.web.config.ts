import path from "node:path"
import { fileURLToPath } from "node:url"
import react from "@vitejs/plugin-react"
import { defineConfig } from "vite"

const rootDirectory = path.dirname(fileURLToPath(import.meta.url))
const emitSourceMap =
  process.env.AAH_BUILD_SOURCEMAP === "true" ||
  process.env.AAH_BUILD_SOURCEMAP === "1"

export default defineConfig({
  root: path.resolve(rootDirectory, "web"),
  plugins: [react()],
  resolve: {
    alias: {
      "~": path.resolve(rootDirectory, "src"),
      "~~": rootDirectory,
    },
  },
  build: {
    outDir: path.resolve(rootDirectory, ".output", "web"),
    emptyOutDir: true,
    sourcemap: emitSourceMap,
  },
  server: {
    host: "127.0.0.1",
    port: 5173,
    proxy: {
      "/api/": {
        target: "http://127.0.0.1:8787",
        changeOrigin: false,
      },
    },
  },
})
