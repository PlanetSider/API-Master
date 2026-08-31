import path from "node:path"
import { fileURLToPath } from "node:url"
import { defineConfig, type Plugin } from "vite"

const rootDirectory = path.dirname(fileURLToPath(import.meta.url))
const emitSourceMap =
  process.env.AAH_BUILD_SOURCEMAP === "true" ||
  process.env.AAH_BUILD_SOURCEMAP === "1"
const forbiddenServerModules = [
  "src/utils/browser/browserApi.ts",
  "src/utils/browser/tempWindowFetch.ts",
  "src/entrypoints/background/protectionBypassCoordinator.ts",
  "src/services/accounts/accountStorage.ts",
]

const webServerRuntimeBoundary = (): Plugin => ({
  name: "web-server-runtime-boundary",
  generateBundle() {
    const violations = [...this.getModuleIds()]
      .map((id) => id.replaceAll("\\", "/"))
      .filter((id) =>
        forbiddenServerModules.some((modulePath) => id.endsWith(modulePath)),
      )
    if (violations.length > 0) {
      this.error(
        `Web server bundle contains WebExtension modules:\n${violations.join("\n")}`,
      )
    }
  },
})

export default defineConfig({
  plugins: [webServerRuntimeBoundary()],
  resolve: {
    alias: [
      {
        find: "~/services/apiTransport/browserTransportRuntime",
        replacement: path.resolve(
          rootDirectory,
          "server",
          "browserTransportRuntime.ts",
        ),
      },
      {
        find: "~/utils/browser/browserApi",
        replacement: path.resolve(
          rootDirectory,
          "server",
          "webExtensionUnavailable.ts",
        ),
      },
      {
        find: "~/utils/browser/tempWindowFetch",
        replacement: path.resolve(
          rootDirectory,
          "server",
          "webExtensionUnavailable.ts",
        ),
      },
      {
        find: "~/services/accounts/accountStorage",
        replacement: path.resolve(
          rootDirectory,
          "server",
          "extensionAccountStorageUnavailable.ts",
        ),
      },
      { find: "~", replacement: path.resolve(rootDirectory, "src") },
      { find: "~~", replacement: rootDirectory },
    ],
  },
  ssr: {
    noExternal: true,
  },
  build: {
    ssr: path.resolve(rootDirectory, "server", "index.ts"),
    outDir: path.resolve(rootDirectory, ".output", "web-server"),
    emptyOutDir: true,
    target: "node24",
    sourcemap: emitSourceMap,
    rollupOptions: {
      output: {
        entryFileNames: "server.mjs",
      },
    },
  },
})
