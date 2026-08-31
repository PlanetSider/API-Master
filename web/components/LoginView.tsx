import { KeyRound, Server } from "lucide-react"
import { useState, type FormEvent } from "react"

interface LoginViewProps {
  loading: boolean
  error: string | null
  onLogin: (password: string) => Promise<void>
}

export function LoginView({ loading, error, onLogin }: LoginViewProps) {
  const [password, setPassword] = useState("")

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()
    await onLogin(password)
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-gray-50 px-4 py-10 dark:bg-gray-950">
      <section className="w-full max-w-sm rounded-md border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900">
        <div className="mb-6 flex items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-md bg-blue-600 text-white">
            <Server className="size-5" />
          </div>
          <div>
            <h1 className="text-lg font-semibold">All API Hub</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Web 管理系统
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <label className="block space-y-1.5">
            <span className="text-sm font-medium">管理员密码</span>
            <div className="relative">
              <KeyRound className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-gray-400" />
              <input
                autoFocus
                required
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                className="h-10 w-full rounded-md border border-gray-300 bg-white pr-3 pl-9 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/30 dark:border-gray-700 dark:bg-gray-950"
              />
            </div>
          </label>

          {error ? (
            <p role="alert" className="text-sm text-red-600 dark:text-red-400">
              {error}
            </p>
          ) : null}

          <button
            type="submit"
            disabled={loading}
            className="flex h-10 w-full items-center justify-center rounded-md bg-blue-600 px-4 text-sm font-medium text-white hover:bg-blue-700 focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 focus-visible:outline-none disabled:opacity-60"
          >
            {loading ? "正在登录..." : "登录"}
          </button>
        </form>
      </section>
    </main>
  )
}
