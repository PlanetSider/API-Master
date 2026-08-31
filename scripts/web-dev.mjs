import { spawn } from "node:child_process"

const pnpmCommand = process.platform === "win32" ? "pnpm.cmd" : "pnpm"
const environment = { ...process.env, NODE_ENV: "development" }
const children = [
  spawn(pnpmCommand, ["run", "dev:web:server"], {
    env: environment,
    stdio: "inherit",
  }),
  spawn(pnpmCommand, ["run", "dev:web:ui"], {
    env: environment,
    stdio: "inherit",
  }),
]

let shuttingDown = false

const shutdown = (signal) => {
  if (shuttingDown) return
  shuttingDown = true
  for (const child of children) {
    child.kill(signal)
  }
}

for (const child of children) {
  child.on("exit", (code) => {
    if (!shuttingDown && code !== 0) {
      process.exitCode = code ?? 1
      shutdown("SIGTERM")
    }
  })
}

process.once("SIGINT", () => shutdown("SIGINT"))
process.once("SIGTERM", () => shutdown("SIGTERM"))
