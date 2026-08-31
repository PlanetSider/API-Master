type RuntimeMessageListener = (
  message: unknown,
  sender: unknown,
  sendResponse: (response?: unknown) => void,
) => void

interface WebExtensionRuntime {
  sendMessage?: (message: unknown) => unknown
  onMessage?: {
    addListener?: (listener: RuntimeMessageListener) => void
    removeListener?: (listener: RuntimeMessageListener) => void
  }
}

const getRuntime = (): WebExtensionRuntime | undefined => {
  const globals = globalThis as typeof globalThis & {
    browser?: { runtime?: WebExtensionRuntime }
    chrome?: { runtime?: WebExtensionRuntime }
  }
  return globals.browser?.runtime ?? globals.chrome?.runtime
}

export async function sendRuntimeMessage(message: unknown): Promise<unknown> {
  const runtime = getRuntime()
  if (typeof runtime?.sendMessage !== "function") return undefined
  return await Promise.resolve(runtime.sendMessage.call(runtime, message))
}

export function onRuntimeMessage(listener: RuntimeMessageListener): () => void {
  const onMessage = getRuntime()?.onMessage
  if (typeof onMessage?.addListener !== "function") return () => {}

  onMessage.addListener(listener)
  return () => onMessage.removeListener?.(listener)
}
