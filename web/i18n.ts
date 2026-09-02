import { createInstance } from "i18next"

import ui from "~/locales/zh-CN/ui.json"

const webI18n = createInstance()

void webI18n.init({
  lng: "zh-CN",
  fallbackLng: "zh-CN",
  defaultNS: "ui",
  resources: {
    "zh-CN": { ui },
  },
  initImmediate: false,
  interpolation: {
    escapeValue: false,
  },
  react: {
    useSuspense: false,
  },
})

export default webI18n
