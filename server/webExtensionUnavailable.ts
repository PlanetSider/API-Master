import type {
  TempWindowCheckinPageAction,
  TempWindowFetch,
  TempWindowRenderedTitleResponse,
  TempWindowTurnstileFetch,
} from "~/types/tempWindowFetch"

const BROWSER_REQUIRED_MESSAGE =
  "Browser worker is required for this operation in Web mode"

const unavailableFetch = (): TempWindowFetch => ({
  success: false,
  error: BROWSER_REQUIRED_MESSAGE,
})

export const getBrowserApiCapabilities = () => ({
  hasWindows: false,
  hasTabs: false,
  hasBackgroundMessaging: false,
})

export const getAllTabs = async () => []
export const isAllowedIncognitoAccess = async () => false
export const containsPermissions = async () => false
export const onStorageChanged = () => () => {}
export const onRuntimeMessage = () => () => {}
export const isMessageReceiverUnavailableError = () => false
export const canUseTempWindowFetch = async () => false
export const isExtensionBackground = () => false
export const isExtensionPopup = () => false
export const isExtensionOptions = () => false
export const isExtensionSidePanel = () => false
export const isProtectionBypassFirefoxEnv = () => false
export const matchesTempWindowFallbackAllowlist = () => false

export const getManifest = () => ({ optional_permissions: [] as string[] })
export const getExtensionURL = (path: string) => path

export async function sendRuntimeMessage(): Promise<undefined> {
  return undefined
}

export async function sendTabMessageWithRetry(): Promise<never> {
  throw new Error(BROWSER_REQUIRED_MESSAGE)
}

export async function executeProtectionBypassTask(): Promise<TempWindowFetch> {
  return unavailableFetch()
}

export async function tempWindowFetch(): Promise<TempWindowFetch> {
  return unavailableFetch()
}

export async function tempWindowNewApiSessionRead(): Promise<TempWindowFetch> {
  return unavailableFetch()
}

export async function tempWindowTurnstileFetch(): Promise<TempWindowTurnstileFetch> {
  return {
    ...unavailableFetch(),
    turnstile: { status: "error", hasTurnstile: false },
  }
}

export async function tempWindowTriggerCheckinPageAction(): Promise<TempWindowCheckinPageAction> {
  return {
    success: false,
    reason: "trigger_failed",
    error: BROWSER_REQUIRED_MESSAGE,
  }
}

export async function tempWindowGetRenderedTitle(): Promise<TempWindowRenderedTitleResponse> {
  return { success: false, error: BROWSER_REQUIRED_MESSAGE }
}

export async function executeWithTempWindowFallback(): Promise<never> {
  throw new Error(BROWSER_REQUIRED_MESSAGE)
}
